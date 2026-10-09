import { BaseNodeDef, NodeExecutionContext, NodeExecutionOutput } from '../base.js';
import { NodeCategory, WorkflowPortDefinition, MCPToolParametersSchema } from '@neuroflow/shared';
import { MCPClientPool, MCPServerConfig } from '../mcp/mcp-client.js';
import { getDatabase, mcpServers, eq, decryptData } from '@neuroflow/database';

export class MCPToolNode extends BaseNodeDef {
  type = 'mcp-tool';
  name = 'MCP Tool';
  description = 'Вызов конкретного инструмента на подключенном Model Context Protocol (MCP) сервере';
  category = NodeCategory.AGENT;
  icon = 'Plug';
  color = '#6366F1';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Аргументы для вызова MCP инструмента' },
  ];

  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Output', type: 'main', description: 'Результат вызова инструмента' },
  ];

  parameterSchema = MCPToolParametersSchema;
  defaultParameters = {
    serverId: '',
    toolName: '',
    arguments: {},
    timeoutMs: 30000,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const inputData = (context as any).inputData ?? (context as any).input ?? {};
    const serverId = params.serverId || this.defaultParameters.serverId;
    const toolName = params.toolName || this.defaultParameters.toolName;

    if (!serverId) {
      throw new Error('Для MCP Tool узла необходимо указать serverId.');
    }
    if (!toolName) {
      throw new Error('Для MCP Tool узла необходимо указать toolName.');
    }

    // Аргументы инструмента: объединение из параметров узла и входящего потока
    const toolArgs = {
      ...(typeof inputData === 'object' && inputData !== null ? inputData : {}),
      ...(params.arguments || {}),
    };

    // 1. Загрузка конфигурации MCP сервера
    let serverConfig: MCPServerConfig | null = null;
    try {
      const db = getDatabase();
      const [serverRow] = await db
        .select()
        .from(mcpServers)
        .where(eq(mcpServers.id, serverId))
        .limit(1);

      if (serverRow && serverRow.isEnabled) {
        let env: Record<string, string> | undefined = undefined;
        let apiKey: string | undefined = undefined;

        if (serverRow.envEncrypted) {
          try {
            env = JSON.parse(decryptData(serverRow.envEncrypted));
          } catch {
            // Игнорируем
          }
        }

        if (serverRow.apiKeyEncrypted) {
          try {
            apiKey = decryptData(serverRow.apiKeyEncrypted);
          } catch {
            // Игнорируем
          }
        }

        serverConfig = {
          id: serverRow.id,
          name: serverRow.name,
          transport: serverRow.transport as any,
          serverUrl: serverRow.serverUrl,
          command: serverRow.command,
          args: serverRow.args as any,
          env,
          apiKey,
          authType: serverRow.authType as any,
          timeoutMs: params.timeoutMs || 30000,
        };
      }
    } catch {
      // Игнорируем
    }

    if (!serverConfig) {
      throw new Error(`MCP сервер с ID "${serverId}" не найден или отключен.`);
    }

    context.log?.(`[MCP Tool] Вызов инструмента "${toolName}" на сервере "${serverConfig.name}"`);

    // 2. Получение клиента и вызов инструмента
    const client = await MCPClientPool.getClient(serverConfig);
    const callResult = await client.callTool(toolName, toolArgs);

    if (callResult.isError) {
      throw new Error(`Ошибка MCP инструмента "${toolName}": ${JSON.stringify(callResult.content)}`);
    }

    return {
      outputData: {
        toolName,
        serverId,
        content: callResult.content,
        durationMs: callResult.durationMs,
      },
      output: callResult.content,
      selectedPort: 'main',
    };
  }
}
