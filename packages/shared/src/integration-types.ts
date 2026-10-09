import { z } from 'zod';

export type IntegrationServiceType = 'telegram' | 'discord' | 'github' | 'filesystem' | 'webhook';

export type IntegrationStatus = 'connected' | 'error' | 'disconnected';

export interface IntegrationCatalogItem {
  serviceType: IntegrationServiceType;
  name: string;
  description: string;
  icon: string;
  category: string;
  credentialFields: Array<{
    key: string;
    label: string;
    type: 'text' | 'password';
    required: boolean;
    placeholder?: string;
    helpText?: string;
  }>;
  availableTriggers: Array<{
    id: string;
    name: string;
    description: string;
    nodeType: string;
  }>;
  availableActions: Array<{
    id: string;
    name: string;
    description: string;
    nodeType: string;
  }>;
}

export const INTEGRATION_CATALOG: IntegrationCatalogItem[] = [
  {
    serviceType: 'telegram',
    name: 'Telegram Bot',
    description: 'Интеграция с Telegram Bot API: отправка и получение сообщений, команд, документов с поддержкой AI-агентов.',
    icon: 'Send',
    category: 'Communication',
    credentialFields: [
      {
        key: 'botToken',
        label: 'Bot Token',
        type: 'password',
        required: true,
        placeholder: '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ',
        helpText: 'Получите токен у @BotFather в Telegram',
      },
    ],
    availableTriggers: [
      {
        id: 'telegram-message-trigger',
        name: 'Telegram Message Trigger',
        description: 'Срабатывает при получении нового входящего сообщения в чате или группе.',
        nodeType: 'telegram-message-trigger',
      },
      {
        id: 'telegram-command-trigger',
        name: 'Telegram Command Trigger',
        description: 'Срабатывает при получении команды (например /start, /ask, /summary).',
        nodeType: 'telegram-command-trigger',
      },
    ],
    availableActions: [
      {
        id: 'telegram-send-message',
        name: 'Telegram Send Message',
        description: 'Отправка текстового сообщения с Markdown/HTML разметкой и inline кнопками.',
        nodeType: 'telegram-send-message',
      },
      {
        id: 'telegram-send-document',
        name: 'Telegram Send Document',
        description: 'Отправка файла, отчета или документа в чат Telegram.',
        nodeType: 'telegram-send-document',
      },
    ],
  },
  {
    serviceType: 'github',
    name: 'GitHub',
    description: 'Подключение вашего аккаунта GitHub: отслеживание событий push/PR/issues и автоматизация задач.',
    icon: 'Github',
    category: 'Developer Tools',
    credentialFields: [
      {
        key: 'personalAccessToken',
        label: 'Personal Access Token (PAT)',
        type: 'password',
        required: true,
        placeholder: 'ghp_...',
        helpText: 'Токен GitHub с минимально необходимыми правами (repo, read:user)',
      },
      {
        key: 'webhookSecret',
        label: 'Webhook Secret (опционально)',
        type: 'password',
        required: false,
        placeholder: 'Секретная строка для валидации HMAC подписей',
        helpText: 'Используется для проверки подлинности вебхуков от GitHub',
      },
    ],
    availableTriggers: [
      {
        id: 'github-event-trigger',
        name: 'GitHub Event Trigger',
        description: 'Прием событий репозитория (push, issue, pull_request) с верификацией HMAC SHA-256.',
        nodeType: 'github-event-trigger',
      },
    ],
    availableActions: [
      {
        id: 'github-get-issue',
        name: 'GitHub Get Issue',
        description: 'Получение деталей, комментариев и статуса задачи в репозитории.',
        nodeType: 'github-get-issue',
      },
      {
        id: 'github-create-issue',
        name: 'GitHub Create Issue',
        description: 'Создание новой задачи (issue) с метками и описанием.',
        nodeType: 'github-create-issue',
      },
    ],
  },
  {
    serviceType: 'discord',
    name: 'Discord Bot',
    description: 'Интеграция с Discord: отправка сообщений и вложений в каналы, обработка команд сообщества.',
    icon: 'MessageSquare',
    category: 'Communication',
    credentialFields: [
      {
        key: 'botToken',
        label: 'Discord Bot Token',
        type: 'password',
        required: true,
        placeholder: 'OTM... (Discord Developer Portal)',
        helpText: 'Bot токен из Discord Developer Portal',
      },
    ],
    availableTriggers: [
      {
        id: 'discord-trigger',
        name: 'Discord Message Trigger',
        description: 'Срабатывает при получении нового сообщения в разрешенном канале.',
        nodeType: 'discord-trigger',
      },
    ],
    availableActions: [
      {
        id: 'discord-send-message',
        name: 'Discord Send Message',
        description: 'Отправка сообщения или embed в указанный канал Discord.',
        nodeType: 'discord-send-message',
      },
    ],
  },
  {
    serviceType: 'filesystem',
    name: 'Personal Filesystem',
    description: 'Безопасная работа с файлами на диске в изолированных доверенных директориях.',
    icon: 'Folder',
    category: 'Storage',
    credentialFields: [],
    availableTriggers: [
      {
        id: 'file-changed-trigger',
        name: 'File Changed Trigger',
        description: 'Срабатывает при создании, модификации или удалении файлов в отслеживаемой папке.',
        nodeType: 'file-changed-trigger',
      },
    ],
    availableActions: [
      {
        id: 'read-file',
        name: 'Read File',
        description: 'Чтение содержимого файла (JSON, TXT, Markdown, CSV, Base64).',
        nodeType: 'read-file',
      },
      {
        id: 'write-file',
        name: 'Write File',
        description: 'Запись или дозапись данных в файл с защитой от Path Traversal.',
        nodeType: 'write-file',
      },
      {
        id: 'list-directory',
        name: 'List Directory',
        description: 'Получение списка файлов и поддиректорий в разрешенной папке.',
        nodeType: 'list-directory',
      },
    ],
  },
];

// Zod-схемы для валидации настроек интеграций
export const TelegramSettingsSchema = z.object({
  allowedUserIds: z.array(z.union([z.string(), z.number()])).default([]),
  allowedChatIds: z.array(z.union([z.string(), z.number()])).default([]),
  pollingMode: z.enum(['polling', 'webhook']).default('polling'),
  webhookUrl: z.string().optional(),
  botUsername: z.string().optional(),
});
export type TelegramSettings = z.infer<typeof TelegramSettingsSchema>;

export const DiscordSettingsSchema = z.object({
  allowedGuildIds: z.array(z.string()).default([]),
  allowedChannelIds: z.array(z.string()).default([]),
  botName: z.string().optional(),
});
export type DiscordSettings = z.infer<typeof DiscordSettingsSchema>;

export const GitHubSettingsSchema = z.object({
  defaultOwner: z.string().optional(),
  defaultRepo: z.string().optional(),
  webhookSecret: z.string().optional(),
});
export type GitHubSettings = z.infer<typeof GitHubSettingsSchema>;

export const FilesystemSettingsSchema = z.object({
  allowedRootPaths: z.array(z.string()).default(['./data/storage']),
  maxFileSizeMb: z.number().default(25),
  readOnly: z.boolean().default(false),
});
export type FilesystemSettings = z.infer<typeof FilesystemSettingsSchema>;
