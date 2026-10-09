import { BaseNodeDef, NodeExecutionContext, NodeExecutionOutput } from '../base.js';
import {
  NodeCategory,
  WorkflowPortDefinition,
  DiscordTriggerParametersSchema,
  DiscordSendMessageParametersSchema,
} from '@neuroflow/shared';
import { DiscordApi, isAuthorizedDiscordChannel } from '../integrations/discord-adapter.js';
import { getDatabase, credentials, eq, decryptData } from '@neuroflow/database';

async function resolveDiscordToken(context: NodeExecutionContext): Promise<string> {
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
      // Игнорируем в тестах
    }
  }

  return (
    (context.parameters as any)?.botToken ||
    (context.workflowContext as any)?.discordBotToken ||
    process.env.DISCORD_BOT_TOKEN ||
    ''
  );
}

function interpolateString(template: string, data: Record<string, any>): string {
  if (!template || typeof template !== 'string') return template;
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const trimmed = key.trim();
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

// 1. Discord Trigger Node
export class DiscordTriggerNode extends BaseNodeDef {
  type = 'discord-trigger';
  name = 'Discord Message Trigger';
  description = 'Срабатывает при получении входящего сообщения в Discord с фильтрацией каналов и серверов';
  category = NodeCategory.DISCORD;
  icon = 'MessageSquare';
  color = '#5865F2';

  inputs: WorkflowPortDefinition[] = [];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Message', type: 'main', description: 'Данные входящего сообщения Discord' },
  ];

  parameterSchema = DiscordTriggerParametersSchema;
  defaultParameters = {
    channelIds: [] as string[],
    guildIds: [] as string[],
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const input = (context as any).inputData ?? (context as any).input ?? {};
    const params = context.parameters || {};

    const channelId = input.channel_id || input.channelId;
    const guildId = input.guild_id || input.guildId;

    if (!isAuthorizedDiscordChannel(channelId, guildId, params.channelIds, params.guildIds)) {
      context.log?.(`[Discord Security] Сообщение из канала ${channelId} отклонено политикой allowlist.`);
      return { outputData: null, output: null, selectedPort: 'main' };
    }

    const content = input.content || '';
    if (params.requirePrefix && !content.startsWith(params.requirePrefix)) {
      return { outputData: null, output: null, selectedPort: 'main' };
    }

    const payload = {
      id: input.id,
      content,
      channelId,
      guildId,
      authorId: input.author?.id,
      authorUsername: input.author?.username,
      isBot: input.author?.bot || false,
      timestamp: input.timestamp,
      raw: input,
    };

    return {
      outputData: payload,
      output: payload,
      selectedPort: 'main',
    };
  }
}

// 2. Discord Send Message Node
export class DiscordSendMessageNode extends BaseNodeDef {
  type = 'discord-send-message';
  name = 'Discord Send Message';
  description = 'Отправка сообщения или вложений в канал Discord';
  category = NodeCategory.DISCORD;
  icon = 'Send';
  color = '#5865F2';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Данные для отправки' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Sent Message', type: 'main', description: 'Результат отправки в Discord' },
  ];

  parameterSchema = DiscordSendMessageParametersSchema;
  defaultParameters = {
    channelId: '',
    content: '',
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const input = (context as any).inputData ?? (context as any).input ?? {};
    const fullContext = { ...context.workflowContext, ...input };

    const token = await resolveDiscordToken(context);
    if (!token) {
      throw new Error('[Discord Send Message] Отсутствует Discord Bot Token.');
    }

    const rawChannelId = params.channelId || input.channelId || input.channel_id;
    const targetChannelId = typeof rawChannelId === 'string'
      ? interpolateString(rawChannelId, fullContext)
      : rawChannelId;

    if (!targetChannelId) {
      throw new Error('[Discord Send Message] Не указан Channel ID.');
    }

    const rawContent = params.content || input.content || input.text || input.response;
    const contentToSend = interpolateString(rawContent || '', fullContext);

    if (!contentToSend.trim() && !params.embeds) {
      throw new Error('[Discord Send Message] Содержимое сообщения не может быть пустым.');
    }

    const api = new DiscordApi(token);
    const sent = await api.sendMessage({
      channelId: targetChannelId,
      content: contentToSend,
      embeds: params.embeds,
    });

    context.log?.(`[Discord] Сообщение отправлено в канал ${targetChannelId} (msg_id: ${sent.id})`);

    const result = {
      success: true,
      messageId: sent.id,
      channelId: sent.channel_id,
      content: sent.content,
    };

    return {
      outputData: result,
      output: result,
      selectedPort: 'main',
    };
  }
}
