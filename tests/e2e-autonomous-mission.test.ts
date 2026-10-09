import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../apps/api/src/server.js';
import {
  initDatabase,
  getDatabase,
  users,
  missions,
  knowledgeDocuments,
  eq,
} from '@neuroflow/database';
import { MissionStatus } from '@neuroflow/shared';

describe('E2E Autonomous Mission Lifecycle & Second Brain Integration', () => {
  let server: FastifyInstance;
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    await initDatabase();
    server = await buildServer();
    await server.ready();

    const db = getDatabase();
    const testEmail = `mission-e2e-${Date.now()}@neuroflow.local`;
    const [user] = await db
      .insert(users)
      .values({
        email: testEmail,
        passwordHash: 'hashed_password',
        role: 'owner',
      })
      .returning();

    testUserId = user.id;
    authToken = server.jwt.sign({ id: user.id, email: user.email, role: 'owner' });
  });

  afterAll(async () => {
    await server.close();
  });

  it('полный сквозной цикл: создание, планирование, запуск, верификация и сохранение в Second Brain', async () => {
    // 1. Создание миссии через REST API
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/missions',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        goal: 'Исследовать архитектурные тренды автономных агентов и сгенерировать аналитический отчет',
        title: 'Исследование автономных агентов 2026',
        tokenBudget: 60000,
        allowedTools: ['web_search', 'browser_extract', 'doc_writer'],
      },
    });

    expect(createRes.statusCode).toBe(201);
    const createData = JSON.parse(createRes.body);
    expect(createData.success).toBe(true);
    expect(createData.mission).toBeDefined();
    const missionId = createData.mission.id;

    // 2. Получение списка миссий через GET /api/missions
    const listRes = await server.inject({
      method: 'GET',
      url: '/api/missions',
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(listRes.statusCode).toBe(200);
    const listData = JSON.parse(listRes.body);
    expect(listData.missions.some((m: any) => m.id === missionId)).toBe(true);

    // 3. Получение деталей миссии до старта
    const detailsBefore = await server.inject({
      method: 'GET',
      url: `/api/missions/${missionId}`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(detailsBefore.statusCode).toBe(200);
    const beforeData = JSON.parse(detailsBefore.body);
    expect(beforeData.tasks.length).toBeGreaterThanOrEqual(2);

    // 4. Запуск выполнения миссии через POST /api/missions/:id/action (action: 'start')
    const actionRes = await server.inject({
      method: 'POST',
      url: `/api/missions/${missionId}/action`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: { action: 'start' },
    });

    expect(actionRes.statusCode).toBe(200);
    const actionData = JSON.parse(actionRes.body);
    expect(actionData.success).toBe(true);
    expect(actionData.status).toBe(MissionStatus.COMPLETED);

    // 5. Проверка состояния после выполнения миссии
    const detailsAfter = await server.inject({
      method: 'GET',
      url: `/api/missions/${missionId}`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    const afterData = JSON.parse(detailsAfter.body);
    expect(afterData.mission.status).toBe(MissionStatus.COMPLETED);
    expect(afterData.mission.tokensUsed).toBeGreaterThan(0);
    expect(afterData.mission.finalResult).toBeDefined();
    expect(afterData.tasks.every((t: any) => t.status === 'completed')).toBe(true);

    // 6. Проверка наличия чекпоинтов в GET /api/missions/:id/checkpoints
    const cpRes = await server.inject({
      method: 'GET',
      url: `/api/missions/${missionId}/checkpoints`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(cpRes.statusCode).toBe(200);
    const cpData = JSON.parse(cpRes.body);
    expect(cpData.checkpoints.length).toBeGreaterThan(0);

    // 7. Проверка наличия логов в GET /api/missions/:id/logs
    const logsRes = await server.inject({
      method: 'GET',
      url: `/api/missions/${missionId}/logs`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(logsRes.statusCode).toBe(200);
    const logsData = JSON.parse(logsRes.body);
    expect(logsData.logs.length).toBeGreaterThan(0);

    // 8. Проверка Second Brain: итоговый отчет должен быть сохранен в knowledge_documents
    const db = getDatabase();
    const secondBrainDocs = await db
      .select()
      .from(knowledgeDocuments);

    const missionDoc = secondBrainDocs.find(
      (doc) => (doc.metadata as any)?.missionId === missionId
    );

    expect(missionDoc).toBeDefined();
    expect(missionDoc?.title).toContain('Исследование автономных агентов 2026');
    expect(missionDoc?.content).toContain('Отчет по автономной миссии');
  });
});
