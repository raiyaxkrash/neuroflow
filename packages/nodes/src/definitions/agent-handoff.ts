import { BaseNodeDef, NodeExecutionContext, NodeExecutionOutput } from '../base.js';
import { NodeCategory, WorkflowPortDefinition, AgentHandoffParametersSchema } from '@neuroflow/shared';

export class AgentHandoffNode extends BaseNodeDef {
  type = 'agent-handoff';
  name = 'Agent Handoff';
  description = 'Управляемая передача контекста между AI-агентами с защитой от циклических вызовов';
  category = NodeCategory.AGENT;
  icon = 'ArrowRightLeft';
  color = '#F59E0B';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Контекст и результаты предыдущего агента' },
  ];

  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Handoff Output', type: 'main', description: 'Обогащенный контекст для целевого агента' },
  ];

  parameterSchema = AgentHandoffParametersSchema;
  defaultParameters = {
    targetAgentId: '',
    handoffReason: 'Delegate subtask to specialized agent',
    contextTransferKeys: [] as string[],
    maxHandoffDepth: 5,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const inputData = (context as any).inputData ?? (context as any).input ?? {};
    const maxDepth = params.maxHandoffDepth || this.defaultParameters.maxHandoffDepth;
    const targetAgentId = params.targetAgentId || 'TargetAgent';
    const reason = params.handoffReason || this.defaultParameters.handoffReason;

    // 1. Проверка счетчика переходов для предотвращения циклов (Cycle Detection)
    const workflowCtx = context.workflowContext || {};
    const currentDepth = (workflowCtx.__handoffDepth || 0) + 1;
    workflowCtx.__handoffDepth = currentDepth;

    if (currentDepth > maxDepth) {
      throw new Error(
        `[Agent Handoff Cycle Detected] Превышен лимит последовательных передач управления (${currentDepth} > ${maxDepth}). Остановлено для предотвращения зацикливания.`
      );
    }

    // 2. Формирование передаваемого контекста
    const transferKeys = params.contextTransferKeys || [];
    let payload: Record<string, any> = {};

    if (transferKeys.length > 0 && typeof inputData === 'object' && inputData !== null) {
      for (const k of transferKeys) {
        if (k in inputData) {
          payload[k] = inputData[k];
        }
      }
    } else {
      payload = typeof inputData === 'object' ? { ...inputData } : { data: inputData };
    }

    payload.__handoffMetadata = {
      fromNode: context.nodeId,
      targetAgentId,
      reason,
      hop: currentDepth,
      timestamp: new Date().toISOString(),
    };

    context.log?.(`[Handoff] Передача задачи агенту "${targetAgentId}" (hop ${currentDepth}/${maxDepth}): ${reason}`);

    return {
      outputData: payload,
      output: payload,
      selectedPort: 'main',
    };
  }
}
