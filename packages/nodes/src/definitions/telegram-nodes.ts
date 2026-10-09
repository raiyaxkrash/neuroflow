import { BaseNodeDef, NodeExecutionContext, NodeExecutionOutput } from '../base.js';
import {
  NodeCategory,
  WorkflowPortDefinition,
  TelegramMessageTriggerParametersSchema,
  TelegramCommandTriggerParametersSchema,
  TelegramSendMessageParametersSchema,
  TelegramSendDocumentParametersSchema,
} from '@neuroflow/shared';
import { TelegramApi, isAuthorizedTelegramSender } from '../integrations/telegram-adapter.js';
import { getDatabase, credentials, eq, decryptData } from '@neuroflow/database';

// Хелпер разрешения учетных данных бота
async function resolveBotToken(context: NodeExecutionContext): Promise<string> {
  const credentialsId = (context as any).credentialsId || (context.parameters as any)?.credentialsId;
  if (credentialsId) {
    try {
      const db = getDatabase();
      const [cred] = await db.select().from(credentials).where(eq(credentials.id, credentialsId)).limit(1);
      if (cred) {
        const decrypted = decryptData(cred.dataEncrypted);
        const parsed = JSON.parse(decrypted);
        return parsed.botToken || parsed.token || '';
      }
    } catch {
      // Игнорируем в автономном режиме
    }
  }

  // Проверка переданного токена напрямую или из workflowContext
  return (
    (context.parameters as any)?.botToken ||
    (context.workflowContext as any)?.telegramBotToken ||
    process.env.TELEGRAM_BOT_TOKEN ||
    ''
  );
}

// Хелпер подстановки строковых шаблонов вида {{variable}}
function interpolateString(template: string, data: Record<string, any>): string {
  if (!template || typeof template !== 'string') return template;
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const trimmed = key.trim();
    // Поддержка вложенных ключей: a.b.c
    const parts = trimmed.split('.');
    let val: any = data;
    for (const part of parts) {
      if (val && typeof val === 'object' && part in val) {
        val = val[part];
      } else {
        return `{{${trimmed}}}`;
      }
    }
    return val !== undefined ? String(val) : '';
  });
}

// 1. Telegram Message Trigger Node
export class TelegramMessageTriggerNode extends BaseNodeDef {
  type = 'telegram-message-trigger';
  name = 'Telegram Message Trigger';
  description = 'Срабатывает при получении входящего сообщения в Telegram с фильтрацией по User ID и чатам';
  category = NodeCategory.TELEGRAM;
  icon = 'Send';
  color = '#0088CC';

  inputs: WorkflowPortDefinition[] = [];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Message', type: 'main', description: 'Данные входящего сообщения' },
  ];

  parameterSchema = TelegramMessageTriggerParametersSchema;
  defaultParameters = {
    chatTypes: ['private'],
    requireText: true,
    allowedUserIds: [] as (string | number)[],
    allowedChatIds: [] as (string | number)[],
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const input = (context as any).inputData ?? (context as any).input ?? {};
    const params = context.parameters || {};

    const message = input.message || input;
    const fromId = message.from?.id;
    const chatId = message.chat?.id;

    // Проверка прав доступа по User ID и Chat ID
    const isAllowed = isAuthorizedTelegramSender(
      fromId,
      chatId,
      params.allowedUserIds || this.defaultParameters.allowedUserIds,
      params.allowedChatIds || this.defaultParameters.allowedChatIds
    );

    if (!isAllowed) {
      context.log?.(`[Telegram Security] Сообщение от пользователя ${fromId} в чате ${chatId} отклонено политикой allowlist.`);
      return {
        outputData: null,
        output: null,
        selectedPort: 'main',
      };
    }

    const payload = {
      messageId: message.message_id,
      text: message.text || message.caption || '',
      chatId: message.chat?.id,
      chatType: message.chat?.type,
      fromId: message.from?.id,
      fromUsername: message.from?.username,
      fromName: [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' '),
      date: message.date,
      hasDocument: !!message.document,
      document: message.document,
      rawMessage: message,
    };

    return {
      outputData: payload,
      output: payload,
      selectedPort: 'main',
    };
  }
}

// 2. Telegram Command Trigger Node
export class TelegramCommandTriggerNode extends BaseNodeDef {
  type = 'telegram-command-trigger';
  name = 'Telegram Command Trigger';
  description = 'Реагирует на указанную команду Telegram (например /start, /ask, /report)';
  category = NodeCategory.TELEGRAM;
  icon = 'Terminal';
  color = '#0088CC';

