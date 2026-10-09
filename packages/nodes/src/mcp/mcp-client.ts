import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  LATEST_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
} from '@modelcontextprotocol/sdk/types.js';
import {
  MCPToolDefinition,
  MCPResourceDefinition,
  MCPPromptDefinition,
  CallMCPToolResult,
} from '@neuroflow/shared';
import { LocalMCPSandbox, MCPSecurityError } from './local-sandbox.js';
import { validateUrlForSSRF } from '../security/ssrf-guard.js';

export interface MCPServerConfig {
  id: string;
  name: string;
  transport: 'stdio' | 'sse' | 'http' | 'streamable-http';
  serverUrl?: string | null;
  command?: string | null;
  args?: string[] | null;
  env?: Record<string, string> | null;
  headers?: Record<string, string> | null;
  authType?: 'none' | 'bearer' | 'basic' | 'custom_header' | null;
  apiKey?: string | null;
  timeoutMs?: number;
}

export class UniversalMCPClient {
  private client: Client | null = null;
  private transportInstance: StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport | null = null;
  private isConnected = false;
  private lastActiveTimestamp = Date.now();
  private negotiatedProtocolVersion: string | null = null;

  constructor(public readonly config: MCPServerConfig) {}

  public getLastActive(): number {
    return this.lastActiveTimestamp;
  }

  public touch(): void {
    this.lastActiveTimestamp = Date.now();
  }

  public getNegotiatedProtocolVersion(): string | null {
    return this.negotiatedProtocolVersion;
  }

