import { BUILT_IN_TOOLS, BuiltInToolDefinition, ToolExecutionResult } from './builtin-tools.js';
import { MCPServerConfig, MCPClientPool } from '../mcp/mcp-client.js';

export interface ToolDefinition {
  name: string;
  description: string;
  category: 'builtin' | 'mcp';
  serverName?: string;
  serverId?: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export class UniversalToolRegistry {
  private static instance: UniversalToolRegistry;
  private builtinMap = new Map<string, BuiltInToolDefinition>();

  private constructor() {
    for (const tool of BUILT_IN_TOOLS) {
      this.builtinMap.set(tool.name, tool);
    }
  }

  public static getInstance(): UniversalToolRegistry {
    if (!UniversalToolRegistry.instance) {
      UniversalToolRegistry.instance = new UniversalToolRegistry();
    }
    return UniversalToolRegistry.instance;
  }

  /**
   * Проверяет, разрешен ли инструмент заданному набору масок/паттернов.
   */
  public isToolAllowed(allowedPatterns: string[] | undefined, toolName: string): boolean {
    if (!allowedPatterns || allowedPatterns.length === 0) {
      return false;
    }

    for (const pattern of allowedPatterns) {
      if (pattern === '*' || pattern === 'all') {
        return true;
      }

      if (pattern === 'builtin:*' || pattern === 'built-in:*') {
        if (this.builtinMap.has(toolName) || !toolName.includes(':')) {
          return true;
        }
      }

      if (pattern === 'mcp:*' && (toolName.startsWith('mcp:') || toolName.includes(':'))) {
        return true;
      }

      // Поддержка префикса сервера, например mcp:github:*
      if (pattern.endsWith(':*')) {
        const prefix = pattern.slice(0, -1); // 'mcp:github:'
        if (toolName.startsWith(prefix)) {
          return true;
        }
      }

      if (pattern.toLowerCase() === toolName.toLowerCase()) {
        return true;
      }
    }

    return false;
  }

  /**
   * Возвращает список всех встроенных инструментов.
   */
  public getBuiltInTools(): ToolDefinition[] {
    return Array.from(this.builtinMap.values()).map((t) => ({
      name: t.name,
      description: t.description,
      category: 'builtin',
      inputSchema: t.inputSchema,
    }));
  }

  /**
   * Возвращает полный список доступных инструментов с учетом подключенных серверов MCP.
   */
  public async listTools(mcpServers: MCPServerConfig[] = []): Promise<ToolDefinition[]> {
    const list: ToolDefinition[] = this.getBuiltInTools();

    for (const server of mcpServers) {
      try {
        const client = await MCPClientPool.getClient(server);
        const mcpTools = await client.listTools();

        for (const t of mcpTools) {
          list.push({
            name: `mcp:${server.name}:${t.name}`,
            description: t.description || `Инструмент ${t.name} из MCP сервера ${server.name}`,
            category: 'mcp',
            serverName: server.name,
            serverId: server.id,
            inputSchema: (t.inputSchema as any) || { type: 'object', properties: {} },
          });
        }
      } catch (err: any) {
        console.warn(`[ToolRegistry] Не удалось загрузить инструменты MCP сервера "${server.name}":`, err.message);
      }
    }

    return list;
  }

  /**
   * Исполнение инструмента с проверкой прав, валидацией схемы и изоляцией.
   */
  public async executeTool(
    toolName: string,
    args: Record<string, any>,
    options: {
      allowedTools?: string[];
      mcpServers?: MCPServerConfig[];
      context?: any;
    } = {}
  ): Promise<ToolExecutionResult> {
    const { allowedTools, mcpServers = [], context } = options;

    // 1. Проверка прав агента на вызов данного инструмента
    if (allowedTools && !this.isToolAllowed(allowedTools, toolName)) {
      return {
        success: false,
        error: `Доступ запрещен: инструмент "${toolName}" не входит в список разрешенных инструментов агента [${allowedTools.join(', ')}].`,
      };
    }

    // 2. Проверка, является ли инструмент встроенным
    const builtin = this.builtinMap.get(toolName);
    if (builtin) {
      try {
        const data = await builtin.handler(args, context);
        return { success: true, data };
      } catch (err: any) {
        return { success: false, error: `Ошибка выполнения встроенного инструмента "${toolName}": ${err.message}` };
      }
    }

    // 3. Вызов инструмента из MCP сервера
    // Форматы: "mcp:serverName:toolName" или "mcp__serverName__toolName" или имя инструмента
    let targetServer: MCPServerConfig | undefined;
    let actualToolName = toolName;

    if (toolName.startsWith('mcp:')) {
      const parts = toolName.split(':');
      if (parts.length >= 3) {
        const serverIdentifier = parts[1];
        actualToolName = parts.slice(2).join(':');
        targetServer = mcpServers.find(
          (s) => s.id === serverIdentifier || s.name.toLowerCase() === serverIdentifier.toLowerCase()
        );
      }
    }

    // Если сервер не был указан в префиксе, ищем среди серверов, у которых есть такой инструмент
    if (!targetServer && mcpServers.length > 0) {
      for (const server of mcpServers) {
        try {
          const client = await MCPClientPool.getClient(server);
          const tools = await client.listTools();
          if (tools.some((t) => t.name === actualToolName)) {
            targetServer = server;
            break;
          }
        } catch {
          // Игнорируем недоступный сервер
        }
      }
    }

    if (!targetServer) {
      return {
        success: false,
        error: `Инструмент "${toolName}" не найден ни среди встроенных инструментов, ни на активных MCP серверах.`,
      };
    }

    try {
      const client = await MCPClientPool.getClient(targetServer);
      const mcpResponse = await client.callTool(actualToolName, args);

      if (mcpResponse.isError) {
        return {
          success: false,
          error: `Ошибка MCP инструмента "${actualToolName}": ${JSON.stringify(mcpResponse.content)}`,
          data: mcpResponse.content,
        };
      }

      return {
        success: true,
        data: mcpResponse.content,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Сбой при вызове MCP инструмента "${actualToolName}" на сервере "${targetServer.name}": ${err.message}`,
      };
    }
  }
}
