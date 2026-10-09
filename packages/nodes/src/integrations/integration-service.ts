import { IntegrationServiceType } from '@neuroflow/shared';
import { TelegramApi } from './telegram-adapter.js';
import { GitHubApi } from './github-adapter.js';
import { DiscordApi } from './discord-adapter.js';
import { FilesystemSandbox } from './filesystem-sandbox.js';

export interface TestConnectionResult {
  success: boolean;
  message: string;
  details?: Record<string, any>;
}

export class IntegrationService {
  /**
   * Проверка подключения внешнего сервиса (Test Connection)
   */
  public static async testConnection(
    serviceType: IntegrationServiceType,
    credentialData: Record<string, any> = {},
    settings: Record<string, any> = {}
  ): Promise<TestConnectionResult> {
    try {
      switch (serviceType) {
        case 'telegram': {
          const botToken = credentialData.botToken || credentialData.token;
          if (!botToken) {
            return { success: false, message: 'Отсутствует Bot Token в учетных данных.' };
          }
          const api = new TelegramApi(botToken);
          const me = await api.getMe();
          return {
            success: true,
            message: `Подключение успешно! Бот: @${me.username || me.first_name} (ID: ${me.id})`,
            details: {
              botId: me.id,
              username: me.username,
              firstName: me.first_name,
            },
          };
        }

        case 'github': {
          const token = credentialData.personalAccessToken || credentialData.token;
          if (!token) {
            return { success: false, message: 'Отсутствует Personal Access Token в учетных данных.' };
          }
          const api = new GitHubApi(token);
          const user = await api.getUser();
          return {
            success: true,
            message: `Подключение успешно! Аккаунт: ${user.login} (${user.name || 'GitHub User'})`,
            details: {
              login: user.login,
              id: user.id,
              name: user.name,
            },
          };
        }

        case 'discord': {
          const botToken = credentialData.botToken || credentialData.token;
          if (!botToken) {
            return { success: false, message: 'Отсутствует Discord Bot Token в учетных данных.' };
          }
          const api = new DiscordApi(botToken);
          const botUser = await api.getBotUser();
          return {
            success: true,
            message: `Подключение успешно! Discord Бот: ${botUser.username}#${botUser.discriminator}`,
            details: {
              botId: botUser.id,
              username: botUser.username,
            },
          };
        }

        case 'filesystem': {
          const allowedRoots = settings.allowedRootPaths || ['./data/storage'];
          const sandbox = new FilesystemSandbox(allowedRoots, settings.maxFileSizeMb || 25);
          // Проверяем доступность чтения корневой директории
          const list = await sandbox.listDirectory('.');
          return {
            success: true,
            message: `Файловая песочница доступна! Разрешенные пути: ${allowedRoots.join(', ')} (файлов в корне: ${list.length})`,
            details: {
              allowedRoots,
              filesCount: list.length,
            },
          };
        }

        case 'webhook': {
          return {
            success: true,
            message: 'Webhook готов к приему входящих запросов.',
          };
        }

        default:
          return {
            success: false,
            message: `Неподдерживаемый тип сервиса: ${serviceType}`,
          };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Ошибка проверки подключения: ${err.message}`,
      };
    }
  }
}
