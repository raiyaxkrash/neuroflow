import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import {
  getDatabase,
  runMigrations,
  closeDatabase,
  users,
  knowledgeSources,
  knowledgeDocuments,
  knowledgeChunks,
  knowledgeEntities,
  knowledgeRelations,
  tokenUsages,
  eq,
} from '../packages/database/src/index.js';
import { KnowledgeService } from '../packages/nodes/src/knowledge/knowledge-service.js';
import { KnowledgeGraphService } from '../packages/nodes/src/knowledge/knowledge-graph-service.js';
import { HybridSearchEngine } from '../packages/nodes/src/knowledge/hybrid-search.js';
import { RAGEngine } from '../packages/nodes/src/knowledge/rag-engine.js';
import { TokenUsageManager } from '../packages/nodes/src/knowledge/token-manager.js';

describe('E2E Scenario: Architecture Decision & Evidence Search (Project Titan)', () => {
  let testUserId: string;
  let sourceId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PGLITE_DIR = '.data/test_neuroflow_pg';
    await runMigrations();

    const db = getDatabase();
    const [adminUser] = await db.select().from(users).where(eq(users.email, 'admin@neuroflow.local'));
    testUserId = adminUser.id;

    // Очистка таблиц перед сквозным тестом
    await db.delete(knowledgeRelations);
    await db.delete(knowledgeEntities);
    await db.delete(knowledgeChunks);
    await db.delete(knowledgeDocuments);
    await db.delete(knowledgeSources);
    await db.delete(tokenUsages);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('1. Индексация архитектурных документов проекта Titan (ADR-001, Инцидент, ADR-002)', async () => {
    // Создаем источник знаний для проектной документации
    const source = await KnowledgeService.createSource({
      userId: testUserId,
      name: 'База знаний архитектуры Titan Core',
      type: 'directory',
      pathOrUrl: path.resolve('data/test_docs'),
    });

    expect(source.id).toBeDefined();
    sourceId = source.id;

    // Читаем и вставляем 3 ключевых документа
    const adr1Path = path.resolve('data/test_docs/ADR-001-monolith-architecture.md');
    const incPath = path.resolve('data/test_docs/incident-report-2026-08.md');
    const adr2Path = path.resolve('data/test_docs/ADR-002-event-driven-migration.md');

    const adr1Content = await fs.readFile(adr1Path, 'utf-8');
    const incContent = await fs.readFile(incPath, 'utf-8');
    const adr2Content = await fs.readFile(adr2Path, 'utf-8');

    const res1 = await KnowledgeService.insertDocument({
      userId: testUserId,
      sourceId,
      title: 'ADR-001: Выбор начальной архитектуры проекта Titan (Синхронный монолит)',
      content: adr1Content,
    });

    const res2 = await KnowledgeService.insertDocument({
      userId: testUserId,
      sourceId,
      title: 'Отчёт об инциденте INC-84920: Каскадная деградация монолита Titan',
      content: incContent,
    });

    const res3 = await KnowledgeService.insertDocument({
      userId: testUserId,
      sourceId,
      title: 'ADR-002: Переход на событийно-ориентированную архитектуру (Event-Driven Architecture)',
      content: adr2Content,
    });

    expect(res1.chunkCount).toBeGreaterThan(0);
    expect(res2.chunkCount).toBeGreaterThan(0);
    expect(res3.chunkCount).toBeGreaterThan(0);

    const db = getDatabase();
    const allChunks = await db.select().from(knowledgeChunks);
    expect(allChunks.length).toBeGreaterThanOrEqual(3);
  });

  it('2. Построение графа знаний и Human-in-the-Loop верификация связи замещения', async () => {
    // Создаем сущности
    const entProject = await KnowledgeGraphService.upsertEntity({
      userId: testUserId,
      name: 'Проект Titan',
      type: 'project',
      description: 'Высоконагруженный процессинг заказов',
    });

    const entAdr1 = await KnowledgeGraphService.upsertEntity({
      userId: testUserId,
      name: 'ADR-001 (Синхронный монолит)',
      type: 'decision',
    });

    const entInc = await KnowledgeGraphService.upsertEntity({
      userId: testUserId,
      name: 'Инцидент INC-84920 (Взаимные блокировки)',
      type: 'incident',
    });

    const entAdr2 = await KnowledgeGraphService.upsertEntity({
      userId: testUserId,
      name: 'ADR-002 (Event-Driven Architecture)',
      type: 'decision',
    });

    // Создаем связи
    await KnowledgeGraphService.addRelation({
      userId: testUserId,
      fromEntityId: entAdr1.id,
      toEntityId: entProject.id,
      relationType: 'implements',
      confidence: 100,
      status: 'verified',
    });

    await KnowledgeGraphService.addRelation({
      userId: testUserId,
      fromEntityId: entInc.id,
      toEntityId: entAdr1.id,
      relationType: 'relates_to',
      confidence: 90,
      status: 'suggested',
    });

    // ADR-002 заменяет ADR-001 на основании инцидента
    const relSupersedes = await KnowledgeGraphService.addRelation({
      userId: testUserId,
      fromEntityId: entAdr2.id,
      toEntityId: entAdr1.id,
      relationType: 'supersedes',
      confidence: 85,
      provenance: 'Сформулировано на основании INC-84920 от 14 августа 2026',
      status: 'suggested',
    });

    expect(relSupersedes.status).toBe('suggested');

    // Человек верифицирует связь
    const verifiedRel = await KnowledgeGraphService.verifyRelation(relSupersedes.id, testUserId);
    expect(verifiedRel.status).toBe('verified');
    expect(verifiedRel.confidence).toBe(100);

    // Проверяем подграф окрестности ADR-002
    const neighborhood = await KnowledgeGraphService.getNeighborhood(entAdr2.id);
    expect(neighborhood.relations.some((r) => r.relationType === 'supersedes')).toBe(true);
  });

  it('3. Гибридный поиск: находит причину изменения архитектуры и документы основания', async () => {
    const question = 'Почему была изменена архитектура проекта Titan и какие документы это подтверждают?';

    const searchResults = await HybridSearchEngine.search(question, {
      userId: testUserId,
      searchMode: 'hybrid',
      limit: 5,
    });

    expect(searchResults.length).toBeGreaterThan(0);

    // В результатах должны быть документы ADR-002 и отчет об инциденте
    const titles = searchResults.map((r) => r.documentTitle);
    const hasAdr2 = titles.some((t) => t.includes('ADR-002'));
    const hasIncident = titles.some((t) => t.includes('INC-84920') || t.includes('инцидент'));

    expect(hasAdr2 || hasIncident).toBe(true);
  });

  it('4. RAG Engine: формирует аргументированный ответ со строгими цитатами первоисточников', async () => {
    const question = 'Почему была изменена архитектура проекта Titan и какие документы это подтверждают?';

    const ragResult = await RAGEngine.answerQuestion({
      question,
      userId: testUserId,
      maxChunks: 3,
      tokenBudget: 2000,
    });

    expect(ragResult.hasSufficientContext).toBe(true);
    expect(ragResult.citations.length).toBeGreaterThan(0);

    // Проверяем наличие цитат на документы
    const citedDocTitles = ragResult.citations.map((c) => c.documentTitle);
    const mentionsKeyDocs = citedDocTitles.some(
      (t) => t.includes('ADR-002') || t.includes('INC-84920') || t.includes('ADR-001')
    );
    expect(mentionsKeyDocs).toBe(true);

    // Фиксация расхода токенов через TokenUsageManager
    const usage = await TokenUsageManager.recordUsage({
      userId: testUserId,
      model: 'deterministic-rag-v1',
      providerId: 'local-second-brain',
      inputTokens: 1200,
      outputTokens: 350,
    });

    expect(usage.id).toBeDefined();
    expect(usage.totalTokens).toBe(1550);
  });
});
