import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../apps/api/src/server.js';
import { runMigrations, closeDatabase, getDatabase, workflows, executions, nodeExecutions } from '../packages/database/src/index.js';
import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { ExecutionStatus, NodeExecutionStatus } from '../packages/shared/src/index.js';

describe('End-to-End User Scenario Verification', () => {
  let app: FastifyInstance;
  let authToken: string;
  let workflowId: string;
  let executionId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PGLITE_DIR = '.data/test_e2e_pg';
    await runMigrations();

    app = await buildServer();
    await app.ready();

    // 1. Авторизация
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin@neuroflow.local',
        password: 'adminneuroflow',
      },
    });
    const loginData = JSON.parse(loginRes.body);
    authToken = loginData.token;
  });

  afterAll(async () => {
    if (app) await app.close();
    await closeDatabase();
  });

  it('Шаг 1-2: Пользователь открывает NeuroFlow и создаёт новый workflow', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: 'Order Processing Pipeline',
        description: 'Реальная автоматизация с ветвлением и проверкой условий',
      },
    });

    expect(res.statusCode).toBe(201);
    const data = JSON.parse(res.body);
    expect(data.id).toBeDefined();
    expect(data.name).toBe('Order Processing Pipeline');
    workflowId = data.id;
  });

  it('Шаги 3-9: Сборка графа (Manual Trigger -> Set Data -> Condition -> True Output / False Output) и сохранение в БД', async () => {
    const fullGraph = {
      nodes: [
        {
          id: 'manual_trigger_1',
          type: 'manual-trigger',
          position: { x: 50, y: 150 },
          data: {
            label: 'Order Trigger',
            type: 'manual-trigger',
            parameters: {},
          },
        },
        {
          id: 'set_data_1',
          type: 'set-data',
          position: { x: 300, y: 150 },
          data: {
            label: 'Configure Order',
            type: 'set-data',
            parameters: {
              operations: [
                { targetKey: 'order.id', sourceValue: 'ORD-9821', valueType: 'string' },
                { targetKey: 'order.amount', sourceValue: 450, valueType: 'number' },
                { targetKey: 'order.isPriority', sourceValue: true, valueType: 'boolean' },
                { targetKey: 'order.status', sourceValue: 'approved', valueType: 'string' },
              ],
            },
          },
        },
        {
          id: 'condition_1',
          type: 'condition',
          position: { x: 550, y: 150 },
          data: {
            label: 'Check If Approved',
            type: 'condition',
            parameters: {
              leftValue: 'order.status',
              operator: 'equals',
              rightValue: 'approved',
            },
          },
        },
        {
          id: 'output_true',
          type: 'output',
          position: { x: 800, y: 50 },
          data: {
            label: 'Approved Output',
            type: 'output',
            parameters: {
              customKey: 'finalApprovedOrder',
            },
          },
        },
        {
          id: 'output_false',
          type: 'output',
          position: { x: 800, y: 250 },
          data: {
            label: 'Rejected Output',
            type: 'output',
            parameters: {
              customKey: 'finalRejectedOrder',
            },
          },
        },
      ],
      edges: [
        { id: 'edge_1', source: 'manual_trigger_1', target: 'set_data_1' },
        { id: 'edge_2', source: 'set_data_1', target: 'condition_1' },
        { id: 'edge_3', source: 'condition_1', target: 'output_true', sourceHandle: 'true' },
        { id: 'edge_4', source: 'condition_1', target: 'output_false', sourceHandle: 'false' },
      ],
    };

    // Сохраняем обновленный граф воркфлоу через PUT
    const saveRes = await app.inject({
      method: 'PUT',
      url: `/api/workflows/${workflowId}`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: 'Order Processing Pipeline',
        graph: fullGraph,
      },
    });

    expect(saveRes.statusCode).toBe(200);
    const updated = JSON.parse(saveRes.body);
    expect(updated.graph.nodes.length).toBe(5);
    expect(updated.graph.edges.length).toBe(4);
    expect(updated.version).toBe(2);
  });

  it('Шаги 10-12: Запуск воркфлоу и получение настоящего результата', async () => {
    const execRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${workflowId}/execute`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        payload: { source: 'unit_e2e_test' },
      },
    });

    expect(execRes.statusCode).toBe(202);
    const execData = JSON.parse(execRes.body);
    expect(execData.executionId).toBeDefined();
    executionId = execData.executionId;

    // Ожидаем завершения фонового выполнения
    let attempts = 0;
    let finished = false;
    let latestDetails: any = null;

    while (attempts < 20 && !finished) {
      await new Promise((r) => setTimeout(r, 200));
      const statusRes = await app.inject({
        method: 'GET',
        url: `/api/executions/${executionId}`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      latestDetails = JSON.parse(statusRes.body);
      if (latestDetails.status === ExecutionStatus.SUCCESS || latestDetails.status === ExecutionStatus.FAILED) {
        finished = true;
      }
      attempts++;
    }

    expect(latestDetails.status).toBe(ExecutionStatus.SUCCESS);
    expect(latestDetails.durationMs).toBeGreaterThanOrEqual(0);

    // Проверяем настоящий результат в outputPayload
    expect(latestDetails.outputPayload).toBeDefined();
    expect(latestDetails.outputPayload.finalApprovedOrder).toBeDefined();
    expect(latestDetails.outputPayload.finalApprovedOrder.order.id).toBe('ORD-9821');
    expect(latestDetails.outputPayload.finalApprovedOrder.order.amount).toBe(450);
    expect(latestDetails.outputPayload.finalApprovedOrder.order.isPriority).toBe(true);
    expect(latestDetails.outputPayload.finalApprovedOrder.order.status).toBe('approved');
  });

  it('Шаги 13-14: Перезагрузка и проверка сохранения графа и истории в PostgreSQL', async () => {
    // Симулируем "перезагрузку страницы" — повторное получение через GET из БД
    const reloadWorkflowRes = await app.inject({
      method: 'GET',
      url: `/api/workflows/${workflowId}`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(reloadWorkflowRes.statusCode).toBe(200);
    const reloadedWf = JSON.parse(reloadWorkflowRes.body);
    expect(reloadedWf.id).toBe(workflowId);
    expect(reloadedWf.graph.nodes.length).toBe(5);

    // Проверка истории запусков
    const historyRes = await app.inject({
      method: 'GET',
      url: `/api/executions?workflowId=${workflowId}`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(historyRes.statusCode).toBe(200);
    const historyData = JSON.parse(historyRes.body);
    expect(historyData.executions.length).toBeGreaterThanOrEqual(1);
    expect(historyData.executions[0].id).toBe(executionId);
    expect(historyData.executions[0].status).toBe(ExecutionStatus.SUCCESS);
  });
});
