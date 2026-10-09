export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  bot?: boolean;
}

export interface DiscordMessage {
  id: string;
  channel_id: string;
  content: string;
  author: DiscordUser;
  timestamp: string;
}

export class DiscordApi {
  private baseUrl = 'https://discord.com/api/v10';

  constructor(private botToken: string) {
    if (!botToken) {
      throw new Error('[Discord API] Не указан токен Discord бота.');
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bot ${this.botToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'DiscordBot (NeuroFlow, 1.0)',
    };
  }

  /**
   * Проверка токена и получение профиля бота
   */
  public async getBotUser(): Promise<DiscordUser> {
    const res = await fetch(`${this.baseUrl}/users/@me`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`[Discord getBotUser Error ${res.status}] ${err}`);
    }

    return await res.json() as DiscordUser;
  }

  /**
   * Отправка сообщения в канал Discord
   */
  public async sendMessage(params: {
    channelId: string;
    content: string;
    embeds?: Array<{
      title?: string;
      description?: string;
      color?: number;
      fields?: Array<{ name: string; value: string; inline?: boolean }>;
    }>;
  }): Promise<DiscordMessage> {
    const payload: Record<string, any> = {
      content: params.content,
    };

    if (params.embeds && params.embeds.length > 0) {
      payload.embeds = params.embeds;
    }

    const res = await fetch(`${this.baseUrl}/channels/${params.channelId}/messages`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`[Discord sendMessage Error ${res.status}] ${err}`);
    }

    return await res.json() as DiscordMessage;
  }
}

/**
 * Проверка разрешенных серверов (Guilds) и каналов Discord
 */
export function isAuthorizedDiscordChannel(
  channelId: string | undefined,
  guildId: string | undefined,
  allowedChannelIds: string[] = [],
  allowedGuildIds: string[] = []
): boolean {
  const hasChannelFilter = allowedChannelIds.length > 0;
  const hasGuildFilter = allowedGuildIds.length > 0;

  if (!hasChannelFilter && !hasGuildFilter) {
    return true;
  }

  const isChannelAllowed = hasChannelFilter && channelId
    ? allowedChannelIds.includes(channelId)
    : false;

  const isGuildAllowed = hasGuildFilter && guildId
    ? allowedGuildIds.includes(guildId)
    : false;

  return isChannelAllowed || isGuildAllowed;
}