  inputs: WorkflowPortDefinition[] = [];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Command', type: 'main', description: 'Параметры вызванной команды' },
  ];

  parameterSchema = TelegramCommandTriggerParametersSchema;
  defaultParameters = {
    command: '/start',
    allowedUserIds: [] as (string | number)[],
    allowedChatIds: [] as (string | number)[],
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const input = (context as any).inputData ?? (context as any).input ?? {};
    const params = context.parameters || {};
    const expectedCmd = (params.command || this.defaultParameters.command).toLowerCase().trim();

    const message = input.message || input;
    const text = (message.text || '').trim();
    const [receivedCmd, ...cmdArgs] = text.split(/\s+/);

    if (receivedCmd?.toLowerCase() !== expectedCmd && !receivedCmd?.toLowerCase().startsWith(`${expectedCmd}@`)) {
      return { outputData: null, output: null, selectedPort: 'main' };
    }

    const fromId = message.from?.id;
    const chatId = message.chat?.id;

    if (!isAuthorizedTelegramSender(fromId, chatId, params.allowedUserIds, params.allowedChatIds)) {
      context.log?.(`[Telegram Security] Команда ${expectedCmd} от пользователя ${fromId} отклонена (allowlist).`);
      return { outputData: null, output: null, selectedPort: 'main' };
    }

    const payload = {
      command: expectedCmd,
      commandArgs: cmdArgs.join(' '),
      argumentsList: cmdArgs,
      chatId: message.chat?.id,
      fromId: message.from?.id,
      fromUsername: message.from?.username,
      messageId: message.message_id,
      rawMessage: message,
    };

    return {
      outputData: payload,
      output: payload,
      selectedPort: 'main',
    };
  }
}

// 3. Telegram Send Message Node
export class TelegramSendMessageNode extends BaseNodeDef {
  type = 'telegram-send-message';
  name = 'Telegram Send Message';
  description = 'Отправка форматированного сообщения в чат Telegram с поддержкой inline кнопок';
  category = NodeCategory.TELEGRAM;
  icon = 'Send';
  color = '#0088CC';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Данные для формирования сообщения' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Sent Message', type: 'main', description: 'Результат отправки сообщения' },
  ];

  parameterSchema = TelegramSendMessageParametersSchema;
  defaultParameters = {
    chatId: '',
    text: '',
    parseMode: 'Markdown' as const,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const input = (context as any).inputData ?? (context as any).input ?? {};
    const fullContext = { ...context.workflowContext, ...input };

    const token = await resolveBotToken(context);
    if (!token) {
      throw new Error('[Telegram Send Message] Не настроен Bot Token. Добавьте учетные данные Telegram.');
    }

    const rawChatId = params.chatId || input.chatId;
    const targetChatId = typeof rawChatId === 'string'
      ? interpolateString(rawChatId, fullContext)
      : rawChatId;

    if (!targetChatId) {
      throw new Error('[Telegram Send Message] Не указан Chat ID для отправки.');
    }

    const rawText = params.text || input.text || input.response || input.output;
    const textToSend = interpolateString(rawText || '', fullContext);

    if (!textToSend.trim()) {
      throw new Error('[Telegram Send Message] Текст сообщения не может быть пустым.');
    }

    const api = new TelegramApi(token);
    const sent = await api.sendMessage({
      chatId: targetChatId,
      text: textToSend,
      parseMode: params.parseMode || this.defaultParameters.parseMode,
      replyToMessageId: params.replyToMessageId || input.replyToMessageId,
      inlineKeyboard: params.inlineKeyboard,
    });

    context.log?.(`[Telegram] Сообщение успешно отправлено в чат ${targetChatId} (msg_id: ${sent.message_id})`);

    const result = {
      success: true,
      sentMessageId: sent.message_id,
      chatId: sent.chat.id,
      text: sent.text,
      date: sent.date,
    };

    return {
      outputData: result,
      output: result,
      selectedPort: 'main',
    };
  }
}

// 4. Telegram Send Document Node
export class TelegramSendDocumentNode extends BaseNodeDef {
  type = 'telegram-send-document';
  name = 'Telegram Send Document';
  description = 'Отправка документов, файлов и отчетов в чат Telegram';
  category = NodeCategory.TELEGRAM;
  icon = 'FileUp';
  color = '#0088CC';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Данные документа' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Sent Document', type: 'main', description: 'Результат отправки документа' },
  ];

  parameterSchema = TelegramSendDocumentParametersSchema;
  defaultParameters = {
    chatId: '',
    caption: '',
    filename: 'document.pdf',
    parseMode: 'Markdown' as const,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const input = (context as any).inputData ?? (context as any).input ?? {};
    const fullContext = { ...context.workflowContext, ...input };

    const token = await resolveBotToken(context);
    if (!token) {
      throw new Error('[Telegram Send Document] Не настроен Bot Token.');
    }

    const rawChatId = params.chatId || input.chatId;
    const targetChatId = typeof rawChatId === 'string'
      ? interpolateString(rawChatId, fullContext)
      : rawChatId;

    const caption = params.caption ? interpolateString(params.caption, fullContext) : undefined;
    const filename = params.filename || input.filename || 'report.txt';
    const documentUrl = params.documentUrl || input.documentUrl || input.url;
    const documentBase64 = params.documentBase64 || input.documentBase64 || input.contentBase64;

    const api = new TelegramApi(token);
    const sent = await api.sendDocument({
      chatId: targetChatId,
      caption,
      filename,
      documentUrl,
      documentBase64,
      parseMode: params.parseMode,
    });

    const result = {
      success: true,
      sentMessageId: sent.message_id,
      documentId: sent.document?.file_id,
      chatId: sent.chat.id,
    };

    return {
      outputData: result,
      output: result,
      selectedPort: 'main',
    };
  }
}
