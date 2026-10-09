import {
  getDatabase,
  knowledgeEntities,
  knowledgeRelations,
  eq,
  and,
} from '@neuroflow/database';
import {
  KnowledgeEntityType,
  KnowledgeRelationType,
  KnowledgeRelationStatus,
  KnowledgeEntityDto,
  KnowledgeRelationDto,
} from '@neuroflow/shared';

export interface UpsertEntityOptions {
  userId: string;
  name: string;
  type: KnowledgeEntityType;
  description?: string;
  sourceId?: string;
  documentId?: string;
  metadata?: Record<string, any>;
}

export interface AddRelationOptions {
  userId: string;
  fromEntityId: string;
  toEntityId: string;
  relationType: KnowledgeRelationType;
  confidence?: number;
  provenance?: string;
  status?: KnowledgeRelationStatus;
  verifiedBy?: string;
}

export class KnowledgeGraphService {
  /**
   * Добавление или обновление сущности в графе знаний
   */
  public static async upsertEntity(options: UpsertEntityOptions): Promise<KnowledgeEntityDto> {
    const db = getDatabase();
    const cleanName = options.name.trim();

    // Поиск существующей сущности с таким же именем и типом
    const existing = await db
      .select()
      .from(knowledgeEntities)
      .where(
        and(
          eq(knowledgeEntities.userId, options.userId),
          eq(knowledgeEntities.name, cleanName),
          eq(knowledgeEntities.type, options.type)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0];
      const [updated] = await db
        .update(knowledgeEntities)
        .set({
          description: options.description || row.description,
          sourceId: options.sourceId || row.sourceId,
          documentId: options.documentId || row.documentId,
          metadata: { ...((row.metadata as any) || {}), ...(options.metadata || {}) },
          updatedAt: new Date(),
        })
        .where(eq(knowledgeEntities.id, row.id))
        .returning();

      return this.mapEntityToDto(updated);
    }

    const [created] = await db
      .insert(knowledgeEntities)
      .values({
        userId: options.userId,
        name: cleanName,
        type: options.type,
        description: options.description || null,
        sourceId: options.sourceId || null,
        documentId: options.documentId || null,
        metadata: options.metadata || {},
      })
      .returning();

    return this.mapEntityToDto(created);
  }

  /**
   * Добавление связи между сущностями (по умолчанию статус 'suggested' с provenance и confidence)
   */
  public static async addRelation(options: AddRelationOptions): Promise<KnowledgeRelationDto> {
    const db = getDatabase();
    const confidence = options.confidence !== undefined ? options.confidence : 80;
    const status: KnowledgeRelationStatus = options.status || 'suggested';

    // Проверка существующей связи
    const existing = await db
      .select()
      .from(knowledgeRelations)
      .where(
        and(
          eq(knowledgeRelations.userId, options.userId),
          eq(knowledgeRelations.fromEntityId, options.fromEntityId),
          eq(knowledgeRelations.toEntityId, options.toEntityId),
          eq(knowledgeRelations.relationType, options.relationType)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0];
      const [updated] = await db
        .update(knowledgeRelations)
        .set({
          confidence: Math.max(row.confidence, confidence),
          provenance: options.provenance || row.provenance,
          status: status !== 'suggested' ? status : row.status as any,
          verifiedBy: options.verifiedBy || row.verifiedBy,
          updatedAt: new Date(),
        })
        .where(eq(knowledgeRelations.id, row.id))
        .returning();

      return this.mapRelationToDto(updated);
    }

    const [created] = await db
      .insert(knowledgeRelations)
      .values({
        userId: options.userId,
        fromEntityId: options.fromEntityId,
        toEntityId: options.toEntityId,
        relationType: options.relationType,
        confidence,
        provenance: options.provenance || 'Автоматически извлечено из документации',
        status,
        verifiedBy: options.verifiedBy || null,
      })
      .returning();

    return this.mapRelationToDto(created);
  }

  /**
   * Подтверждение связи человеком (Human Verification)
   */
  public static async verifyRelation(relationId: string, verifiedByUserId: string): Promise<KnowledgeRelationDto> {
    const db = getDatabase();
    const [updated] = await db
      .update(knowledgeRelations)
      .set({
        status: 'verified',
        verifiedBy: verifiedByUserId,
        confidence: 100,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeRelations.id, relationId))
      .returning();

    if (!updated) {
      throw new Error(`Связь с id ${relationId} не найдена.`);
    }

    return this.mapRelationToDto(updated);
  }

