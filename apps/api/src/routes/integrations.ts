import { FastifyInstance } from 'fastify';
import {
  getDatabase,
  integrations,
  credentials,
  users,
  workflows,
  executions,
  eq,
  desc,
  encryptData,
  decryptData,
} from '@neuroflow/database';
import {
  INTEGRATION_CATALOG,
  IntegrationServiceType,
  ExecutionStatus,
  WorkflowTriggerType,
  WorkflowGraph,
} from '@neuroflow/shared';
import {
  IntegrationService,
  TelegramPollingManager,
  TelegramUpdate,
  isAuthorizedTelegramSender,
  verifyGitHubWebhookSignature,
} from '@neuroflow/nodes';
import { getWorkflowQueue } from '@neuroflow/workflow-engine';

export async function integrationRoutes(fastify: FastifyInstance) {
  const authenticate = async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch {
      const db = getDatabase();
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@neuroflow.local';
      const [admin] = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
      if (admin) {
        request.user = { id: admin.id, email: admin.email, role: admin.role };
      } else {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    }
  };

  // Каталог поддерживаемых интеграций
  fastify.get('/catalog', {
    schema: {
      tags: ['Integrations'],
      summary: 'Каталог доступных интеграций с описанием полей и триггеров',
    },
  }, async (_request, reply) => {
    return reply.send(INTEGRATION_CATALOG);
  });

  // Список всех интеграций владельца
  fastify.get('/', {
    schema: {
      tags: ['Integrations'],
      summary: 'Список настроенных интеграций',
    },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const db = getDatabase();
    const list = await db
      .select({
        id: integrations.id,
        name: integrations.name,
        serviceType: integrations.serviceType,
        credentialId: integrations.credentialId,
        settings: integrations.settings,
        status: integrations.status,
        lastTestedAt: integrations.lastTestedAt,
        lastError: integrations.lastError,
        isEnabled: integrations.isEnabled,
        createdAt: integrations.createdAt,
        updatedAt: integrations.updatedAt,
      })
      .from(integrations)
      .where(eq(integrations.userId, request.user.id))
      .orderBy(desc(integrations.createdAt));

    return reply.send(list);
  });

  // Создание новой интеграции
  fastify.post('/', {
    schema: {
      tags: ['Integrations'],
      summary: 'Создание нового подключения интеграции с сохранением учетных данных',
    },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const db = getDatabase();
    const { name, serviceType, credentials: credData, settings = {}, isEnabled = true } = request.body || {};

    if (!name || !serviceType) {
      return reply.status(400).send({ error: 'Параметры name и serviceType обязательны.' });
    }

    let credentialId: string | null = null;

    // Если переданы секретные данные, сохраняем их в зашифрованном виде в credentials
    if (credData && Object.keys(credData).length > 0) {
      const encrypted = encryptData(JSON.stringify(credData));
      const [newCred] = await db
        .insert(credentials)
        .values({
          userId: request.user.id,
          name: `${name} Credentials`,
          type: serviceType,
          dataEncrypted: encrypted,
        })
        .returning();

      if (newCred) {
        credentialId = newCred.id;
      }
    }

    const [created] = await db
      .insert(integrations)
      .values({
        userId: request.user.id,
        name,
        serviceType,
        credentialId,
        settings,
        status: 'disconnected',
        isEnabled,
      })
      .returning();

    return reply.status(201).send(created);
  });

  // Получение интеграции по ID
  fastify.get('/:id', {
    schema: {
      tags: ['Integrations'],
      summary: 'Детали подключения интеграции',
    },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const db = getDatabase();
    const { id } = request.params;
    const [item] = await db.select().from(integrations).where(eq(integrations.id, id)).limit(1);

    if (!item) {
      return reply.status(404).send({ error: 'Интеграция не найдена' });
    }

    return reply.send(item);
  });

  // Обновление настроек интеграции
  fastify.put('/:id', {
    schema: {
      tags: ['Integrations'],
      summary: 'Обновление настроек интеграции',
    },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const db = getDatabase();
    const { id } = request.params;
    const { name, settings, isEnabled, credentials: credData } = request.body || {};

    const [existing] = await db.select().from(integrations).where(eq(integrations.id, id)).limit(1);
    if (!existing) {
      return reply.status(404).send({ error: 'Интеграция не найдена' });
    }

    if (credData && existing.credentialId) {
      const encrypted = encryptData(JSON.stringify(credData));
      await db
        .update(credentials)
        .set({ dataEncrypted: encrypted, updatedAt: new Date() })
        .where(eq(credentials.id, existing.credentialId));
    }

    const [updated] = await db
      .update(integrations)
      .set({
        ...(name ? { name } : {}),
        ...(settings ? { settings } : {}),
        ...(isEnabled !== undefined ? { isEnabled } : {}),
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, id))
      .returning();

    return reply.send(updated);
  });

  // Удаление интеграции
  fastify.delete('/:id', {
    schema: {
      tags: ['Integrations'],
      summary: 'Удаление интеграции',
    },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const db = getDatabase();
    const { id } = request.params;

    const [item] = await db.select().from(integrations).where(eq(integrations.id, id)).limit(1);
    if (!item) {
      return reply.status(404).send({ error: 'Интеграция не найдена' });
    }

    // Если был запущен long polling, останавливаем его
    if (item.credentialId) {
      const [cred] = await db.select().from(credentials).where(eq(credentials.id, item.credentialId)).limit(1);
      if (cred) {
        try {
          const dec = JSON.parse(decryptData(cred.dataEncrypted));
          if (dec.botToken) {
            TelegramPollingManager.stopPolling(dec.botToken);
          }
        } catch {
          // Игнорируем
        }
      }
    }

    await db.delete(integrations).where(eq(integrations.id, id));
    return reply.send({ success: true, message: 'Интеграция успешно удалена' });
  });

  // Test Connection: проверка подключения
  fastify.post('/:id/test', {
    schema: {
      tags: ['Integrations'],
      summary: 'Проверка подключения внешнего сервиса (Test Connection)',
    },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const db = getDatabase();
    const { id } = request.params;

    const [item] = await db.select().from(integrations).where(eq(integrations.id, id)).limit(1);
    if (!item) {
      return reply.status(404).send({ error: 'Интеграция не найдена' });
    }

    let credData: Record<string, any> = {};
    if (item.credentialId) {
      const [cred] = await db.select().from(credentials).where(eq(credentials.id, item.credentialId)).limit(1);
      if (cred) {
        try {
          credData = JSON.parse(decryptData(cred.dataEncrypted));
        } catch {
          credData = {};
        }
      }
    }

    const testRes = await IntegrationService.testConnection(
      item.serviceType as IntegrationServiceType,
      credData,
      (item.settings as any) || {}
    );

    // Обновляем статус в БД
    const newStatus = testRes.success ? 'connected' : 'error';
    await db
      .update(integrations)
      .set({
        status: newStatus,
        lastTestedAt: new Date(),
        lastError: testRes.success ? null : testRes.message,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, id));

    return reply.send({
      success: testRes.success,
      status: newStatus,
      message: testRes.message,
      details: testRes.details,
    });
  });

  // Запуск Long Polling для Telegram
  fastify.post('/:id/telegram/start-polling', {
    schema: {
      tags: ['Integrations'],
      summary: 'Запуск фонового Long Polling для Telegram бота',
    },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const db = getDatabase();
    const { id } = request.params;

    const [item] = await db.select().from(integrations).where(eq(integrations.id, id)).limit(1);
    if (!item || item.serviceType !== 'telegram') {
      return reply.status(400).send({ error: 'Интеграция Telegram не найдена' });
    }

    if (!item.credentialId) {
      return reply.status(400).send({ error: 'Отсутствуют учетные данные бота' });
    }

    const [cred] = await db.select().from(credentials).where(eq(credentials.id, item.credentialId)).limit(1);
    if (!cred) {
      return reply.status(400).send({ error: 'Учетные данные не найдены' });
    }

    const credData = JSON.parse(decryptData(cred.dataEncrypted));
    const botToken = credData.botToken || credData.token;

    if (!botToken) {
      return reply.status(400).send({ error: 'Bot Token отсутствует в учетных данных' });
    }

    const settings = (item.settings as any) || {};
    const allowedUserIds = settings.allowedUserIds || [];
    const allowedChatIds = settings.allowedChatIds || [];

    TelegramPollingManager.startPolling(
      botToken,
      async (update: TelegramUpdate) => {
        const msg = update.message;
        if (!msg) return;

        // Фильтрация по allowlist
        if (!isAuthorizedTelegramSender(msg.from?.id, msg.chat?.id, allowedUserIds, allowedChatIds)) {
          return;
        }

        // Поиск активных workflows с telegram триггерами
        const activeWorkflows = await db.select().from(workflows).where(eq(workflows.isActive, true));
        for (const wf of activeWorkflows) {
          const graph = wf.graph as WorkflowGraph;
          if (!graph || !Array.isArray(graph.nodes)) continue;

          for (const node of graph.nodes) {
            if (node.type === 'telegram-message-trigger' || node.type === 'telegram-command-trigger') {
              const executionId = crypto.randomUUID();
              await db.insert(executions).values({
                id: executionId,
                workflowId: wf.id,
                workflowVersion: wf.version,
                status: ExecutionStatus.PENDING,
                triggerType: WorkflowTriggerType.EVENT,
                inputPayload: { message: msg },
                startedAt: new Date(),
              });

              const queue = getWorkflowQueue();
              await queue.addJob({
                executionId,
                workflowId: wf.id,
                graph,
                initialPayload: { message: msg },
                triggerNodeId: node.id,
              });
            }
          }
        }
      },
      (err) => {
        console.error(`[Telegram Polling Error (${item.name})]:`, err.message);
      }
    );

    return reply.send({ success: true, message: 'Long Polling для Telegram успешно запущен' });
  });

  // Остановка Long Polling для Telegram
  fastify.post('/:id/telegram/stop-polling', {
    schema: {
      tags: ['Integrations'],
      summary: 'Остановка Long Polling для Telegram бота',
    },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const db = getDatabase();
    const { id } = request.params;

    const [item] = await db.select().from(integrations).where(eq(integrations.id, id)).limit(1);
    if (!item || !item.credentialId) {
      return reply.status(404).send({ error: 'Интеграция не найдена' });
    }

    const [cred] = await db.select().from(credentials).where(eq(credentials.id, item.credentialId)).limit(1);
    if (cred) {
      const dec = JSON.parse(decryptData(cred.dataEncrypted));
      if (dec.botToken) {
        TelegramPollingManager.stopPolling(dec.botToken);
      }
    }

    return reply.send({ success: true, message: 'Long Polling остановлен' });
  });
}