  /**
   * Устанавливает безопасное соединение с MCP сервером.
   */
  public async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      this.touch();
      return;
    }

    try {
      if (this.config.transport === 'stdio') {
        await this.connectStdio();
      } else if (this.config.transport === 'http' || this.config.transport === 'streamable-http') {
        await this.connectStreamableHTTP();
      } else if (this.config.transport === 'sse') {
        await this.connectLegacySSE();
      } else {
        throw new Error(`Неподдерживаемый транспорт MCP: ${this.config.transport}`);
      }

      this.client = new Client(
        {
          name: 'neuroflow-agent-orchestrator',
          version: '1.0.0',
        },
        {
          capabilities: {
            roots: {
              listChanged: true,
            },
            sampling: {},
          },
        }
      );

      if (!this.transportInstance) {
        throw new Error('Транспорт MCP не был инициализирован.');
      }

      await this.client.connect(this.transportInstance);
      this.isConnected = true;
      this.touch();

      // Сохраняем согласованную версию протокола и информацию о сервере
      try {
        const serverVersion = this.client.getServerVersion();
        this.negotiatedProtocolVersion = serverVersion?.version || LATEST_PROTOCOL_VERSION;
      } catch {
        this.negotiatedProtocolVersion = LATEST_PROTOCOL_VERSION;
      }
    } catch (error: any) {
      await this.disconnect();
      throw new Error(`Ошибка подключения к MCP серверу "${this.config.name}": ${error.message}`);
    }
  }

  /**
   * Подключение через современный Streamable HTTP транспорт с защитой от SSRF и авто-переподключением.
   */
  private async connectStreamableHTTP(): Promise<void> {
    if (!this.config.serverUrl) {
      throw new Error('Для Streamable HTTP транспорта необходимо указать serverUrl.');
    }

    // SSRF валидация перед сетевым запросом
    await validateUrlForSSRF(this.config.serverUrl);

    const headers: Record<string, string> = {
      ...(this.config.headers || {}),
    };

    if (this.config.authType === 'bearer' && this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    } else if (this.config.authType === 'custom_header' && this.config.apiKey) {
      headers['x-api-key'] = this.config.apiKey;
    }

    const url = new URL(this.config.serverUrl);
    this.transportInstance = new StreamableHTTPClientTransport(url, {
      requestInit: {
        headers,
      },
      // Запрет перехода на сторонние домены через HTTP-редиректы
      redirectPolicy: 'same-origin',
      reconnectionOptions: {
        maxRetries: 3,
        initialReconnectionDelay: 1000,
        maxReconnectionDelay: 10000,
        reconnectionDelayGrowFactor: 1.5,
      },
    });
  }

  /**
   * Подключение через Legacy Server-Sent Events (SSE) для совместимости со старыми серверами.
   */
  private async connectLegacySSE(): Promise<void> {
    if (!this.config.serverUrl) {
      throw new Error('Для Legacy SSE транспорта необходимо указать serverUrl.');
    }

    await validateUrlForSSRF(this.config.serverUrl);

    const headers: Record<string, string> = {
      ...(this.config.headers || {}),
    };

    if (this.config.authType === 'bearer' && this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    } else if (this.config.authType === 'custom_header' && this.config.apiKey) {
      headers['x-api-key'] = this.config.apiKey;
    }

    const url = new URL(this.config.serverUrl);
    this.transportInstance = new SSEClientTransport(url, {
      requestInit: {
        headers,
      },
    });
  }

  /**
   * Подключение через Stdio транспорт с проверкой песочницы безопасности.
   */
  private async connectStdio(): Promise<void> {
    if (!this.config.command) {
      throw new Error('Для Stdio транспорта необходимо указать команду.');
    }

    const { sanitizedCommand, sanitizedArgs } = LocalMCPSandbox.validateCommand(
      this.config.command,
      this.config.args || []
    );

    const safeEnv = LocalMCPSandbox.buildSanitizedEnv(this.config.env || undefined);

    this.transportInstance = new StdioClientTransport({
      command: sanitizedCommand,
      args: sanitizedArgs,
      env: safeEnv,
      stderr: 'pipe',
    });
  }

  /**
   * Проверка доступности сервера (Ping) через JSON-RPC.
   */
  public async ping(): Promise<boolean> {
    try {
      this.ensureConnected();
      await this.client!.ping();
      this.touch();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Чистое переподключение к серверу.
   */
  public async reconnect(): Promise<void> {
    await this.disconnect();
    await this.connect();
  }

  /**
   * Получение списка доступных инструментов MCP сервера.
   */
  public async listTools(): Promise<MCPToolDefinition[]> {
    this.ensureConnected();
    this.touch();

    const response = await this.client!.listTools();
    const rawTools = response?.tools || [];

    return rawTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: (t.inputSchema as Record<string, any>) || {
        type: 'object',
        properties: {},
      },
    }));
  }

  /**
   * Вызов инструмента на MCP сервере.
   */
  public async callTool(toolName: string, args: Record<string, any> = {}): Promise<CallMCPToolResult> {
    this.ensureConnected();
    this.touch();

    const startTime = Date.now();
    const timeoutMs = this.config.timeoutMs || 30000;

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Превышен таймаут выполнения инструмента "${toolName}" (${timeoutMs} мс)`));
      }, timeoutMs);
    });

    const callPromise = this.client!.callTool({
      name: toolName,
      arguments: args,
    });

    const result = await Promise.race([callPromise, timeoutPromise]);
    const durationMs = Date.now() - startTime;

    return {
      content: (result.content as any) || [],
      isError: !!result.isError,
      durationMs,
    };
  }

  /**
   * Получение списка доступных ресурсов MCP сервера.
   */
  public async listResources(): Promise<MCPResourceDefinition[]> {
    this.ensureConnected();
    this.touch();

    const response = await this.client!.listResources();
    const rawResources = response?.resources || [];

    return rawResources.map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
    }));
  }

  /**
   * Чтение содержимого ресурса по URI.
   */
  public async readResource(uri: string): Promise<any> {
    this.ensureConnected();
    this.touch();

    return await this.client!.readResource({ uri });
  }

  /**
   * Получение списка зарегистрированных промптов MCP сервера.
   */
  public async listPrompts(): Promise<MCPPromptDefinition[]> {
    this.ensureConnected();
    this.touch();

    const response = await this.client!.listPrompts();
    const rawPrompts = response?.prompts || [];

    return rawPrompts.map((p) => ({
      name: p.name,
      description: p.description,
      arguments: p.arguments as any,
    }));
  }

  /**
   * Получение промпта с подставленными аргументами.
   */
  public async getPrompt(name: string, args?: Record<string, string>): Promise<any> {
    this.ensureConnected();
    this.touch();

    return await this.client!.getPrompt({
      name,
      arguments: args,
    });
  }

  /**
   * Безопасное отключение и закрытие ресурсов.
   */
  public async disconnect(): Promise<void> {
    this.isConnected = false;

    if (this.client) {
      try {
        await this.client.close();
      } catch {
        // Игнорируем ошибки при закрытии
      }
      this.client = null;
    }

    if (this.transportInstance) {
      try {
        await this.transportInstance.close();
      } catch {
        // Игнорируем
      }
      this.transportInstance = null;
    }
  }

  private ensureConnected(): void {
    if (!this.isConnected || !this.client) {
      throw new Error(`MCP клиент "${this.config.name}" не подключен. Сначала вызовите connect().`);
    }
  }
}

/**
 * Пул активных клиентов MCP для повторного использования соединений
 * и предотвращения утечек файловых дескрипторов и процессов.
 */
export class MCPClientPool {
  private static clients = new Map<string, UniversalMCPClient>();
  private static cleanupInterval: NodeJS.Timeout | null = null;
  private static readonly IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 минут неактивности

  public static async getClient(config: MCPServerConfig): Promise<UniversalMCPClient> {
    this.initCleanup();

    let client = this.clients.get(config.id);
    if (!client) {
      client = new UniversalMCPClient(config);
      await client.connect();
      this.clients.set(config.id, client);
    } else {
      client.touch();
    }

    return client;
  }

  public static async releaseClient(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (client) {
      await client.disconnect();
      this.clients.delete(serverId);
    }
  }

  public static async releaseAll(): Promise<void> {
    for (const [id, client] of this.clients.entries()) {
      try {
        await client.disconnect();
      } catch {
        // Игнорируем
      }
    }
    this.clients.clear();

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  private static initCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(async () => {
      const now = Date.now();
      for (const [id, client] of this.clients.entries()) {
        if (now - client.getLastActive() > this.IDLE_TIMEOUT_MS) {
          try {
            await client.disconnect();
          } catch {
            // Игнорируем
          }
          this.clients.delete(id);
        }
      }
    }, 60 * 1000);

    // Unref чтобы не блокировать завершение процесса node
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }
}
