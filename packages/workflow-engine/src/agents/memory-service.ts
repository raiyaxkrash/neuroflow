import {
  getDatabase,
  agentMemories,
  eq,
  and,
  sql,
} from '@neuroflow/database';

export interface SetMemoryOptions {
  userId: string;
  scope: 'execution' | 'workflow' | 'agent' | 'user';
  key: string;
  value: any;
  metadata?: Record<string, any>;
  ttlSeconds?: number;
  agentId?: string;
  workflowId?: string;
  executionId?: string;
}

export class AgentMemoryService {
  /**
   * Получение значения из памяти агента с изоляцией по пользователю.
   */
  public static async get(
    userId: string,
    scope: 'execution' | 'workflow' | 'agent' | 'user',
    key: string
  ): Promise<any | null> {
    const db = getDatabase();
    const [row] = await db
      .select()
      .from(agentMemories)
      .where(
        and(
          eq(agentMemories.userId, userId),
          eq(agentMemories.scope, scope),
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
    const { userId, scope, key, value, metadata = {}, ttlSeconds, agentId, workflowId, executionId } = options;
    const db = getDatabase();

    const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null;
    const jsonValue = typeof value === 'object' ? value : { text: String(value) };

    const existing = await db
      .select()
      .from(agentMemories)
      .where(
        and(
          eq(agentMemories.userId, userId),
          eq(agentMemories.scope, scope),
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
        scope,
        key,
        value: jsonValue,
        metadata,
        expiresAt,
      });
    }
  }

  /**
   * Удаление записи из памяти.
   */
  public static async delete(
    userId: string,
    scope: 'execution' | 'workflow' | 'agent' | 'user',
    key: string
  ): Promise<boolean> {
    const db = getDatabase();
    const result = await db
      .delete(agentMemories)
      .where(
        and(
          eq(agentMemories.userId, userId),
          eq(agentMemories.scope, scope),
          eq(agentMemories.key, key)
        )
      );

    return true;
  }

  /**
   * Поиск записей в памяти агента.
   */
  public static async search(
    userId: string,
    scope: 'execution' | 'workflow' | 'agent' | 'user',
    query?: string,
    limit: number = 10
  ): Promise<Array<{ key: string; value: any }>> {
    const db = getDatabase();
    const rows = await db
      .select({
        key: agentMemories.key,
        value: agentMemories.value,
      })
      .from(agentMemories)
      .where(
        and(
          eq(agentMemories.userId, userId),
          eq(agentMemories.scope, scope)
        )
      )
      .limit(limit);

    if (!query) {
      return rows;
    }

    const lower = query.toLowerCase();
    return rows.filter(
      (r: any) => r.key.toLowerCase().includes(lower) || JSON.stringify(r.value).toLowerCase().includes(lower)
    );
  }
}
