import { FastifyInstance } from 'fastify';
import {
  getDatabase,
  aiProviders,
  encryptData,
  decryptData,
  maskSecret,
  executions,
  nodeExecutions,
  users,
  eq,
  desc,
  and,
} from '@neuroflow/database';
import {
  CreateAIProviderSchema,
  UpdateAIProviderSchema,
  TestConnectionSchema,
  AIGenerateWorkflowSchema,
  AICopilotRequestSchema,
  AIDebugRequestSchema,
} from '@neuroflow/shared';
import { AIProviderFactory, TokenUsageManager } from '@neuroflow/nodes';
import {
  AIWorkflowGenerator,
  AICopilotService,
  AIDebuggerService,
} from '@neuroflow/workflow-engine';

export async function aiRoutes(fastify: FastifyInstance) {
  // Аутентификация пользователя (с fallback на дефолтного админа)
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

  // Получить экземпляр активного провайдера пользователя
  const resolveUserProvider = async (userId: string, requestedProviderId?: string) => {
    const db = getDatabase();

    if (requestedProviderId) {
      const [found] = await db
        .select()
        .from(aiProviders)
        .where(and(eq(aiProviders.id, requestedProviderId), eq(aiProviders.userId, userId)))
        .limit(1);
      if (found) {
        return AIProviderFactory.createProvider(found);
      }
    }

    // Ищем дефолтный
    const [defaultRow] = await db
      .select()
      .from(aiProviders)
      .where(and(eq(aiProviders.userId, userId), eq(aiProviders.isDefault, true)))
      .limit(1);
    if (defaultRow) {
      return AIProviderFactory.createProvider(defaultRow);
    }

    // Ищем любой активный
    const [firstRow] = await db
      .select()
      .from(aiProviders)
      .where(and(eq(aiProviders.userId, userId), eq(aiProviders.isEnabled, true)))
      .limit(1);
    if (firstRow) {
      return AIProviderFactory.createProvider(firstRow);
    }

    // Fallback на глобальный registered (например Mock в тестах)
    return AIProviderFactory.getInstance('default') || AIProviderFactory.getInstance('mock-provider');
  };

  // 1. Список AI провайдеров пользователя
  fastify.get('/providers', {
    schema: { tags: ['AI'], summary: 'Список подключенных AI провайдеров' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const db = getDatabase();
    const rows = await db
      .select()
      .from(aiProviders)
      .where(eq(aiProviders.userId, request.user.id))
      .orderBy(desc(aiProviders.createdAt));

    const sanitized = rows.map((r: any) => {
      let rawKey = '';
      if (r.apiKeyEncrypted) {
        try {
          rawKey = decryptData(r.apiKeyEncrypted);
        } catch {}
      }

      return {
        id: r.id,
        name: r.name,
        providerType: r.providerType,
        apiProtocol: r.apiProtocol,
        baseUrl: r.baseUrl,
        authType: r.authType,
        apiKeyMasked: maskSecret(rawKey),
        defaultModelId: r.defaultModelId,
        availableModels: r.availableModels,
        settings: r.settings,
        isDefault: r.isDefault,
        isEnabled: r.isEnabled,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });

    return reply.send({ providers: sanitized, total: sanitized.length });
  });

  // 2. Создание нового AI провайдера
  fastify.post('/providers', {
    schema: { tags: ['AI'], summary: 'Добавление нового AI провайдера с шифрованием ключа' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const parse = CreateAIProviderSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'Validation error', details: parse.error.errors });
    }

    const data = parse.data;
    const db = getDatabase();

    // Если этот провайдер выбран как дефолтный, сбрасываем признак у других
    if (data.isDefault) {
      await db.update(aiProviders).set({ isDefault: false }).where(eq(aiProviders.userId, request.user.id));
    }

    const apiKeyEncrypted = data.apiKey ? encryptData(data.apiKey) : null;
    const customHeadersEncrypted = data.customHeaders ? encryptData(JSON.stringify(data.customHeaders)) : null;

    const [created] = await db.insert(aiProviders).values({
      userId: request.user.id,
      name: data.name,
      providerType: data.providerType,
      apiProtocol: data.apiProtocol || data.providerType,
      baseUrl: data.baseUrl || null,
      authType: data.authType || 'bearer',
      apiKeyEncrypted,
      customHeadersEncrypted,
      customRequestPath: data.customRequestPath || null,
      customResponsePath: data.customResponsePath || null,
      customBodyTemplate: data.customBodyTemplate || null,
      defaultModelId: data.defaultModelId || null,
      availableModels: data.availableModels || [],
      settings: data.settings || {},
      isDefault: data.isDefault ?? false,
      isEnabled: data.isEnabled ?? true,
    }).returning();

    return reply.status(201).send({
      id: created.id,
      name: created.name,
      providerType: created.providerType,
      baseUrl: created.baseUrl,
      apiKeyMasked: maskSecret(data.apiKey || ''),
      isDefault: created.isDefault,
      isEnabled: created.isEnabled,
    });
  });

  // 3. Тестирование соединения (Test Connection)
  fastify.post('/providers/test', {
    schema: { tags: ['AI'], summary: 'Тестирование доступности AI провайдера' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const parse = TestConnectionSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'Validation error', details: parse.error.errors });
    }

    const data = parse.data;
    const adapter = AIProviderFactory.createProvider({
      id: 'test-session',
      name: 'Test Session',
      providerType: data.providerType,
      baseUrl: data.baseUrl,
      authType: data.authType,
      apiKeyPlain: data.apiKey,
      customHeadersPlain: data.customHeaders,
      customRequestPath: data.customRequestPath,
      settings: {
        allowLocalOllama: data.allowLocalOllama,
      },
    });

    const result = await adapter.testConnection(data.model);
    return reply.send(result);
  });

  // Тестирование существующего сохраненного провайдера по ID
  fastify.post('/providers/:id/test', {
    schema: { tags: ['AI'], summary: 'Тестирование сохраненного AI провайдера' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { id } = request.params;
    const provider = await resolveUserProvider(request.user.id, id);
    if (!provider) {
      return reply.status(404).send({ error: 'Провайдер не найден' });
    }
    const result = await provider.testConnection();
    return reply.send(result);
  });

  // 4. Обновление AI провайдера
  fastify.put('/providers/:id', {
    schema: { tags: ['AI'], summary: 'Редактирование параметров AI подключения' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { id } = request.params;
    const parse = UpdateAIProviderSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'Validation error', details: parse.error.errors });
    }

    const data = parse.data;
    const db = getDatabase();

    const [existing] = await db
      .select()
      .from(aiProviders)
      .where(and(eq(aiProviders.id, id), eq(aiProviders.userId, request.user.id)))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ error: 'Провайдер не найден' });
    }

    if (data.isDefault) {
      await db.update(aiProviders).set({ isDefault: false }).where(eq(aiProviders.userId, request.user.id));
    }

    const updatePayload: any = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.baseUrl !== undefined) updatePayload.baseUrl = data.baseUrl;
    if (data.authType !== undefined) updatePayload.authType = data.authType;
    if (data.apiKey !== undefined && data.apiKey !== '') updatePayload.apiKeyEncrypted = encryptData(data.apiKey);
    if (data.customHeaders !== undefined) updatePayload.customHeadersEncrypted = encryptData(JSON.stringify(data.customHeaders));
    if (data.customRequestPath !== undefined) updatePayload.customRequestPath = data.customRequestPath;
    if (data.customResponsePath !== undefined) updatePayload.customResponsePath = data.customResponsePath;
    if (data.customBodyTemplate !== undefined) updatePayload.customBodyTemplate = data.customBodyTemplate;
    if (data.defaultModelId !== undefined) updatePayload.defaultModelId = data.defaultModelId;
    if (data.availableModels !== undefined) updatePayload.availableModels = data.availableModels;
    if (data.settings !== undefined) updatePayload.settings = { ...existing.settings, ...data.settings };
    if (data.isDefault !== undefined) updatePayload.isDefault = data.isDefault;
    if (data.isEnabled !== undefined) updatePayload.isEnabled = data.isEnabled;

    const [updated] = await db.update(aiProviders).set(updatePayload).where(eq(aiProviders.id, id)).returning();
    return reply.send({
      id: updated.id,
      name: updated.name,
      isDefault: updated.isDefault,
      isEnabled: updated.isEnabled,
    });
  });

  // 5. Удаление AI провайдера
  fastify.delete('/providers/:id', {
    schema: { tags: ['AI'], summary: 'Удаление AI подключения' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { id } = request.params;
    const db = getDatabase();

    const [deleted] = await db
      .delete(aiProviders)
      .where(and(eq(aiProviders.id, id), eq(aiProviders.userId, request.user.id)))
      .returning();

    if (!deleted) {
      return reply.status(404).send({ error: 'Провайдер не найден' });
    }

    return reply.send({ success: true, message: 'Провайдер успешно удален' });
  });

  // 6. Получение списка моделей через Model Discovery
  fastify.get('/providers/:id/models', {
    schema: { tags: ['AI'], summary: 'Получение каталога моделей провайдера' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { id } = request.params;
    const provider = await resolveUserProvider(request.user.id, id);

    if (!provider) {
      return reply.status(404).send({ error: 'Провайдер не найден' });
    }

    const models = await provider.getModels();
    return reply.send({ models, total: models.length });
  });

  // 7. AI Workflow Generator
  fastify.post('/generate-workflow', {
    schema: { tags: ['AI'], summary: 'Генерация структуры воркфлоу по описанию на естественном языке' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const parse = AIGenerateWorkflowSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'Validation error', details: parse.error.errors });
    }

    const { prompt, providerId, model, contextGraph } = parse.data;
    const provider = await resolveUserProvider(request.user.id, providerId);

    if (!provider) {
      return reply.status(400).send({
        error: 'Для генерации сценариев требуется подключенный AI провайдер. Добавьте его в настройках Settings -> AI Providers.',
      });
    }

    try {
      const result = await AIWorkflowGenerator.generate(prompt, provider, {
        model,
        contextGraph,
      });

      // Учет токенов генератора воркфлоу
      try {
        const inputTokens = Math.round(prompt.length / 4);
        const outputTokens = Math.round(JSON.stringify(result).length / 4);
        await TokenUsageManager.recordUsage({
          userId: request.user.id,
          providerId: provider.id || provider.name,
          model: model || 'workflow-generator',
          inputTokens,
          outputTokens,
        });
      } catch {}

      return reply.send(result);
    } catch (err: any) {
      return reply.status(422).send({
        error: 'Не удалось сгенерировать корректный воркфлоу',
        message: err.message,
      });
    }
  });

  // 8. AI Copilot Chat & Actions
  fastify.post('/copilot', {
    schema: { tags: ['AI'], summary: 'Диалог с AI Copilot и генерация действий на канвасе' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const body: any = request.body || {};
    let messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0 && body.message) {
      const history = Array.isArray(body.history) ? body.history : [];
      messages = [...history, { role: 'user', content: body.message }];
    }

    const parsePayload = {
      ...body,
      workflowId: body.workflowId || 'draft',
      messages,
    };

    const parse = AICopilotRequestSchema.safeParse(parsePayload);
    if (!parse.success) {
      return reply.status(400).send({ error: 'Validation error', details: parse.error.errors });
    }

    const { currentGraph, providerId, model } = parse.data;
    const provider = await resolveUserProvider(request.user.id, providerId);

    if (!provider) {
      return reply.status(400).send({
        error: 'Для работы Copilot требуется подключенный AI провайдер. Добавьте его в Settings -> AI Providers.',
      });
    }

    try {
      const response = await AICopilotService.processMessage({
        messages,
        currentGraph,
        aiProvider: provider,
        model,
      });

      // Учет токенов Copilot
      try {
        const inputTokens = Math.round(JSON.stringify(messages).length / 4);
        const outputTokens = Math.round(JSON.stringify(response).length / 4);
        await TokenUsageManager.recordUsage({
          userId: request.user.id,
          providerId: provider.id || provider.name,
          model: model || 'copilot',
          workflowId: parsePayload.workflowId,
          inputTokens,
          outputTokens,
        });
      } catch {}

      return reply.send(response);
    } catch (err: any) {
      return reply.status(500).send({
        error: 'Ошибка при обработке запроса Copilot',
        message: err.message,
      });
    }
  });

  // 9. AI Debugger
  fastify.post('/debug', {
    schema: { tags: ['AI'], summary: 'Интеллектуальная диагностика ошибок выполнения' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const parse = AIDebugRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'Validation error', details: parse.error.errors });
    }

    const { executionId, failedNodeId, providerId } = parse.data;
    const db = getDatabase();

    const [execution] = await db.select().from(executions).where(eq(executions.id, executionId)).limit(1);
    if (!execution) {
      return reply.status(404).send({ error: 'Запуск не найден' });
    }

    // Ищем узел с ошибкой
    const nodeRows = await db
      .select()
      .from(nodeExecutions)
      .where(eq(nodeExecutions.executionId, executionId))
      .orderBy(desc(nodeExecutions.startedAt));

    const failedStep = failedNodeId
      ? nodeRows.find((n: any) => n.nodeId === failedNodeId)
      : nodeRows.find((n: any) => n.status === 'failed') || nodeRows[0];

    if (!failedStep && !execution.error) {
      return reply.send({
        summary: 'Ошибок выполнения не обнаружено',
        rootCause: 'Запуск завершился успешно или не содержит зафиксированных сбоев.',
        explanation: 'Все проверенные шаги выполнились без генерации исключений.',
        suggestedFix: 'Исправления не требуются.',
      });
    }

    const provider = await resolveUserProvider(request.user.id, providerId);
    if (!provider) {
      return reply.status(400).send({
        error: 'Для диагностики ошибок требуется подключенный AI провайдер. Добавьте его в настройках.',
      });
    }

    const previousOutputs: Record<string, any> = {};
    for (const row of nodeRows) {
      if (row.status === 'success' && row.outputData) {
        previousOutputs[row.nodeId] = row.outputData;
      }
    }

    const debugResponse = await AIDebuggerService.explainFailure({
      nodeType: failedStep?.nodeType || 'Workflow',
      nodeParameters: {},
      errorMessage: failedStep?.error || execution.error || 'Unknown error',
      inputData: failedStep?.inputData,
      previousNodeOutputs: previousOutputs,
      aiProvider: provider,
    });

    // Учет токенов AI Debugger
    try {
      const inputTokens = Math.round(JSON.stringify(previousOutputs).length / 4) + 200;
      const outputTokens = Math.round(JSON.stringify(debugResponse).length / 4);
      await TokenUsageManager.recordUsage({
        userId: request.user.id,
        providerId: provider.id || provider.name,
        model: 'ai-debugger',
        executionId,
        inputTokens,
        outputTokens,
      });
    } catch {}

    return reply.send(debugResponse);
  });
}
