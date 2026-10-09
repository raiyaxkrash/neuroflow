import crypto from 'node:crypto';
import {
  getDatabase,
  approvals,
  executions,
  workflows,
  eq,
  and,
} from '@neuroflow/database';
import { ExecutionStatus } from '@neuroflow/shared';
import { WorkflowExecutor } from '../executor.js';

export interface ReviewApprovalOptions {
  approvalId: string;
  reviewerId: string;
  decision: 'approved' | 'rejected';
  reason?: string;
}

export class ApprovalService {
  /**
   * Получение списка всех ожидающих подтверждений.
   */
  public static async listPending(userId?: string): Promise<any[]> {
    try {
      const db = getDatabase();
      const query = db
        .select({
          id: approvals.id,
          executionId: approvals.executionId,
          nodeId: approvals.nodeId,
          agentId: approvals.agentId,
          toolName: approvals.toolName,
          toolArguments: approvals.toolArguments,
          consequences: approvals.consequences,
          actionFingerprint: approvals.actionFingerprint,
          status: approvals.status,
          createdAt: approvals.createdAt,
          expiresAt: approvals.expiresAt,
        })
        .from(approvals)
        .where(eq(approvals.status, 'pending'));

      const rows = await query;
      return rows;
    } catch {
      return [];
    }
  }

  /**
   * Получение детальной информации по конкретному запросу на подтверждение.
   */
  public static async getById(approvalId: string): Promise<any | null> {
    try {
      const db = getDatabase();
      const [row] = await db
        .select()
        .from(approvals)
        .where(eq(approvals.id, approvalId))
        .limit(1);

      return row || null;
    } catch {
      return null;
    }
  }

  /**
   * Рецензирование запроса: одобрение или отклонение действия.
   */
  public static async review(options: ReviewApprovalOptions): Promise<{
    success: boolean;
    approval: any;
    executionResumed?: boolean;
    error?: string;
  }> {
    const { approvalId, reviewerId, decision, reason } = options;
    const db = getDatabase();

    const [approvalRecord] = await db
      .select()
      .from(approvals)
      .where(eq(approvals.id, approvalId))
      .limit(1);

    if (!approvalRecord) {
      throw new Error(`Запрос на подтверждение с ID "${approvalId}" не найден.`);
    }

    if (approvalRecord.status !== 'pending') {
      throw new Error(`Запрос на подтверждение уже был обработан со статусом "${approvalRecord.status}".`);
    }

    // Проверка срока жизни запроса
    if (approvalRecord.expiresAt && new Date(approvalRecord.expiresAt) < new Date()) {
      await db
        .update(approvals)
        .set({ status: 'rejected', rejectionReason: 'Истек срок ожидания подтверждения (timeout).' })
        .where(eq(approvals.id, approvalId));
      throw new Error('Срок ожидания подтверждения данного действия истек.');
    }

    // Обновляем статус подтверждения
    const [updated] = await db
      .update(approvals)
      .set({
        status: decision,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: reason || null,
        updatedAt: new Date(),
      })
      .where(eq(approvals.id, approvalId))
      .returning();

    // Загружаем запуск и граф воркфлоу для возобновления выполнения
    const [execRow] = await db
      .select()
      .from(executions)
      .where(eq(executions.id, approvalRecord.executionId))
      .limit(1);

    if (!execRow) {
      return { success: true, approval: updated, executionResumed: false };
    }

    const [wfRow] = await db
      .select()
      .from(workflows)
      .where(eq(workflows.id, execRow.workflowId))
      .limit(1);

    if (!wfRow) {
      return { success: true, approval: updated, executionResumed: false };
    }

    // Возобновляем выполнение сценария с переданным решением
    const initialPayload = {
      ...(typeof execRow.inputPayload === 'object' ? (execRow.inputPayload as any) : {}),
      approvalDecisions: {
        [approvalRecord.nodeId]: {
          status: decision,
          reviewer: reviewerId,
          reason,
          actionFingerprint: approvalRecord.actionFingerprint,
        },
        [approvalRecord.actionFingerprint]: {
          status: decision,
          reviewer: reviewerId,
          reason,
        },
      },
    };

    // Запускаем возобновление в фоне, не блокируя HTTP ответ
    WorkflowExecutor.execute({
      executionId: execRow.id,
      workflowId: wfRow.id,
      graph: wfRow.graph as any,
      initialPayload,
      saveToDatabase: true,
    }).catch((err) => {
      console.error(`[ApprovalService] Ошибка при возобновлении выполнения ${execRow.id}:`, err);
    });

    return {
      success: true,
      approval: updated,
      executionResumed: true,
    };
  }
}
