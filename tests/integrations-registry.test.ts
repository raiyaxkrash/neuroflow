import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import { buildServer } from '../apps/api/src/server.js';
import { runMigrations, closeDatabase, getDatabase, credentials, eq, decryptData } from '@neuroflow/database';
import { FastifyInstance } from 'fastify';

describe('Universal Integrations Registry API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.PGLITE_DIR = path.resolve('./.data/test_integ_reg_' + Date.now() + '_' + process.pid);
    await runMigrations();
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
    await closeDatabase();
  });

  it('GET /api/integrations/catalog: возвращает каталог поддерживаемых интеграций', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/integrations/catalog',
    });

    expect(res.statusCode).toBe(200);
    const catalog = JSON.parse(res.body);
    expect(Array.isArray(catalog)).toBe(true);

    const types = catalog.map((c: any) => c.serviceType);
    expect(types).toContain('telegram');
    expect(types).toContain('github');
    expect(types).toContain('discord');
    expect(types).toContain('filesystem');
  });

  it('POST /api/integrations: создает подключение и безопасно шифрует credentials в БД', async () => {
    const rawBotToken = '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ';

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/integrations',
      payload: {
        name: 'Work Telegram Bot',
        serviceType: 'telegram',
        credentials: {
          botToken: rawBotToken,
        },
        settings: {
          allowedUserIds: ['1234567'],
          pollingMode: 'polling',
        },
      },
    });

    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body);
    expect(created.id).toBeDefined();
    expect(created.name).toBe('Work Telegram Bot');
    expect(created.serviceType).toBe('telegram');
    expect(created.credentialId).toBeDefined();

    // Проверяем, что в таблице credentials токен зашифрован
    const db = getDatabase();
    const [credRecord] = await db.select().from(credentials).where(eq(credentials.id, created.credentialId)).limit(1);
    expect(credRecord).toBeDefined();
    // Зашифрованные данные содержат формат iv:tag:data
    expect(credRecord.dataEncrypted).toContain(':');
    expect(credRecord.dataEncrypted).not.toBe(rawBotToken);

    // Дешифрование возвращает исходный токен
    const decryptedJson = JSON.parse(decryptData(credRecord.dataEncrypted));
    expect(decryptedJson.botToken).toBe(rawBotToken);
  });

  it('POST /api/integrations/:id/test: выполняет проверку подключения', async () => {
    // Создаем тестовую интеграцию Filesystem
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/integrations',
      payload: {
        name: 'Local Storage Filesystem',
        serviceType: 'filesystem',
        settings: {
          allowedRootPaths: ['./.data'],
        },
      },
    });

    expect(createRes.statusCode).toBe(201);
    const item = JSON.parse(createRes.body);

    const testRes = await app.inject({
      method: 'POST',
      url: `/api/integrations/${item.id}/test`,
    });

    expect(testRes.statusCode).toBe(200);
    const testResult = JSON.parse(testRes.body);
    expect(testResult.success).toBe(true);
    expect(testResult.status).toBe('connected');
  });

  it('GET /api/integrations & DELETE /api/integrations/:id', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/integrations',
    });

    expect(listRes.statusCode).toBe(200);
    const list = JSON.parse(listRes.body);
    expect(list.length).toBeGreaterThanOrEqual(2);

    const firstId = list[0].id;
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/integrations/${firstId}`,
    });

    expect(deleteRes.statusCode).toBe(200);

    const listAfterRes = await app.inject({
      method: 'GET',
      url: '/api/integrations',
    });
    const listAfter = JSON.parse(listAfterRes.body);
    expect(listAfter.some((i: any) => i.id === firstId)).toBe(false);
  });
});
