import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { KnowledgeGraphService } from '../packages/nodes/src/knowledge/knowledge-graph-service.js';
import {
  getDatabase,
  runMigrations,
  closeDatabase,
  users,
  knowledgeEntities,
  knowledgeRelations,
  eq,
} from '../packages/database/src/index.js';

describe('Second Brain: Knowledge Graph & Human Verification', () => {
  let testUserId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PGLITE_DIR = '.data/test_neuroflow_pg';
    await runMigrations();

    const db = getDatabase();
    const [adminUser] = await db.select().from(users).where(eq(users.email, 'admin@neuroflow.local'));
    testUserId = adminUser.id;
  });

  beforeEach(async () => {
    const db = getDatabase();
    await db.delete(knowledgeRelations);
    await db.delete(knowledgeEntities);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('должен создавать и обновлять сущности в графе знаний', async () => {
    const entity = await KnowledgeGraphService.upsertEntity({
      userId: testUserId,
      name: 'Проект Titan',
      type: 'project',
      description: 'Основная платформа процессинга заказов',
      metadata: { version: '2.0.0' },
    });

    expect(entity.id).toBeDefined();
    expect(entity.name).toBe('Проект Titan');
    expect(entity.type).toBe('project');
    expect(entity.metadata?.version).toBe('2.0.0');

    // Повторный вызов с тем же именем и типом должен обновить запись, а не создать дубликат
    const updated = await KnowledgeGraphService.upsertEntity({
      userId: testUserId,
      name: 'Проект Titan',
      type: 'project',
      description: 'Обновленное описание платформы',
      metadata: { version: '2.1.0' },
    });

    expect(updated.id).toBe(entity.id);
    expect(updated.description).toBe('Обновленное описание платформы');
    expect(updated.metadata?.version).toBe('2.1.0');
  });

  it('должен создавать связь со статусом suggested по умолчанию и сохранять provenance', async () => {
    const entProject = await KnowledgeGraphService.upsertEntity({
      userId: testUserId,
      name: 'Titan Core',
      type: 'project',
    });

    const entDoc = await KnowledgeGraphService.upsertEntity({
      userId: testUserId,
      name: 'ADR-002-event-driven-migration.md',
      type: 'document',
    });

    const relation = await KnowledgeGraphService.addRelation({
      userId: testUserId,
      fromEntityId: entDoc.id,
      toEntityId: entProject.id,
      relationType: 'implements',
      confidence: 85,
      provenance: 'Извлечено автоматическим анализатором архитектуры',
    });

    expect(relation.id).toBeDefined();
    expect(relation.status).toBe('suggested');
    expect(relation.confidence).toBe(85);
    expect(relation.provenance).toContain('Извлечено автоматическим анализатором');
  });

  it('должен позволять человеку подтвердить связь (Human Verification) со 100% confidence', async () => {
    const entFrom = await KnowledgeGraphService.upsertEntity({
      userId: testUserId,
      name: 'Инцидент INC-84920',
      type: 'incident',
    });

    const entTo = await KnowledgeGraphService.upsertEntity({
      userId: testUserId,
      name: 'ADR-001 (Синхронный монолит)',
      type: 'decision',
    });

    const createdRel = await KnowledgeGraphService.addRelation({
      userId: testUserId,
      fromEntityId: entFrom.id,
      toEntityId: entTo.id,
      relationType: 'supersedes',
      confidence: 75,
    });

    expect(createdRel.status).toBe('suggested');

    // Человек подтверждает корректность связи
    const verified = await KnowledgeGraphService.verifyRelation(createdRel.id, testUserId);

    expect(verified.status).toBe('verified');
    expect(verified.confidence).toBe(100);
    expect(verified.verifiedBy).toBe(testUserId);
  });

  it('должен позволять человеку отклонить неверную связь (rejectRelation)', async () => {
    const ent1 = await KnowledgeGraphService.upsertEntity({
      userId: testUserId,
      name: 'Несвязанный компонент A',
      type: 'tool',
    });

    const ent2 = await KnowledgeGraphService.upsertEntity({
      userId: testUserId,
      name: 'Несвязанный компонент B',
      type: 'tool',
    });

    const relation = await KnowledgeGraphService.addRelation({
      userId: testUserId,
      fromEntityId: ent1.id,
      toEntityId: ent2.id,
      relationType: 'depends_on',
      confidence: 50,
    });

    const rejected = await KnowledgeGraphService.rejectRelation(relation.id);
    expect(rejected.status).toBe('rejected');
  });

  it('должен извлекать подграф окрестности узла (getNeighborhood)', async () => {
    const center = await KnowledgeGraphService.upsertEntity({
      userId: testUserId,
      name: 'Центральный сервис платежей',
      type: 'project',
    });

    const leaf1 = await KnowledgeGraphService.upsertEntity({
      userId: testUserId,
      name: 'Kafka Event Bus',
      type: 'technology',
    });

    const leaf2 = await KnowledgeGraphService.upsertEntity({
      userId: testUserId,
      name: 'Stripe Gateway',
      type: 'integration',
    });

    await KnowledgeGraphService.addRelation({
      userId: testUserId,
      fromEntityId: center.id,
      toEntityId: leaf1.id,
      relationType: 'depends_on',
    });

    await KnowledgeGraphService.addRelation({
      userId: testUserId,
      fromEntityId: center.id,
      toEntityId: leaf2.id,
      relationType: 'uses',
    });

    const neighborhood = await KnowledgeGraphService.getNeighborhood(center.id);

    expect(neighborhood.centerEntity.id).toBe(center.id);
    expect(neighborhood.neighborEntities.length).toBeGreaterThanOrEqual(2);
    expect(neighborhood.relations.length).toBeGreaterThanOrEqual(2);
  });
});
