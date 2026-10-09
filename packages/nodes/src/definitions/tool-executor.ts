import { BaseNodeDef, NodeExecutionContext, NodeExecutionOutput } from '../base.js';
import { NodeCategory, WorkflowPortDefinition, ToolExecutorParametersSchema } from '@neuroflow/shared';
import { UniversalToolRegistry } from '../tools/tool-registry.js';
import { getDatabase, mcpServers, eq } from '@neuroflow/database';

export class ToolExecutorNode extends BaseNodeDef {
  type = 'tool-executor';
  name = 'Tool Executor';
  description = 'Прямое выполнение инструментов (встроенных математических, HTTP, JSON или MCP) в графе';
  category = NodeCategory.AGENT;
  icon = 'Wrench';
  color = '#EC4899';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Аргументы для вызова инструмента' },
  ];

  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Output', type: 'main', description: 'Результат работы инструмента' },
  ];

  parameterSchema = ToolExecutorParametersSchema;
  defaultParameters = {
    toolSource: 'builtin',
    serverId: undefined,
    toolName: 'calculator',
    arguments: {},
    requiresApproval: false,
    timeoutMs: 30000,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const inputData = (context as any).inputData ?? (context as any).input ?? {};
    const toolName = params.toolName || this.defaultParameters.toolName;

    // Объединяем аргументы из параметров узла и входящего потока данных
    const toolArgs = {
      ...(typeof inputData === 'object' && inputData !== null ? inputData : {}),
      ...(params.arguments || {}),
    };

    // 1. Проверка требования Human-in-the-loop подтверждения
    if (params.requiresApproval) {
      const approvalDecisions = context.workflowContext?.approvalDecisions || {};
      const decision = approvalDecisions[context.nodeId];

      if (!decision || decision.status !== 'approved') {
        return {
          outputData: {
            waitingForApproval: true,
            nodeId: context.nodeId,
            toolName,
            toolArgs,
            message: `Выполнение инструмента "${toolName}" требует подтверждения оператора.`,
          },
          output: null,
          selectedPort: 'main',
        };
      }
    }

    // 2. Получение активных серверов MCP
    let activeMCPServers: any[] = [];
    try {
      const db = getDatabase();
      activeMCPServers = await db.select().from(mcpServers).where(eq(mcpServers.isEnabled, true));
    } catch {
      // Игнорируем в тестах
    }

    const registry = UniversalToolRegistry.getInstance();
    const result = await registry.executeTool(toolName, toolArgs, {
      allowedTools: ['*'], // Разрешаем запуск указанного в узле инструмента
      mcpServers: activeMCPServers,
      context,
    });

    if (!result.success) {
      throw new Error(`Ошибка выполнения инструмента "${toolName}": ${result.error}`);
    }

    return {
      outputData: result.data,
      output: result.data,
      selectedPort: 'main',
    };
  }
}
