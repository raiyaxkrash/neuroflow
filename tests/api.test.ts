import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../apps/api/src/server.js';
import { runMigrations, closeDatabase } from '../packages/database/src/index.js';
import { FastifyInstance } from 'fastify';

describe('NeuroFlow REST API Integration Tests', () => {
  let app: FastifyInstance;
  let authToken: string;
  let createdWorkflowId: string;

  beforeAll(async () => {
    // Инициализация тестовой базы данных
    process.env.NODE_ENV = 'test';
    process.env.PGLITE_DIR = '.data/test_neuroflow_pg';
    await runMigrations();

    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await closeDatabase();
  });

  it('GET /healthz — должен возвращать статус ok', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/healthz',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('neuroflow-api');
  });

  it('GET /api/nodes — должен возвращать список метаданных всех 6 узлов', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/nodes',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.total).toBeGreaterThanOrEqual(6);
    expect(body.nodes.some((n: any) => n.type === 'manual-trigger')).toBe(true);
    expect(body.nodes.some((n: any) => n.type === 'http-request')).toBe(true);
    expect(body.nodes.some((n: any) => n.type === 'condition')).toBe(true);
  });

  it('POST /api/auth/login — должен успешно авторизовывать дефолтного админа', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin@neuroflow.local',
        password: 'adminneuroflow',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe('admin@neuroflow.local');
    authToken = body.token;
  });

  it('POST /api/workflows — должен создавать новый воркфлоу с начальным графом', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        name: 'API Test Workflow',
        description: 'Воркфлоу для проверки интеграции',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.id).toBeDefined();
    expect(body.name).toBe('API Test Workflow');
    expect(body.graph.nodes.length).toBeGreaterThan(0);
    createdWorkflowId = body.id;
  });

  it('GET /api/workflows — должен возвращать созданный воркфлоу в списке', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/workflows',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.workflows.length).toBeGreaterThanOrEqual(1);
    expect(body.workflows.some((w: any) => w.id === createdWorkflowId)).toBe(true);
  });

  it('POST /api/workflows/:id/execute — должен ставить воркфлоу в очередь на выполнение', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/workflows/${createdWorkflowId}/execute`,
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        payload: { testData: 123 },
      },
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.executionId).toBeDefined();
    expect(body.status).toBe('pending');
  });

  it('GET /api/executions — должен возвращать историю запусков', async () => {
    // Небольшая пауза для завершения выполнения в очереди
    await new Promise((r) => setTimeout(r, 200));

    const res = await app.inject({
      method: 'GET',
      url: '/api/executions',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.executions.length).toBeGreaterThanOrEqual(1);
  });
});