  /**
   * Отклонение связи
   */
  public static async rejectRelation(relationId: string): Promise<KnowledgeRelationDto> {
    const db = getDatabase();
    const [updated] = await db
      .update(knowledgeRelations)
      .set({
        status: 'rejected',
        updatedAt: new Date(),
      })
      .where(eq(knowledgeRelations.id, relationId))
      .returning();

    if (!updated) {
      throw new Error(`Связь с id ${relationId} не найдена.`);
    }

    return this.mapRelationToDto(updated);
  }

  /**
   * Получение графа знаний (сущности и связи) с фильтрами
   */
  public static async getGraph(options: {
    userId?: string;
    entityTypes?: KnowledgeEntityType[];
    relationTypes?: KnowledgeRelationType[];
    status?: KnowledgeRelationStatus;
    search?: string;
  } = {}): Promise<{
    entities: KnowledgeEntityDto[];
    relations: KnowledgeRelationDto[];
  }> {
    const db = getDatabase();

    const entitiesQuery = db.select().from(knowledgeEntities);
    const rawEntities = await entitiesQuery;

    const filteredEntities = rawEntities.filter((e: any) => {
      if (options.userId && e.userId !== options.userId) return false;
      if (options.entityTypes && options.entityTypes.length > 0 && !options.entityTypes.includes(e.type as any)) return false;
      if (options.search) {
        const q = options.search.toLowerCase();
        return e.name.toLowerCase().includes(q) || (e.description || '').toLowerCase().includes(q);
      }
      return true;
    });

    const entityIds = new Set(filteredEntities.map((e: any) => e.id));

    const rawRelations = await db.select().from(knowledgeRelations);
    const filteredRelations = rawRelations.filter((r: any) => {
      if (options.userId && r.userId !== options.userId) return false;
      if (!entityIds.has(r.fromEntityId) || !entityIds.has(r.toEntityId)) return false;
      if (options.relationTypes && options.relationTypes.length > 0 && !options.relationTypes.includes(r.relationType as any)) return false;
      if (options.status && r.status !== options.status) return false;
      return true;
    });

    return {
      entities: filteredEntities.map(this.mapEntityToDto),
      relations: filteredRelations.map(this.mapRelationToDto),
    };
  }

  /**
   * Получение окрестности заданной сущности (центр, смежные узлы и связи)
   */
  public static async getNeighborhood(entityId: string): Promise<{
    centerEntity: KnowledgeEntityDto;
    neighborEntities: KnowledgeEntityDto[];
    relations: KnowledgeRelationDto[];
  }> {
    const db = getDatabase();
    const [center] = await db
      .select()
      .from(knowledgeEntities)
      .where(eq(knowledgeEntities.id, entityId))
      .limit(1);

    if (!center) {
      throw new Error(`Сущность с id ${entityId} не найдена.`);
    }

    const allRelations = await db.select().from(knowledgeRelations);
    const incidentRelations = allRelations.filter(
      (r: any) => r.fromEntityId === entityId || r.toEntityId === entityId
    );

    const neighborIds = new Set<string>();
    incidentRelations.forEach((r: any) => {
      if (r.fromEntityId !== entityId) neighborIds.add(r.fromEntityId);
      if (r.toEntityId !== entityId) neighborIds.add(r.toEntityId);
    });

    const allEntities = await db.select().from(knowledgeEntities);
    const neighbors = allEntities.filter((e: any) => neighborIds.has(e.id));

    return {
      centerEntity: this.mapEntityToDto(center),
      neighborEntities: neighbors.map(this.mapEntityToDto),
      relations: incidentRelations.map(this.mapRelationToDto),
    };
  }

  private static mapEntityToDto(e: any): KnowledgeEntityDto {
    return {
      id: e.id,
      userId: e.userId,
      sourceId: e.sourceId,
      documentId: e.documentId,
      name: e.name,
      type: e.type,
      description: e.description,
      metadata: (e.metadata as any) || {},
      createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : String(e.createdAt),
      updatedAt: e.updatedAt instanceof Date ? e.updatedAt.toISOString() : String(e.updatedAt),
    };
  }

  private static mapRelationToDto(r: any): KnowledgeRelationDto {
    return {
      id: r.id,
      userId: r.userId,
      fromEntityId: r.fromEntityId,
      toEntityId: r.toEntityId,
      relationType: r.relationType,
      confidence: r.confidence,
      provenance: r.provenance,
      status: r.status,
      verifiedBy: r.verifiedBy,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
    };
  }
}
