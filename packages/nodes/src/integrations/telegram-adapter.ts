export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  date: number;
  chat: TelegramChat;
  text?: string;
  caption?: string;
  document?: {
    file_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
  photo?: Array<{
    file_id: string;
    file_size?: number;
    width: number;
    height: number;
  }>;
  reply_to_message?: TelegramMessage;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: TelegramUser;
    message?: TelegramMessage;
    data?: string;
  };
}

export interface TelegramSendOptions {
  chatId: string | number;
  text: string;
  parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
  replyToMessageId?: number;
  inlineKeyboard?: Array<Array<{ text: string; callback_data?: string; url?: string }>>;
}

export class TelegramApi {
  private baseUrl: string;

  constructor(private botToken: string) {
    if (!botToken || !botToken.includes(':')) {
      throw new Error('[Telegram API] Некорректный формат токена Telegram бота.');
    }
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  /**
   * Проверка токена бота и получение информации об аккаунте
   */
  public async getMe(): Promise<TelegramUser> {
    const res = await fetch(`${this.baseUrl}/getMe`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`[Telegram getMe Error ${res.status}] ${errBody}`);
    }

    const data = await res.json() as any;
    if (!data.ok) {
      throw new Error(`[Telegram Error] ${data.description || 'Не удалось проверить токен'}`);
    }

    return data.result as TelegramUser;
  }

  /**
   * Отправка текстового сообщения
   */
  public async sendMessage(options: TelegramSendOptions): Promise<TelegramMessage> {
    const payload: Record<string, any> = {
      chat_id: options.chatId,
      text: options.text,
    };

    if (options.parseMode) {
      payload.parse_mode = options.parseMode;
    }
    if (options.replyToMessageId) {
      payload.reply_to_message_id = options.replyToMessageId;
    }
    if (options.inlineKeyboard && options.inlineKeyboard.length > 0) {
      payload.reply_markup = {
        inline_keyboard: options.inlineKeyboard,
      };
    }

    const res = await fetch(`${this.baseUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`[Telegram sendMessage Error ${res.status}] ${errBody}`);
    }

    const data = await res.json() as any;
    if (!data.ok) {
      throw new Error(`[Telegram Error] ${data.description || 'Ошибка отправки сообщения'}`);
    }

    return data.result as TelegramMessage;
  }

  /**
   * Отправка документа или файла
   */
  public async sendDocument(params: {
    chatId: string | number;
    caption?: string;
    parseMode?: string;
    filename?: string;
    documentUrl?: string;
    documentBase64?: string;
  }): Promise<TelegramMessage> {
    const formData = new FormData();
    formData.append('chat_id', String(params.chatId));

    if (params.caption) {
      formData.append('caption', params.caption);
    }
    if (params.parseMode) {
      formData.append('parse_mode', params.parseMode);
    }

    if (params.documentBase64) {
      const buffer = Buffer.from(params.documentBase64, 'base64');
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      formData.append('document', blob, params.filename || 'document.dat');
    } else if (params.documentUrl) {
      formData.append('document', params.documentUrl);
    } else {
      throw new Error('[Telegram sendDocument] Необходимо указать documentUrl или documentBase64.');
    }

    const res = await fetch(`${this.baseUrl}/sendDocument`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`[Telegram sendDocument Error ${res.status}] ${errBody}`);
    }

    const data = await res.json() as any;
    if (!data.ok) {
      throw new Error(`[Telegram Error] ${data.description || 'Ошибка отправки документа'}`);
    }

    return data.result as TelegramMessage;
  }

  /**
   * Получение обновлений (Long Polling)
   */
  public async getUpdates(offset?: number, limit = 100, timeout = 30): Promise<TelegramUpdate[]> {
    const params = new URLSearchParams({
      limit: String(limit),
      timeout: String(timeout),
    });
    if (offset !== undefined) {
      params.append('offset', String(offset));
    }

    const res = await fetch(`${this.baseUrl}/getUpdates?${params.toString()}`, {
      method: 'GET',
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`[Telegram getUpdates Error ${res.status}] ${err}`);
    }

    const data = await res.json() as any;
    if (!data.ok) {
      throw new Error(`[Telegram Error] ${data.description || 'Ошибка получения обновлений'}`);
    }

    return data.result as TelegramUpdate[];
  }
}

/**
 * Проверка прав доступа входящего сообщения по User ID и Chat ID
 */
export function isAuthorizedTelegramSender(
  fromId: string | number | undefined,
  chatId: string | number | undefined,
  allowedUserIds: (string | number)[] = [],
  allowedChatIds: (string | number)[] = []
): boolean {
  // Если белые списки не заданы, разрешаем доступ владельцу
  const hasUserFilter = allowedUserIds.length > 0;
  const hasChatFilter = allowedChatIds.length > 0;

  if (!hasUserFilter && !hasChatFilter) {
    return true;
  }

  const isUserAllowed = hasUserFilter && fromId !== undefined
    ? allowedUserIds.map(String).includes(String(fromId))
    : false;

  const isChatAllowed = hasChatFilter && chatId !== undefined
    ? allowedChatIds.map(String).includes(String(chatId))
    : false;

  return isUserAllowed || isChatAllowed;
}

/**
 * Singleton-менеджер Long Polling для устранения конфликтов getUpdates
 */
export class TelegramPollingManager {
  private static activePollers = new Map<string, { abortController: AbortController; isRunning: boolean }>();

  public static isPolling(botToken: string): boolean {
    return this.activePollers.has(botToken);
  }

  public static stopPolling(botToken: string): void {
    const existing = this.activePollers.get(botToken);
    if (existing) {
      existing.abortController.abort();
      this.activePollers.delete(botToken);
    }
  }

  public static stopAll(): void {
    for (const [token, poller] of this.activePollers.entries()) {
      poller.abortController.abort();
    }
    this.activePollers.clear();
  }

  public static startPolling(
    botToken: string,
    onUpdate: (update: TelegramUpdate) => Promise<void> | void,
    onError?: (err: Error) => void
  ): void {
    // Если уже запущен полинг для этого бота, останавливаем предыдущий во избежание конфликта
    if (this.activePollers.has(botToken)) {
      this.stopPolling(botToken);
    }

    const abortController = new AbortController();
    this.activePollers.set(botToken, { abortController, isRunning: true });

    const api = new TelegramApi(botToken);
    let offset = 0;

    (async () => {
      while (!abortController.signal.aborted) {
        try {
          const updates = await api.getUpdates(offset, 100, 20);
          for (const update of updates) {
            if (abortController.signal.aborted) break;
            offset = update.update_id + 1;
            try {
              await onUpdate(update);
            } catch (handleErr: any) {
              onError?.(handleErr);
            }
          }
        } catch (pollErr: any) {
          if (abortController.signal.aborted) break;
          onError?.(pollErr);
          // Задержка перед повторной попыткой при ошибке сети
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
    })();
  }
}
