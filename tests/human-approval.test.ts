import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { HumanApprovalNode } from '../packages/nodes/src/definitions/human-approval.js';
import { WorkflowExecutor } from '../packages/workflow-engine/src/executor.js';
import { ExecutionStatus, WorkflowGraph, calculateActionFingerprint } from '@neuroflow/shared';

describe('Human-in-the-Loop & Approval System', () => {
  it('HumanApprovalNode: генерирует sha256 fingerprint и возвращает waitingForApproval: true', async () => {
    const node = new HumanApprovalNode();
    const inputPayload = {
      action: 'delete_production_database',
      target: 'db-cluster-primary',
    };

    const res = await node.execute({
      nodeId: 'approval_node_1',
      parameters: {
        actionTitle: 'Удаление базы данных',
        consequences: 'Необратимое удаление всех таблиц',
        timeoutMinutes: 30,
      },
      input: inputPayload,
      workflowContext: {},
      context: {
        executionId: 'exec_approval_1',
        workflowId: 'wf_approval_1',
        variables: {},
        env: {},
        logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
      },
    } as any);

    expect(res.outputData.waitingForApproval).toBe(true);
    expect(res.outputData.actionFingerprint).toBeDefined();

    // Проверяем корректность вычисления отпечатка через детерминированный канонический алгоритм
    const expectedHash = calculateActionFingerprint({
      executionId: 'exec_approval_1',
      nodeId: 'approval_node_1',
      toolName: 'Удаление базы данных',
      payload: inputPayload,
    });

    expect(res.outputData.actionFingerprint).toBe(expectedHash);
  });

  it('HumanApprovalNode: различает изменения аргументов через actionFingerprint', async () => {
    const node = new HumanApprovalNode();

    const res1 = await node.execute({
      nodeId: 'node_fp_1',
      parameters: { actionTitle: 'Deploy', consequences: 'Deploy to env' },
      input: { env: 'staging' },
      workflowContext: {},
      context: { executionId: 'exec_1', workflowId: 'wf_1', variables: {}, env: {} },
    } as any);

    const res2 = await node.execute({
      nodeId: 'node_fp_1',
      parameters: { actionTitle: 'Deploy', consequences: 'Deploy to env' },
      input: { env: 'production' },
      workflowContext: {},
      context: { executionId: 'exec_2', workflowId: 'wf_2', variables: {}, env: {} },
    } as any);

    // Разные входные данные должны давать разные отпечатки безопасности
    expect(res1.outputData.actionFingerprint).not.toBe(res2.outputData.actionFingerprint);
  });

  it('HumanApprovalNode: выбирает порт approved или rejected в зависимости от решения оператора', async () => {
    const node = new HumanApprovalNode();

    // 1. Сценарий подтверждения (Approved)
    const approvedRes = await node.execute({
      nodeId: 'node_review_1',
      parameters: { actionTitle: 'Review Action' },
      input: { data: 'test-data' },
      workflowContext: {
        approvalDecisions: {
          node_review_1: {
            status: 'approved',
            reviewer: 'sec-officer@company.com',
          },
        },
      },
      context: { executionId: 'exec_1', workflowId: 'wf_1', variables: {}, env: {} },
    } as any);

    expect(approvedRes.selectedPort).toBe('approved');
    expect(approvedRes.outputData.approved).toBe(true);
    expect(approvedRes.outputData.reviewer).toBe('sec-officer@company.com');

    // 2. Сценарий отклонения (Rejected)
    const rejectedRes = await node.execute({
      nodeId: 'node_review_2',
      parameters: { actionTitle: 'Review Action' },
      input: { data: 'test-data' },
      workflowContext: {
        approvalDecisions: {
          node_review_2: {
            status: 'rejected',
            reason: 'Отклонено службой безопасности из-за высоких рисков',
            reviewer: 'sec-officer@company.com',
          },
        },
      },
      context: { executionId: 'exec_2', workflowId: 'wf_2', variables: {}, env: {} },
    } as any);

    expect(rejectedRes.selectedPort).toBe('rejected');
    expect(rejectedRes.outputData.approved).toBe(false);
    expect(rejectedRes.outputData.reason).toContain('Отклонено службой безопасности');
  });

  it('WorkflowExecutor: приостанавливает выполнение в статус WAITING_FOR_APPROVAL', async () => {
    const scenarioGraph: WorkflowGraph = {
      nodes: [
        {
          id: 'trigger_1',
          type: 'manual-trigger',
          position: { x: 0, y: 0 },
          data: { label: 'Start', type: 'manual-trigger', parameters: {} },
        },
        {
          id: 'approval_1',
          type: 'human-approval',
          position: { x: 200, y: 0 },
          data: {
            label: 'Review Action',
            type: 'human-approval',
            parameters: {
              actionTitle: 'Критическая операция',
              consequences: 'Изменение настроек кластера',
            },
          },
        },
        {
          id: 'output_1',
          type: 'output',
          position: { x: 400, y: 0 },
          data: { label: 'Finish', type: 'output', parameters: {} },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'trigger_1',
          target: 'approval_1',
        },
        {
          id: 'e2',
          source: 'approval_1',
          target: 'output_1',
          sourceHandle: 'approved',
        },
      ],
    };

    // При первом выполнении статус должен стать WAITING_FOR_APPROVAL
    const result = await WorkflowExecutor.execute({
      executionId: 'test_exec_approval',
      workflowId: 'test_wf_approval',
      graph: scenarioGraph,
      initialPayload: {},
      saveToDatabase: false,
    });

    expect(result.status).toBe(ExecutionStatus.WAITING_FOR_APPROVAL);
  });
});
