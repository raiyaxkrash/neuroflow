import {
  getDatabase,
  agentMemories,
  eq,
  and,
  sql,
} from '@neuroflow/database';
import { LongTermMemoryScope } from '@neuroflow/shared';

export interface SetMemoryOptions {
  userId: string;
  scope: LongTermMemoryScope;
  key: string;
  value: any;
  metadata?: Record<string, any>;
  ttlSeconds?: number;
  agentId?: string;
  workflowId?: string;
  executionId?: string;
  confidence?: number;
  isVerified?: boolean;
  provenance?: string;
}

export class AgentMemoryService {
  /**
   * Получение значения из памяти агента с изоляцией по пользователю.
   */
  public static async get(
    userId: string,
    scope: LongTermMemoryScope,
    key: string
  ): Promise<any | null> {
    const db = getDatabase();
    const [row] = await db
      .select()
      .from(agentMemories)
      .where(
        and(
          eq(agentMemories.userId, userId),
          eq(agentMemories.scope, scope as any),
          eq(agentMemories.key, key)
        )
      )
      .limit(1);

    if (!row) return null;

    // Проверка срока жизни
    if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
      await db.delete(agentMemories).where(eq(agentMemories.id, row.id));
      return null;
    }

    return row.value;
  }

  /**
   * Сохранение или обновление факта в памяти агента.
   */
  public static async set(options: SetMemoryOptions): Promise<void> {
    const {
      userId,
      scope,
      key,
      value,
      metadata = {},
      ttlSeconds,
      agentId,
      workflowId,
      executionId,
      confidence = 100,
      isVerified = true,
      provenance,
    } = options;
    const db = getDatabase();

    const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null;
    const jsonValue = typeof value === 'object' ? value : { text: String(value) };

    const existing = await db
      .select()
      .from(agentMemories)
      .where(
        and(
          eq(agentMemories.userId, userId),
          eq(agentMemories.scope, scope as any),
          eq(agentMemories.key, key)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(agentMemories)
        .set({
          value: jsonValue,
          metadata,
          confidence,
          isVerified,
          provenance: provenance || existing[0].provenance,
          expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(agentMemories.id, existing[0].id));
    } else {
      await db.insert(agentMemories).values({
        userId,
        agentId: agentId || null,
        workflowId: workflowId || null,
        executionId: executionId || null,
        scope: scope as any,
        key,
        value: jsonValue,
        metadata,
        confidence,
        isVerified,
        provenance: provenance || 'Автоматически сформировано агентом',
        expiresAt,
      });
    }
  }

  /**
   * Удаление записи из памяти.
   */
  public static async delete(
    userId: string,
    scope: LongTermMemoryScope,
    key: string
  ): Promise<boolean> {
    const db = getDatabase();
    await db
      .delete(agentMemories)
      .where(
        and(
          eq(agentMemories.userId, userId),
          eq(agentMemories.scope, scope as any),
          eq(agentMemories.key, key)
        )
      );

    return true;
  }

  /**
   * Поиск записей в памяти агента с фильтрацией по scope и ключевым словам.
   */
  public static async search(
    userId: string,
    scope: LongTermMemoryScope,
    query?: string,
    limit: number = 10
  ): Promise<Array<{ id: string; key: string; value: any; confidence: number; isVerified: boolean; provenance?: string }>> {
    const db = getDatabase();
    const rows = await db
      .select({
        id: agentMemories.id,
        key: agentMemories.key,
        value: agentMemories.value,
        confidence: agentMemories.confidence,
        isVerified: agentMemories.isVerified,
        provenance: agentMemories.provenance,
        expiresAt: agentMemories.expiresAt,
      })
      .from(agentMemories)
      .where(
        and(
          eq(agentMemories.userId, userId),
          eq(agentMemories.scope, scope as any)
        )
      )
      .limit(limit * 2);

    const now = new Date();
    const validRows = rows.filter((r: any) => !r.expiresAt || new Date(r.expiresAt) > now);

    if (!query) {
      return validRows.slice(0, limit).map((r: any) => ({
        id: r.id,
        key: r.key,
        value: r.value,
        confidence: r.confidence || 100,
        isVerified: Boolean(r.isVerified),
        provenance: r.provenance || undefined,
      }));
    }

    const lower = query.toLowerCase();
    const matched = validRows.filter(
      (r: any) =>
        r.key.toLowerCase().includes(lower) ||
        JSON.stringify(r.value).toLowerCase().includes(lower) ||
        (r.provenance || '').toLowerCase().includes(lower)
    );

    return matched.slice(0, limit).map((r: any) => ({
      id: r.id,
      key: r.key,
      value: r.value,
      confidence: r.confidence || 100,
      isVerified: Boolean(r.isVerified),
      provenance: r.provenance || undefined,
    }));
  }

  /**
   * Консолидация памяти (Memory Consolidation):
   * Объединение нескольких разрозненных эпизодов (episodic) в долговременный семантический факт (semantic).
   */
  public static async consolidateMemories(params: {
    userId: string;
    sourcePrefix: string;
    targetSemanticKey: string;
    summaryFact: string;
    provenance?: string;
  }): Promise<{ consolidatedEpisodesCount: number; targetKey: string }> {
    const db = getDatabase();
    const episodes = await this.search(params.userId, 'episodic', params.sourcePrefix, 50);

    if (episodes.length === 0) {
      return { consolidatedEpisodesCount: 0, targetKey: params.targetSemanticKey };
    }

    // Сохранение консолидированного знания в semantic scope
    await this.set({
      userId: params.userId,
      scope: 'semantic',
      key: params.targetSemanticKey,
      value: {
        fact: params.summaryFact,
        consolidatedAt: new Date().toISOString(),
        basedOnEpisodesCount: episodes.length,
      },
      confidence: 95,
      isVerified: true,
      provenance: params.provenance || `Консолидировано из ${episodes.length} эпизодических записей`,
    });

    return {
      consolidatedEpisodesCount: episodes.length,
      targetKey: params.targetSemanticKey,
    };
  }
}

