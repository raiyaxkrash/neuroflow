import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import path from 'node:path';
import {
  ScheduleTriggerNode,
  WebhookTriggerNode,
} from '../packages/nodes/src/index.js';
import { SchedulerEngine } from '../packages/workflow-engine/src/index.js';
import { WORKFLOW_TEMPLATES } from '@neuroflow/shared';
import { buildServer } from '../apps/api/src/server.js';
import { runMigrations, closeDatabase } from '@neuroflow/database';
import { FastifyInstance } from 'fastify';

describe('Scheduler Engine, Webhook Trigger & Templates', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.PGLITE_DIR = path.resolve('./.data/test_sched_' + Date.now() + '_' + process.pid);
    await runMigrations();
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    SchedulerEngine.stopAll();
    if (app) await app.close();
    await closeDatabase();
  });

  it('SchedulerEngine: корректно преобразует различные режимы расписания в cron/интервалы', () => {
    // 1. Интервал
    const intervalResolved = SchedulerEngine.resolveCronPattern({
      workflowId: 'wf1',
      triggerNodeId: 'node1',
      mode: 'interval',
      intervalMinutes: 15,
    });
    expect(intervalResolved.everyMs).toBe(15 * 60 * 1000);

    // 2. Ежедневно в указанное время
    const dailyResolved = SchedulerEngine.resolveCronPattern({
      workflowId: 'wf2',
      triggerNodeId: 'node2',
      mode: 'daily',
      timeOfDay: '14:30',
    });
    expect(dailyResolved.pattern).toBe('30 14 * * *');

    // 3. Еженедельно
    const weeklyResolved = SchedulerEngine.resolveCronPattern({
      workflowId: 'wf3',
      triggerNodeId: 'node3',
      mode: 'weekly',
      timeOfDay: '09:00',
      daysOfWeek: [1, 3, 5],
    });
    expect(weeklyResolved.pattern).toBe('0 9 * * 1,3,5');
  });

  it('WebhookTriggerNode: проверяет HTTP метод и отклоняет несоответствующий', async () => {
    const webhook = new WebhookTriggerNode();

    await expect(
      webhook.execute({
        nodeId: 'wh1',
        parameters: { httpMethod: 'POST' },
        inputData: { method: 'GET' },
      })
    ).rejects.toThrow(/Метод запроса GET не разрешен/);
  });

  it('WebhookTriggerNode: валидирует HMAC SHA-256 подпись входящего запроса', async () => {
    const webhook = new WebhookTriggerNode();
    const secret = 'webhook-hmac-secret-123';
    const body = { event: 'order.completed', amount: 500 };
    const rawBody = JSON.stringify(body);

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody);
    const validSig = hmac.digest('hex');

    // Валидный запрос с HMAC
    const output = await webhook.execute({
      nodeId: 'wh2',
      parameters: {
        httpMethod: 'POST',
        authType: 'hmac',
        authSecret: secret,
        hmacHeader: 'x-signature',
      },
      inputData: {
        method: 'POST',
        body,
        rawBody,
        headers: { 'x-signature': validSig },
      },
    });

    expect(output.outputData?.body).toEqual(body);
    expect(output.outputData?.receivedAt).toBeDefined();

    // Неверный HMAC отклоняется
    await expect(
      webhook.execute({
        nodeId: 'wh2',
        parameters: {
          httpMethod: 'POST',
          authType: 'hmac',
          authSecret: secret,
          hmacHeader: 'x-signature',
        },
        inputData: {
          method: 'POST',
          body,
          rawBody,
          headers: { 'x-signature': 'forged_sig' },
        },
      })
    ).rejects.toThrow(/Недействительная HMAC подпись/);
  });

  it('WORKFLOW_TEMPLATES: библиотека содержит все требуемые готовые шаблоны', () => {
    expect(WORKFLOW_TEMPLATES.length).toBeGreaterThanOrEqual(4);

    const ids = WORKFLOW_TEMPLATES.map((t) => t.id);
    expect(ids).toContain('telegram-ai-assistant');
    expect(ids).toContain('github-monitor');
    expect(ids).toContain('daily-ai-summary');
    expect(ids).toContain('personal-document-processor');

    for (const tpl of WORKFLOW_TEMPLATES) {
      expect(tpl.graph.nodes.length).toBeGreaterThanOrEqual(3);
      expect(tpl.graph.edges.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('API: создание воркфлоу из шаблона, экспорт и импорт схемы', async () => {
    // 1. Получение каталога шаблонов
    const templatesRes = await app.inject({
      method: 'GET',
      url: '/api/workflows/templates',
    });
    expect(templatesRes.statusCode).toBe(200);
    const templates = JSON.parse(templatesRes.body);
    expect(templates.length).toBeGreaterThanOrEqual(4);

    // 2. Создание воркфлоу из шаблона "telegram-ai-assistant"
    const instantiateRes = await app.inject({
      method: 'POST',
      url: '/api/workflows/templates/telegram-ai-assistant/instantiate',
    });
    expect(instantiateRes.statusCode).toBe(201);
    const createdWf = JSON.parse(instantiateRes.body);
    expect(createdWf.name).toBe('Telegram AI Assistant');
    expect(createdWf.graph.nodes.length).toBe(3);

    // 3. Экспорт воркфлоу в JSON
    const exportRes = await app.inject({
      method: 'GET',
      url: `/api/workflows/${createdWf.id}/export`,
    });
    expect(exportRes.statusCode).toBe(200);
    const exportedData = JSON.parse(exportRes.body);
    expect(exportedData.neuroflowSchemaVersion).toBe('1.0');
    expect(exportedData.graph.nodes.length).toBe(3);

    // 4. Импорт воркфлоу из экспортированного JSON
    const importRes = await app.inject({
      method: 'POST',
      url: '/api/workflows/import',
      payload: exportedData,
    });
    expect(importRes.statusCode).toBe(201);
    const importedWf = JSON.parse(importRes.body);
    expect(importedWf.name).toContain('Telegram AI Assistant');
    expect(importedWf.graph.nodes.length).toBe(3);
  });
});
