import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../apps/api/src/server.js';
import { FastifyInstance } from 'fastify';
import { runMigrations, closeDatabase, getDatabase, workflows, executions, approvals, mcpServers, aiProviders, eq } from '@neuroflow/database';
import { ExecutionStatus, WorkflowGraph, calculateActionFingerprint } from '@neuroflow/shared';
import { WorkflowExecutor } from '../packages/workflow-engine/src/executor.js';
import { ApprovalService } from '../packages/workflow-engine/src/agents/approval-service.js';

describe('Real-World E2E Scenario: Multi-Agent, MCP & Human Approval', () => {
  let app: FastifyInstance;
  let authCookie: string = '';
  let token: string = '';
  let testUserId: string = '';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PGLITE_DIR = `.data/test_hardening_pg_${Date.now()}_${process.pid}`;
    await runMigrations();
    app = await buildServer();
    await app.ready();

    // Аутентификация тестового администратора
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: process.env.ADMIN_EMAIL || 'admin@neuroflow.local',
        password: process.env.ADMIN_PASSWORD || 'NeuroFlow2026!SecureAdmin',
      },
    });

    if (loginRes.statusCode === 200) {
      const body = JSON.parse(loginRes.body);
      token = body.token;
      testUserId = body.user.id;
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await closeDatabase();
  });

  it('14-шаговый сквозной сценарий: Workflow -> AI Provider -> Agent -> MCP -> Approval -> Checkpoint Recovery', async () => {
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

    // 1. Создание Workflow
    const createWfRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      headers: authHeaders,
      payload: {
        name: 'E2E Multi-Agent Automation',
        description: 'Сквозной сценарий оркестрации и безопасности Phase 3.1',
      },
    });

    expect(createWfRes.statusCode).toBe(201);
    const wfData = JSON.parse(createWfRes.body);
    const workflowId = wfData.id;
    expect(workflowId).toBeDefined();

    // 2-3. Регистрация Custom AI Provider
    const createProviderRes = await app.inject({
      method: 'POST',
      url: '/api/ai/providers',
      headers: authHeaders,
      payload: {
        name: 'E2E Mock Provider',
        providerType: 'openai-compatible',
        baseUrl: 'https://api.mock-ai.internal/v1',
        defaultModelId: 'gpt-4o-mini',
        availableModels: [{ id: 'gpt-4o-mini', name: 'GPT-4o Mini' }],
      },
    });
    expect([200, 201]).toContain(createProviderRes.statusCode);

    // 5-6. Подключение безопасного MCP сервера
    const createMcpRes = await app.inject({
      method: 'POST',
      url: '/api/mcp',
      headers: authHeaders,
      payload: {
        name: 'E2E Local Tools MCP',
        description: 'Локальный доверенный инструментальный сервер',
        transport: 'stdio',
        command: 'node',
        args: ['-e', 'console.log(JSON.stringify({ tools: [] }))'],
      },
    });
    expect([200, 201]).toContain(createMcpRes.statusCode);
    const mcpServer = JSON.parse(createMcpRes.body);
    const mcpServerId = mcpServer.id;

    // Проверка каталога MCP
    const listMcpRes = await app.inject({
      method: 'GET',
      url: '/api/mcp',
      headers: authHeaders,
    });
    expect(listMcpRes.statusCode).toBe(200);
    const mcpList = JSON.parse(listMcpRes.body);
    expect(Array.isArray(mcpList)).toBe(true);

    // 4, 8, 9. Создание мультиагентного графа с Human Approval
    const multiAgentGraph: WorkflowGraph = {
      nodes: [
        {
          id: 'node_trigger',
          type: 'manual-trigger',
          position: { x: 0, y: 0 },
          data: { label: 'Start Task', type: 'manual-trigger', parameters: {} },
        },
        {
          id: 'node_agent_1',
          type: 'set-data', // Симулируем первый шаг агента
          position: { x: 200, y: 0 },
          data: {
            label: 'Agent 1 Analysis',
            type: 'set-data',
            parameters: {
              operations: [
                { targetKey: 'analysis.severity', sourceValue: 'critical', valueType: 'string' },
                { targetKey: 'analysis.action', sourceValue: 'reboot_cluster', valueType: 'string' },
              ],
            },
          },
        },
        {
          id: 'node_handoff',
          type: 'agent-handoff',
          position: { x: 400, y: 0 },
          data: {
            label: 'Handoff to Security Agent',
            type: 'agent-handoff',
            parameters: {
              targetAgentId: 'SecurityAgent',
              handoffReason: 'Критическое действие требует подтверждения',
              maxHandoffDepth: 3,
            },
          },
        },
        {
          id: 'node_approval',
          type: 'human-approval',
          position: { x: 600, y: 0 },
          data: {
            label: 'Operator Confirmation',
            type: 'human-approval',
            parameters: {
              actionTitle: 'Перезагрузка кластера',
              consequences: 'Временная недоступность сервиса 30 секунд',
            },
          },
        },
        {
          id: 'node_finish',
          type: 'output',
          position: { x: 800, y: 0 },
          data: { label: 'Final Result', type: 'output', parameters: { customKey: 'finalStatus' } },
        },
      ],
      edges: [
        { id: 'e1', source: 'node_trigger', target: 'node_agent_1' },
        { id: 'e2', source: 'node_agent_1', target: 'node_handoff' },
        { id: 'e3', source: 'node_handoff', target: 'node_approval' },
        { id: 'e4', source: 'node_approval', target: 'node_finish', sourceHandle: 'approved' },
      ],
    };

    // Обновляем граф воркфлоу
    await app.inject({
      method: 'PUT',
      url: `/api/workflows/${workflowId}`,
      headers: authHeaders,
      payload: {
        graph: multiAgentGraph,
      },
    });

    // 9. Первое выполнение: должно приостановиться на Human Approval
    const executionId = '00000000-0000-0000-0000-000000000088';
    const firstRunResult = await WorkflowExecutor.execute({
      executionId,
      workflowId,
      graph: multiAgentGraph,
      initialPayload: { initiator: 'Operator' },
      saveToDatabase: true,
    });

    expect(firstRunResult.status).toBe(ExecutionStatus.WAITING_FOR_APPROVAL);

    // 10. Симуляция подтверждения действия человеком (берем отпечаток из зафиксированного запроса)
    const approvalOutput = (firstRunResult.outputs?.['node_approval'] || firstRunResult.finalOutput) as Record<string, any>;
    expect(approvalOutput).toBeDefined();
    const actionFingerprint = approvalOutput.actionFingerprint;
    expect(actionFingerprint).toBeDefined();

    const approvalDecision = {
      status: 'approved',
      reviewer: 'admin@neuroflow.local',
      actionFingerprint,
    };

    // 11. Второе выполнение с переданным подтверждением (Resuming Execution с восстановлением из контрольных точек)
    const secondRunResult = await WorkflowExecutor.execute({
      executionId,
      workflowId,
      graph: multiAgentGraph,
      initialPayload: {
        initiator: 'Operator',
        approvalDecisions: {
          node_approval: approvalDecision,
        },
      },
      saveToDatabase: true,
    });

    // 12. Сценарий успешно завершен после подтверждения!
    if (secondRunResult.status !== ExecutionStatus.SUCCESS) {
      console.error('Second run error detail:', secondRunResult.error);
    }
    expect(secondRunResult.status).toBe(ExecutionStatus.SUCCESS);
    expect(secondRunResult.finalOutput).toBeDefined();

    // 13-14. Проверка системных метрик и состояния
    const metricsRes = await app.inject({
      method: 'GET',
      url: '/api/system/metrics',
    });
    expect(metricsRes.statusCode).toBe(200);
    const metricsData = JSON.parse(metricsRes.body);
    expect(metricsData.status).toBe('healthy');
    expect(metricsData.system.memory).toBeDefined();
    expect(metricsData.configuration.workerConcurrency).toBeGreaterThan(0);
  });
});
