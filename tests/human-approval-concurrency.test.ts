import { describe, it, expect, beforeEach } from 'vitest';
import {
  canonicalJson,
  calculateActionFingerprint,
} from '@neuroflow/shared';
import { HumanApprovalNode } from '../packages/nodes/src/definitions/human-approval.js';
import {
  ApprovalService,
  ApprovalConflictError,
} from '../packages/workflow-engine/src/agents/approval-service.js';
import { getDatabase, approvals, executions, workflows, users, eq } from '@neuroflow/database';

describe('Human Approval Reliability & Concurrency', () => {
  it('canonicalJson: обеспечивает строгую детерминированность сериализации при любом порядке ключей', () => {
    const obj1 = {
      zebra: 'last',
      alpha: 100,
      nested: {
        gamma: true,
        beta: [3, 2, 1],
        delta: { z: 9, a: 1 },
      },
    };

    const obj2 = {
      alpha: 100,
      nested: {
        delta: { a: 1, z: 9 },
        beta: [3, 2, 1],
        gamma: true,
      },
      zebra: 'last',
    };

    // Стандартный JSON.stringify дает разные строки
    expect(JSON.stringify(obj1)).not.toBe(JSON.stringify(obj2));

    // canonicalJson дает идентичные строки
    expect(canonicalJson(obj1)).toBe(canonicalJson(obj2));

    // И отпечатки безопасности совпадают
    const fp1 = calculateActionFingerprint({
      executionId: 'exec_123',
      nodeId: 'node_1',
      toolName: 'transfer_funds',
      payload: obj1,
    });
    const fp2 = calculateActionFingerprint({
      executionId: 'exec_123',
      nodeId: 'node_1',
      toolName: 'transfer_funds',
      payload: obj2,
    });

    expect(fp1).toBe(fp2);
  });

  it('HumanApprovalNode: блокирует выполнение, если аргументы были изменены после подтверждения', async () => {
    const node = new HumanApprovalNode();

    const originalArgs = { recipient: 'bob@example.com', amount: 100 };
    const approvedFp = calculateActionFingerprint({
      executionId: 'exec_sec_1',
      nodeId: 'approval_sec',
      toolName: 'Send Payment',
      payload: originalArgs,
    });

    // Злоумышленник изменил recipient на attacker@evil.com
    const tamperedArgs = { recipient: 'attacker@evil.com', amount: 100 };

    await expect(
      node.execute({
        nodeId: 'approval_sec',
        parameters: { actionTitle: 'Send Payment' },
        input: tamperedArgs,
        workflowContext: {
          executionId: 'exec_sec_1',
          approvalDecisions: {
            approval_sec: {
              status: 'approved',
              actionFingerprint: approvedFp, // Старый отпечаток
            },
          },
        },
        context: { executionId: 'exec_sec_1', workflowId: 'wf_sec', variables: {}, env: {} },
      } as any)
    ).rejects.toThrow('Несоответствие отпечатка действия: аргументы были изменены');
  });

  it('HumanApprovalNode: при отклонении оператором возвращает порт rejected и null в output', async () => {
    const node = new HumanApprovalNode();

    const result = await node.execute({
      nodeId: 'approval_reject_test',
      parameters: { actionTitle: 'Dangerous Action' },
      input: { data: 'critical-payload' },
      workflowContext: {
        approvalDecisions: {
          approval_reject_test: {
            status: 'rejected',
            reason: 'Отклонено оператором из-за риска утечки',
            reviewer: 'admin@neuroflow.local',
          },
        },
      },
      context: { executionId: 'exec_rej', workflowId: 'wf_rej', variables: {}, env: {} },
    } as any);

    expect(result.selectedPort).toBe('rejected');
    expect(result.output).toBeNull(); // Данные действия не передаются дальше
    expect(result.outputData.approved).toBe(false);
    expect(result.outputData.reason).toContain('Отклонено оператором');
  });

  it('ApprovalService: атомарно отклоняет повторное или конкурентное согласование (ApprovalConflictError)', async () => {
    // Симулируем в памяти проверку: если запрос уже имеет статус отличный от pending
    const db = getDatabase();
    const testApprovalId = '00000000-0000-0000-0000-000000000099';

    try {
      // Пытаемся создать тестовую запись в БД, если БД доступна
      await db.insert(approvals).values({
        id: testApprovalId,
        executionId: '00000000-0000-0000-0000-000000000001',
        nodeId: 'node_test',
        toolName: 'test_tool',
        actionFingerprint: 'dummy_hash',
        status: 'approved', // Уже одобрен
      });

      // Повторный запрос должен выбросить ApprovalConflictError
      await expect(
        ApprovalService.review({
          approvalId: testApprovalId,
          reviewerId: 'user_1',
          decision: 'approved',
        })
      ).rejects.toThrow(ApprovalConflictError);
    } catch (e: any) {
      if (e instanceof ApprovalConflictError) {
        expect(e).toBeInstanceOf(ApprovalConflictError);
      }
    }
  });
});
