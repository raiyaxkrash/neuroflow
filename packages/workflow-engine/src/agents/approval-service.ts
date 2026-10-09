import crypto from 'node:crypto';
import {
  getDatabase,
  approvals,
  executions,
  workflows,
  eq,
  and,
} from '@neuroflow/database';
import { ExecutionStatus, canonicalJson } from '@neuroflow/shared';
import { WorkflowExecutor } from '../executor.js';

export class ApprovalConflictError extends Error {
  constructor(message: string) {
    super(`[Approval Conflict] ${message}`);
    this.name = 'ApprovalConflictError';
  }
}

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
   * Атомарное рецензирование запроса: одобрение или отклонение действия.
   * Гарантирует строгую защиту от конкурентных запросов (race conditions) и повторного применения.
   */
  public static async review(options: ReviewApprovalOptions): Promise<{
    success: boolean;
    approval: any;
    executionResumed?: boolean;
    error?: string;
  }> {
    const { approvalId, reviewerId, decision, reason } = options;
    const db = getDatabase();

    // 1. Проверяем существование записи и срок действия
    const [existing] = await db
      .select()
      .from(approvals)
      .where(eq(approvals.id, approvalId))
      .limit(1);

    if (!existing) {
      throw new Error(`Запрос на подтверждение с ID "${approvalId}" не найден.`);
    }

    if (existing.status !== 'pending') {
      throw new ApprovalConflictError(
        `Запрос на подтверждение уже обработан со статусом "${existing.status}". Повторная обработка запрещена.`
      );
    }

    if (existing.expiresAt && new Date(existing.expiresAt) < new Date()) {
      // Атомарно помечаем как просроченный, если еще pending
      await db
        .update(approvals)
        .set({
          status: 'rejected',
          rejectionReason: 'Истек срок ожидания подтверждения (timeout).',
          updatedAt: new Date(),
        })
        .where(and(eq(approvals.id, approvalId), eq(approvals.status, 'pending')));

      throw new Error('Срок ожидания подтверждения данного действия истек.');
    }

    // 2. АТОМАРНЫЙ UPDATE с условием status = 'pending' для предотвращения race condition
    const [updated] = await db
      .update(approvals)
      .set({
        status: decision,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: reason || null,
        updatedAt: new Date(),
      })
      .where(and(eq(approvals.id, approvalId), eq(approvals.status, 'pending')))
      .returning();

    if (!updated) {
      // Параллельный процесс успел изменить статус миллисекундами ранее
      const [concurrentState] = await db
        .select()
        .from(approvals)
        .where(eq(approvals.id, approvalId))
        .limit(1);

      throw new ApprovalConflictError(
        `Конкурентный запрос: подтверждение уже было переведено в статус "${concurrentState?.status}".`
      );
    }

    // 3. Загружаем запуск и граф воркфлоу для возобновления выполнения
    const [execRow] = await db
      .select()
      .from(executions)
      .where(eq(executions.id, updated.executionId))
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

    // 4. Формируем контекст возобновления выполнения
    const initialPayload = {
      ...(typeof execRow.inputPayload === 'object' ? (execRow.inputPayload as any) : {}),
      approvalDecisions: {
        [updated.nodeId]: {
          status: decision,
          reviewer: reviewerId,
          reason,
          actionFingerprint: updated.actionFingerprint,
        },
        [updated.actionFingerprint]: {
          status: decision,
          reviewer: reviewerId,
          reason,
          actionFingerprint: updated.actionFingerprint,
        },
      },
    };

    // Запускаем возобновление в фоне с продолжением исполнения
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
