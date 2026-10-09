import { FastifyPluginAsync } from 'fastify';
import {
  getDatabase,
  knowledgeSources,
  knowledgeDocuments,
  knowledgeChunks,
  agentMemories,
  users,
  eq,
  and,
  desc,
} from '@neuroflow/database';
import {
  KnowledgeService,
  HybridSearchEngine,
  RAGEngine,
  KnowledgeGraphService,
  TokenUsageManager,
} from '@neuroflow/nodes';
import {
  CreateKnowledgeSourceSchema,
  KnowledgeSearchParametersSchema,
  RAGQueryParametersSchema,
  TokenBudgetConfigSchema,
} from '@neuroflow/shared';

export const knowledgeRoutes: FastifyPluginAsync = async (fastify) => {
  const authenticate = async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      // Single-owner self-hosted fallback
      const db = getDatabase();
      const [owner] = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
      if (owner) {
        request.user = { id: owner.id, email: owner.email, role: owner.role };
        return;
      }
      return reply.status(401).send({ error: 'Необходима авторизация' });
    }
  };

  // 1. Источники знаний (Sources)
  fastify.get('/sources', {
    schema: { tags: ['Second Brain'], summary: 'Список подключенных источников знаний' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const db = getDatabase();
    const rows = await db
      .select()
      .from(knowledgeSources)
      .where(eq(knowledgeSources.userId, request.user.id))
      .orderBy(desc(knowledgeSources.createdAt));
    return reply.send(rows);
  });

  fastify.post('/sources', {
    schema: { tags: ['Second Brain'], summary: 'Подключение нового источника знаний' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const parse = CreateKnowledgeSourceSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'Некорректные параметры источника', details: parse.error.errors });
    }

    const created = await KnowledgeService.createSource({
      userId: request.user.id,
      name: parse.data.name,
      type: parse.data.type,
      pathOrUrl: parse.data.pathOrUrl,
      config: parse.data.config,
    });

    return reply.status(201).send(created);
  });

  fastify.delete('/sources/:id', {
    schema: { tags: ['Second Brain'], summary: 'Удаление источника знаний и всех его документов' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { id } = request.params;
    const ok = await KnowledgeService.deleteSource(id, request.user.id);
    if (!ok) {
      return reply.status(404).send({ error: 'Источник не найден' });
    }
    return reply.send({ success: true, message: 'Источник и все связанные документы успешно удалены' });
  });

  fastify.post('/sources/:id/sync', {
    schema: { tags: ['Second Brain'], summary: 'Запуск синхронизации и индексации источника' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { id } = request.params;
    try {
      const stats = await KnowledgeService.syncSource(id, request.user.id);
      return reply.send({ success: true, stats });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Ошибка индексации', message: err.message });
    }
  });

  // 2. Документы (Documents)
  fastify.get('/documents', {
    schema: { tags: ['Second Brain'], summary: 'Список обработанных документов' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { sourceId, status } = request.query as any;
    const db = getDatabase();

    const query = db
      .select()
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.userId, request.user.id))
      .orderBy(desc(knowledgeDocuments.createdAt));

    const rows = await query;
    const filtered = rows.filter((r: any) => {
      if (sourceId && r.sourceId !== sourceId) return false;
      if (status && r.status !== status) return false;
      return true;
    });

    return reply.send(filtered);
  });

  fastify.get('/documents/:id', {
    schema: { tags: ['Second Brain'], summary: 'Получение документа и его фрагментов (чанков)' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { id } = request.params;
    const db = getDatabase();

    const [doc] = await db
      .select()
      .from(knowledgeDocuments)
      .where(and(eq(knowledgeDocuments.id, id), eq(knowledgeDocuments.userId, request.user.id)))
      .limit(1);

    if (!doc) {
      return reply.status(404).send({ error: 'Документ не найден' });
    }

    const chunks = await db
      .select({
        id: knowledgeChunks.id,
        chunkIndex: knowledgeChunks.chunkIndex,
        content: knowledgeChunks.content,
        pageNumber: knowledgeChunks.pageNumber,
        contentHash: knowledgeChunks.contentHash,
        metadata: knowledgeChunks.metadata,
        createdAt: knowledgeChunks.createdAt,
      })
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.documentId, id))
      .orderBy(knowledgeChunks.chunkIndex);

    return reply.send({ document: doc, chunks });
  });

  fastify.delete('/documents/:id', {
    schema: { tags: ['Second Brain'], summary: 'Удаление документа и его индексов' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { id } = request.params;
    const ok = await KnowledgeService.deleteDocument(id, request.user.id);
    if (!ok) {
      return reply.status(404).send({ error: 'Документ не найден' });
    }
    return reply.send({ success: true, message: 'Документ удален' });
  });

  fastify.post('/documents', {
    schema: { tags: ['Second Brain'], summary: 'Ручное добавление заметки или текста в Second Brain' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { title, content, sourceId, metadata } = request.body as any;
    if (!content || typeof content !== 'string') {
      return reply.status(400).send({ error: 'Поле content обязательно для заполнения' });
    }

    const result = await KnowledgeService.insertDocument({
      userId: request.user.id,
      title: title || 'Новая заметка',
      content,
      sourceId,
      metadata,
    });

    return reply.status(201).send(result);
  });

  // 3. Поиск и RAG (Search & RAG)
  fastify.post('/search', {
    schema: { tags: ['Second Brain'], summary: 'Гибридный и семантический поиск по знаниям' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const parse = KnowledgeSearchParametersSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'Некорректный запрос поиска', details: parse.error.errors });
    }

    const results = await HybridSearchEngine.search(parse.data.query, {
      userId: request.user.id,
      searchMode: parse.data.searchMode,
      limit: parse.data.limit,
      minScore: parse.data.minScore,
      sourceIds: parse.data.sourceIds,
    });

    return reply.send({ query: parse.data.query, count: results.length, results });
  });

  fastify.post('/rag', {
    schema: { tags: ['Second Brain'], summary: 'RAG-генерация ответа со строгими цитатами' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const parse = RAGQueryParametersSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'Некорректный запрос RAG', details: parse.error.errors });
    }

    const result = await RAGEngine.answerQuestion({
      userId: request.user.id,
      question: parse.data.question,
      searchMode: parse.data.searchMode,
      maxChunks: parse.data.maxChunks,
      providerId: parse.data.providerId,
      model: parse.data.model,
      temperature: parse.data.temperature,
      strictCitation: parse.data.strictCitation,
    });

    return reply.send(result);
  });

  // 4. Граф знаний (Knowledge Graph)
  fastify.get('/graph', {
    schema: { tags: ['Second Brain'], summary: 'Получение графа знаний (сущности и связи)' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { search, status } = request.query as any;
    const graph = await KnowledgeGraphService.getGraph({
      userId: request.user.id,
      search,
      status,
    });
    return reply.send(graph);
  });

  fastify.post('/graph/entities', {
    schema: { tags: ['Second Brain'], summary: 'Создание или обновление сущности графа' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { name, type, description, metadata, sourceId, documentId } = request.body as any;
    if (!name || !type) {
      return reply.status(400).send({ error: 'Поля name и type обязательны' });
    }

    const entity = await KnowledgeGraphService.upsertEntity({
      userId: request.user.id,
      name,
      type,
      description,
      metadata,
      sourceId,
      documentId,
    });

    return reply.status(201).send(entity);
  });

  fastify.post('/graph/relations', {
    schema: { tags: ['Second Brain'], summary: 'Добавление связи в граф знаний' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { fromEntityId, toEntityId, relationType, confidence, provenance, status } = request.body as any;
    if (!fromEntityId || !toEntityId || !relationType) {
      return reply.status(400).send({ error: 'fromEntityId, toEntityId и relationType обязательны' });
    }

    const rel = await KnowledgeGraphService.addRelation({
      userId: request.user.id,
      fromEntityId,
      toEntityId,
      relationType,
      confidence,
      provenance,
      status,
    });

    return reply.status(201).send(rel);
  });

  fastify.patch('/graph/relations/:id/verify', {
    schema: { tags: ['Second Brain'], summary: 'Подтверждение связи человеком' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { id } = request.params;
    try {
      const verified = await KnowledgeGraphService.verifyRelation(id, request.user.id);
      return reply.send(verified);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });

  fastify.patch('/graph/relations/:id/reject', {
    schema: { tags: ['Second Brain'], summary: 'Отклонение предложенной связи' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { id } = request.params;
    try {
      const rejected = await KnowledgeGraphService.rejectRelation(id);
      return reply.send(rejected);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });

  // 5. Память агентов (Agent Memory)
  fastify.get('/memory', {
    schema: { tags: ['Second Brain'], summary: 'Просмотр записей памяти агентов' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { scope = 'semantic', query, limit = 20 } = request.query as any;
    const db = getDatabase();

    const rows = await db
      .select()
      .from(agentMemories)
      .where(and(eq(agentMemories.userId, request.user.id), eq(agentMemories.scope, scope)))
      .orderBy(desc(agentMemories.createdAt))
      .limit(Number(limit));

    if (query) {
      const lower = String(query).toLowerCase();
      const filtered = rows.filter(
        (r: any) =>
          r.key.toLowerCase().includes(lower) ||
          JSON.stringify(r.value).toLowerCase().includes(lower) ||
          (r.provenance || '').toLowerCase().includes(lower)
      );
      return reply.send(filtered);
    }

    return reply.send(rows);
  });

  fastify.delete('/memory/:id', {
    schema: { tags: ['Second Brain'], summary: 'Удаление записи из памяти' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { id } = request.params;
    const db = getDatabase();
    const [deleted] = await db
      .delete(agentMemories)
      .where(and(eq(agentMemories.id, id), eq(agentMemories.userId, request.user.id)))
      .returning();

    if (!deleted) {
      return reply.status(404).send({ error: 'Запись памяти не найдена' });
    }
    return reply.send({ success: true, message: 'Запись удалена' });
  });

  // 6. Учет токенов и бюджет (Token Manager)
  fastify.get('/tokens/stats', {
    schema: { tags: ['Second Brain'], summary: 'Статистика расхода токенов и стоимости' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const stats = await TokenUsageManager.getStats(request.user.id);
    return reply.send(stats);
  });

  fastify.get('/tokens/budget', {
    schema: { tags: ['Second Brain'], summary: 'Текущий бюджет токенов' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const budget = await TokenUsageManager.getBudgetConfig(request.user.id);
    return reply.send(budget);
  });

  fastify.post('/tokens/budget', {
    schema: { tags: ['Second Brain'], summary: 'Обновление лимитов бюджета токенов' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const parse = TokenBudgetConfigSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'Некорректная конфигурация бюджета', details: parse.error.errors });
    }

    const updated = await TokenUsageManager.saveBudgetConfig(request.user.id, parse.data);
    return reply.send(updated);
  });
};
