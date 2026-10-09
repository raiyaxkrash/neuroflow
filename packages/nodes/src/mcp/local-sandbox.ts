import path from 'node:path';

export class MCPSecurityError extends Error {
  constructor(message: string) {
    super(`[MCP Security] ${message}`);
    this.name = 'MCPSecurityError';
  }
}

/**
 * Белый список исполняемых файлов для Stdio-транспорта MCP.
 * Запуск произвольных shell-скриптов и системных утилит строго запрещен.
 */
export const ALLOWED_MCP_COMMANDS = new Set([
  'node',
  'npx',
  'python',
  'python3',
  'py',
  'uvx',
  'docker',
]);

/**
 * Переменные окружения платформы, которые НИКОГДА не должны попадать
 * в дочерний процесс MCP сервера (утечка секретов ядра).
 */
export const FORBIDDEN_ENV_VARS = new Set([
  'DATABASE_URL',
  'REDIS_URL',
  'ADMIN_PASSWORD',
  'JWT_SECRET',
  'SESSION_SECRET',
  'ENCRYPTION_KEY',
  'NEUROFLOW_SECRET',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
]);

const DANGEROUS_CHARS_REGEX = /[;&|><`$\r\n\0]/;

export class LocalMCPSandbox {
  /**
   * Валидирует команду и аргументы для запуска локального MCP-сервера.
   */
  public static validateCommand(
    command: string,
    args: string[] = []
  ): { sanitizedCommand: string; sanitizedArgs: string[] } {
    if (!command || typeof command !== 'string') {
      throw new MCPSecurityError('Команда MCP сервера не указана или не является строкой.');
    }

    const trimmedCommand = command.trim();
    if (DANGEROUS_CHARS_REGEX.test(trimmedCommand)) {
      throw new MCPSecurityError(`Команда содержит запрещенные символы shell-инъекции: "${trimmedCommand}"`);
    }

    // Запрет относительных и абсолютных путей для защиты от path traversal
    if (trimmedCommand.includes('/') || trimmedCommand.includes('\\')) {
      throw new MCPSecurityError(
        `Указание путей к исполняемым файлам запрещено для предотвращения path traversal: "${trimmedCommand}"`
      );
    }

    // Извлекаем имя бинарника без расширений
    const baseName = trimmedCommand.toLowerCase().replace(/\.(exe|cmd|bat|ps1|sh)$/i, '');

    if (!ALLOWED_MCP_COMMANDS.has(baseName)) {
      throw new MCPSecurityError(
        `Команда "${trimmedCommand}" (${baseName}) запрещена. Разрешены только доверенные интерпретаторы: ${Array.from(ALLOWED_MCP_COMMANDS).join(', ')}`
      );
    }

    // Валидация аргументов
    const sanitizedArgs: string[] = [];
    for (const arg of args) {
      if (typeof arg !== 'string') {
        throw new MCPSecurityError(`Аргумент команды должен быть строкой, получено: ${typeof arg}`);
      }
      const trimmedArg = arg.trim();
      // Проверка на управляющие символы и инъекции
      if (DANGEROUS_CHARS_REGEX.test(trimmedArg)) {
        throw new MCPSecurityError(`Аргумент "${trimmedArg}" содержит запрещенные спецсимволы.`);
      }
      sanitizedArgs.push(trimmedArg);
    }

    return {
      sanitizedCommand: baseName,
      sanitizedArgs,
    };
  }

  /**
   * Формирует изолированное окружение (env), исключая секреты хост-системы.
   */
  public static buildSanitizedEnv(customEnv?: Record<string, string>): Record<string, string> {
    const safeEnv: Record<string, string> = {};

    // Разрешенные системные переменные
    const allowedSystemKeys = [
      'PATH',
      'Path',
      'SYSTEMROOT',
      'SystemRoot',
      'TEMP',
      'TMP',
      'USERPROFILE',
      'HOME',
      'LANG',
      'LC_ALL',
      'NODE_ENV',
      'APPDATA',
      'LOCALAPPDATA',
    ];

    for (const key of allowedSystemKeys) {
      if (process.env[key]) {
        safeEnv[key] = process.env[key]!;
      }
    }

    // Примешиваем пользовательские переменные, отфильтровывая запрещенные ключи
    if (customEnv) {
      for (const [k, v] of Object.entries(customEnv)) {
        const upper = k.toUpperCase();
        if (FORBIDDEN_ENV_VARS.has(upper)) {
          continue; // Блокируем утечку секретов
        }
        if (typeof v === 'string') {
          safeEnv[k] = v;
        }
      }
    }

    return safeEnv;
  }
}
