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

/**
 * Опасные пути хоста, монтирование которых в Docker контейнер категорически запрещено.
 */
const FORBIDDEN_HOST_MOUNT_PATTERNS = [
  /^\/?var\/run\/docker\.sock/i,
  /docker\.sock/i,
  /^\/?etc/i,
  /^\/?proc/i,
  /^\/?sys/i,
  /^\/?dev/i,
  /^\/?root/i,
  /^\/?home/i,
  /^[a-zA-Z]:\\windows/i,
  /^[a-zA-Z]:\\program files/i,
  /^[a-zA-Z]:\\users\\professional\\\.ssh/i,
  /^[a-zA-Z]:\\users\\professional\\\.aws/i,
  /^[a-zA-Z]:\\$/i,
  /^\/$/i,
];

/**
 * Валидатор и изолятор для Docker-контейнеров MCP.
 */
export class DockerContainerSecurityValidator {
  public static validateAndHardenArgs(rawArgs: string[]): string[] {
    if (rawArgs.length === 1 && (rawArgs[0] === '--version' || rawArgs[0] === '-v')) {
      return rawArgs;
    }

    if (rawArgs.length === 0 || rawArgs[0] !== 'run') {
      throw new MCPSecurityError('Для запуска MCP через Docker разрешена только подкоманда "docker run".');
    }

    const hasArg = (prefix: string, shortForm?: string) =>
      rawArgs.some((a) => a === prefix || a.startsWith(prefix + '=') || (shortForm ? a === shortForm || a.startsWith(shortForm + '=') : false));

    // 1. Запрет суперпользовательских и небезопасных режимов
    if (hasArg('--privileged')) {
      throw new MCPSecurityError('Запуск контейнера в privileged режиме строго запрещен.');
    }
    if (rawArgs.some((a) => a === '--net=host' || a === '--network=host' || ((a === '--net' || a === '--network') && rawArgs[rawArgs.indexOf(a) + 1] === 'host'))) {
      throw new MCPSecurityError('Использование host network в Docker MCP строго запрещено (SSRF / изоляция).');
    }
    if (rawArgs.some((a) => a === '--pid=host' || a === '--ipc=host' || ((a === '--pid' || a === '--ipc') && rawArgs[rawArgs.indexOf(a) + 1] === 'host'))) {
      throw new MCPSecurityError('Использование namespace хоста (pid/ipc) строго запрещено.');
    }

    // 2. Проверка монтирований volumes (-v или --volume)
    for (let i = 0; i < rawArgs.length; i++) {
      const arg = rawArgs[i];
      let mountSpec = '';
      if (arg === '-v' || arg === '--volume') {
        mountSpec = rawArgs[i + 1] || '';
      } else if (arg.startsWith('-v=') || arg.startsWith('--volume=')) {
        mountSpec = arg.split('=')[1] || '';
      }

      if (mountSpec) {
        const hostPath = mountSpec.split(':')[0]?.trim() || '';
        for (const pattern of FORBIDDEN_HOST_MOUNT_PATTERNS) {
          if (pattern.test(hostPath) || pattern.test(mountSpec)) {
            throw new MCPSecurityError(
              `Монтирование критического пути хост-системы "${hostPath}" в Docker MCP запрещено.`
            );
          }
        }
      }
    }

    // 3. Формируем безопасный набор аргументов
    const hardened: string[] = ['run', '-i', '--rm'];
    hardened.push('--security-opt=no-new-privileges');
    hardened.push('--cap-drop=ALL');

    if (!hasArg('--memory', '-m')) {
      hardened.push('--memory=512m');
    }
    if (!hasArg('--cpus')) {
      hardened.push('--cpus=1.0');
    }
    if (!hasArg('--pids-limit')) {
      hardened.push('--pids-limit=100');
    }
    if (!hasArg('--user', '-u')) {
      hardened.push('--user=1000:1000');
    }

    // Копируем пользовательские аргументы, исключая базовые команды
    for (let i = 1; i < rawArgs.length; i++) {
      const arg = rawArgs[i];
      if (arg === 'run' || arg === '-i' || arg === '--rm') continue;
      hardened.push(arg);
    }

    return hardened;
  }
}

/**
 * Локальная песочница безопасности Stdio MCP.
 */
export class LocalMCPSandbox {
  /**
   * Валидирует команду и аргументы для запуска локального MCP-сервера.
   * Блокирует shell injection, path traversal и произвольный запуск программ.
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

    // Валидация аргументов на спецсимволы shell инъекции
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

    // Для docker применяем строгий аудит флагов безопасности контейнера
    let finalArgs = sanitizedArgs;
    if (baseName === 'docker') {
      finalArgs = DockerContainerSecurityValidator.validateAndHardenArgs(sanitizedArgs);
    }

    return {
      sanitizedCommand: baseName,
      sanitizedArgs: finalArgs,
    };
  }

  /**
   * Формирует изолированное окружение (env), исключая секреты хост-системы.
   */
  public static buildSanitizedEnv(customEnv?: Record<string, string>): Record<string, string> {
    const safeEnv: Record<string, string> = {};

    // Разрешенные системные переменные хоста
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

    // Примешиваем пользовательские переменные, отфильтровывая запрещенные секреты
    if (customEnv) {
      for (const [k, v] of Object.entries(customEnv)) {
        const upper = k.toUpperCase();
        if (FORBIDDEN_ENV_VARS.has(upper)) {
          continue; // Блокируем утечку секретов платформы
        }
        if (typeof v === 'string') {
          safeEnv[k] = v;
        }
      }
    }

    return safeEnv;
  }
}
