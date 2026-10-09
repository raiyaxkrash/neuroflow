import { describe, it, expect } from 'vitest';
import { LocalMCPSandbox, MCPSecurityError, FORBIDDEN_ENV_VARS } from '@neuroflow/nodes';

describe('Local MCP Security Sandbox', () => {
  it('разрешает безопасные команды из белого списка', () => {
    const validCommands = ['node', 'npx', 'python', 'python3', 'py', 'uvx', 'docker'];

    for (const cmd of validCommands) {
      const result = LocalMCPSandbox.validateCommand(cmd, ['--version']);
      expect(result.sanitizedCommand).toBe(cmd);
      expect(result.sanitizedArgs).toEqual(['--version']);
    }
  });

  it('блокирует недоверенные команды, shell-утилиты и path traversal', () => {
    const dangerousCommands = [
      'bash',
      'sh',
      'powershell',
      'cmd',
      'rm',
      'curl',
      'wget',
      '../../node',
      'C:\\Windows\\System32\\cmd.exe',
    ];

    for (const cmd of dangerousCommands) {
      expect(() => LocalMCPSandbox.validateCommand(cmd)).toThrow(MCPSecurityError);
    }
  });

  it('блокирует попытки shell injection в командах и аргументах', () => {
    const injectionAttempts = [
      { cmd: 'node; rm -rf /', args: [] },
      { cmd: 'python', args: ['script.py', '&&', 'whoami'] },
      { cmd: 'node', args: ['script.js | cat /etc/passwd'] },
      { cmd: 'python', args: ['$(malicious_command)'] },
      { cmd: 'node', args: ['`rm -rf *`'] },
      { cmd: 'python', args: ['arg1\narg2'] },
    ];

    for (const attempt of injectionAttempts) {
      expect(() =>
        LocalMCPSandbox.validateCommand(attempt.cmd, attempt.args)
      ).toThrow(MCPSecurityError);
    }
  });

  it('изолирует переменные окружения и предотвращает утечку секретов ядра', () => {
    const userEnv = {
      SAFE_USER_VAR: 'hello-world',
      DATABASE_URL: 'postgres://admin:secret@localhost:5432/db',
      ADMIN_PASSWORD: 'super-secret-admin-pass',
      JWT_SECRET: 'leaked-jwt-secret',
      API_KEY: 'sensitive-token',
    };

    const sanitized = LocalMCPSandbox.buildSanitizedEnv(userEnv);

    // Разрешенная пользовательская переменная сохранена
    expect(sanitized.SAFE_USER_VAR).toBe('hello-world');

    // Секреты ядра платформы исключены
    expect(sanitized.DATABASE_URL).toBeUndefined();
    expect(sanitized.ADMIN_PASSWORD).toBeUndefined();
    expect(sanitized.JWT_SECRET).toBeUndefined();
  });
});
