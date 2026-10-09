import crypto from 'node:crypto';
import { BaseNodeDef, NodeExecutionContext, NodeExecutionOutput } from '../base.js';
import { NodeCategory, WorkflowPortDefinition, HumanApprovalParametersSchema } from '@neuroflow/shared';
import { getDatabase, approvals, eq } from '@neuroflow/database';

export class HumanApprovalNode extends BaseNodeDef {
  type = 'human-approval';
  name = 'Human Approval';
  description = 'Приостановка сценария до подтверждения критического действия оператором (Human-in-the-Loop)';
  category = NodeCategory.AGENT;
  icon = 'ShieldAlert';
  color = '#EF4444';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Данные действия для проверки человеком' },
  ];

  outputs: WorkflowPortDefinition[] = [
    { id: 'approved', name: 'Approved', type: 'main', description: 'Действие одобрено оператором' },
    { id: 'rejected', name: 'Rejected', type: 'main', description: 'Действие отклонено оператором' },
  ];

  parameterSchema = HumanApprovalParametersSchema;
  defaultParameters = {
    actionTitle: 'Требуется подтверждение действия',
    actionDescription: 'Агент запрашивает разрешение на выполнение чувствительной операции.',
    consequences: 'Внешнее действие будет выполнено от вашего имени.',
    riskLevel: 'medium',
    timeoutMinutes: 60,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const inputData = (context as any).inputData ?? (context as any).input ?? {};
    const title = params.actionTitle || this.defaultParameters.actionTitle;
    const consequences = params.consequences || this.defaultParameters.consequences;

    // 1. Вычисляем криптографический отпечаток действия (Action Fingerprint)
    const payloadString = JSON.stringify(inputData);
    const actionFingerprint = crypto
      .createHash('sha256')
      .update(`${title}:${consequences}:${payloadString}`)
      .digest('hex');

    // 2. Проверяем, было ли уже принято решение оператором (при возобновлении выполнения)
    const workflowCtx = context.workflowContext || {};
    const decisions = workflowCtx.approvalDecisions || {};
    const existingDecision = decisions[context.nodeId] || decisions[actionFingerprint];

    if (existingDecision) {
      const isApproved = existingDecision.status === 'approved' || existingDecision.decision === 'approved';
      const port = isApproved ? 'approved' : 'rejected';

      context.log?.(`[Human Approval] Получено решение оператора: ${port.toUpperCase()}`);

      return {
        outputData: {
          approved: isApproved,
          status: isApproved ? 'approved' : 'rejected',
          reviewer: existingDecision.reviewer || 'Operator',
          reason: existingDecision.reason,
          actionFingerprint,
          originalInput: inputData,
        },
        output: inputData,
        selectedPort: port,
      };
    }

    // 3. Создаем запись запроса на подтверждение в БД (если доступна)
    let approvalId = crypto.randomUUID();
    const executionId = (context as any).executionId || workflowCtx.executionId;

    try {
      if (executionId) {
        const db = getDatabase();
        const expiresAt = new Date(Date.now() + (params.timeoutMinutes || 60) * 60 * 1000);

        const [created] = await db
          .insert(approvals)
          .values({
            id: approvalId,
            executionId,
            nodeId: context.nodeId,
            agentId: inputData.agentName || 'Agent',
            toolName: inputData.toolName || title,
            toolArguments: typeof inputData === 'object' ? inputData : { data: inputData },
            consequences,
            actionFingerprint,
            status: 'pending',
            expiresAt,
          })
          .returning();

        if (created) {
          approvalId = created.id;
        }
      }
    } catch {
      // Игнорируем в автономных тестах
    }

    context.log?.(`[Human Approval] Запрос на подтверждение ${approvalId} ожидает оператора.`);

    // 4. Сигнализируем движку выполнения о переходе в статус ожидания
    return {
      outputData: {
        waitingForApproval: true,
        approvalId,
        actionFingerprint,
        title,
        consequences,
        inputData,
      },
      output: null,
      selectedPort: 'approved', // Дефолтный порт при одобрении
    };
  }
}
