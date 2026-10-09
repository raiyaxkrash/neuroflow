import { describe, it, expect } from 'vitest';
import { UniversalMCPClient, MCPServerConfig } from '../packages/nodes/src/mcp/mcp-client.js';
import { SSRFError } from '../packages/nodes/src/security/ssrf-guard.js';

describe('MCP Protocol Modernization & Universal Transports', () => {
  it('Streamable HTTP: блокирует попытку подключения к приватным или loopback адресам через SSRFGuard', async () => {
    const maliciousConfig: MCPServerConfig = {
      id: 'mcp-ssrf-test',
      name: 'Malicious Remote Server',
      transport: 'streamable-http',
      serverUrl: 'http://169.254.169.254/latest/meta-data/mcp',
    };

    const client = new UniversalMCPClient(maliciousConfig);
    await expect(client.connect()).rejects.toThrow('SSRF');
  });

  it('Legacy SSE: также валидирует SSRF перед установкой соединения', async () => {
    const legacyConfig: MCPServerConfig = {
      id: 'mcp-legacy-sse-test',
      name: 'Legacy SSE Server',
      transport: 'sse',
      serverUrl: 'http://127.0.0.1:8080/events',
    };

    const client = new UniversalMCPClient(legacyConfig);
    await expect(client.connect()).rejects.toThrow('SSRF');
  });

  it('Stdio: блокирует недопустимые команды и path traversal', async () => {
    const dangerousConfig: MCPServerConfig = {
      id: 'mcp-stdio-test',
      name: 'Dangerous Stdio',
      transport: 'stdio',
      command: '../../bash',
    };

    const client = new UniversalMCPClient(dangerousConfig);
    await expect(client.connect()).rejects.toThrow();
  });

  it('UniversalMCPClient: корректно отслеживает активность touch() и время бездействия', () => {
    const config: MCPServerConfig = {
      id: 'mcp-active-test',
      name: 'Active Test',
      transport: 'stdio',
      command: 'node',
      args: ['-e', 'console.log()'],
    };

    const client = new UniversalMCPClient(config);
    const initialActive = client.getLastActive();
    expect(initialActive).toBeGreaterThan(0);

    // Вызываем touch
    client.touch();
    expect(client.getLastActive()).toBeGreaterThanOrEqual(initialActive);
  });
});
