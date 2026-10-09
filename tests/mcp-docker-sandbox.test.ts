import { describe, it, expect } from 'vitest';
import {
  LocalMCPSandbox,
  DockerContainerSecurityValidator,
  MCPSecurityError,
} from '@neuroflow/nodes';

describe('Docker Container Security Sandbox for Local MCP', () => {
  it('разрешает безопасную команду docker run и накладывает флаги изоляции', () => {
    const rawArgs = ['run', 'my-mcp-image:latest', 'arg1'];
    const hardened = DockerContainerSecurityValidator.validateAndHardenArgs(rawArgs);

    expect(hardened).toContain('run');
    expect(hardened).toContain('-i');
    expect(hardened).toContain('--rm');
    expect(hardened).toContain('--security-opt=no-new-privileges');
    expect(hardened).toContain('--cap-drop=ALL');
    expect(hardened).toContain('--memory=512m');
    expect(hardened).toContain('--cpus=1.0');
    expect(hardened).toContain('--user=1000:1000');
    expect(hardened).toContain('my-mcp-image:latest');
    expect(hardened).toContain('arg1');
  });

  it('блокирует недопустимые подкоманды docker (exec, build, attach)', () => {
    const dangerousSubcommands = [
      ['exec', '-it', 'container_id', 'sh'],
      ['build', '.'],
      ['attach', 'container_id'],
      ['system', 'prune'],
    ];

    for (const args of dangerousSubcommands) {
      expect(() => DockerContainerSecurityValidator.validateAndHardenArgs(args)).toThrow(
        MCPSecurityError
      );
    }
  });

  it('блокирует запуск в privileged режиме и namespace хоста', () => {
    const privilegedArgs = [
      ['run', '--privileged', 'ubuntu'],
      ['run', '--net=host', 'ubuntu'],
      ['run', '--pid=host', 'ubuntu'],
      ['run', '--ipc=host', 'ubuntu'],
    ];

    for (const args of privilegedArgs) {
      expect(() => DockerContainerSecurityValidator.validateAndHardenArgs(args)).toThrow(
        'строго запрещен'
      );
    }
  });

  it('блокирует монтирование docker.sock и критических системных каталогов хоста', () => {
    const dangerousMounts = [
      ['run', '-v', '/var/run/docker.sock:/var/run/docker.sock', 'alpine'],
      ['run', '--volume', 'docker.sock:/docker.sock', 'alpine'],
      ['run', '-v', '/etc:/etc:ro', 'alpine'],
      ['run', '-v', '/root:/root', 'alpine'],
      ['run', '-v', '/:/host', 'alpine'],
      ['run', '-v', 'C:\\Windows:C:\\Windows', 'alpine'],
      ['run', '-v', 'C:\\Program Files:C:\\pf', 'alpine'],
    ];

    for (const args of dangerousMounts) {
      expect(() => DockerContainerSecurityValidator.validateAndHardenArgs(args)).toThrow(
        'Монтирование критического пути'
      );
    }
  });

  it('LocalMCPSandbox.validateCommand с docker применяет все правила контейнерной безопасности', () => {
    const validated = LocalMCPSandbox.validateCommand('docker', [
      'run',
      '-m',
      '256m',
      'safe-mcp-server:1.0',
    ]);

    expect(validated.sanitizedCommand).toBe('docker');
    expect(validated.sanitizedArgs).toContain('--security-opt=no-new-privileges');
    expect(validated.sanitizedArgs).toContain('--cap-drop=ALL');
    expect(validated.sanitizedArgs).toContain('safe-mcp-server:1.0');
  });
});
