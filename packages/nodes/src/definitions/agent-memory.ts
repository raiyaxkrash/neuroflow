import { BaseNodeDef, NodeExecutionContext, NodeExecutionOutput } from '../base.js';
import { NodeCategory, WorkflowPortDefinition, AgentMemoryParametersSchema } from '@neuroflow/shared';
import { getDatabase, agentMemories, eq, and, sql } from '@neuroflow/database';

// In-memory резервное хранилище для тестов и локального выполнения без БД
const inMemoryStore = new Map<string, any>();

export class AgentMemoryNode extends BaseNodeDef {
  type = 'agent-memory';
  name = 'Agent Memory';
  description = 'Управляемая память агентов: сохранение фактов, извлечение контекста и поиск';
  category = NodeCategory.AGENT;
  icon = 'Brain';
  color = '#10B981';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Данные для сохранения или параметры запроса' },
  ];

  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Output', type: 'main', description: 'Извлеченные данные или статус операции' },
  ];

  parameterSchema = AgentMemoryParametersSchema;
  defaultParameters = {
    operation: 'read',
    scope: 'persistent',
    key: '',
    value: '',
    searchQuery: '',
    limit: 5,
    ttlSeconds: undefined,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const inputData = (context as any).inputData ?? (context as any).input ?? {};
    const operation = params.operation || this.defaultParameters.operation;
    const scope = params.scope || this.defaultParameters.scope;
    const key = params.key || (typeof inputData === 'object' && inputData?.key ? String(inputData.key) : 'default_key');
    let value = params.value;

    if (value === undefined || value === '') {
      if (typeof inputData === 'object' && inputData !== null && 'value' in inputData) {
        value = inputData.value;
      } else {
        value = inputData;
      }
    }

    const userId = (context as any).userId || (context.workflowContext as any)?.userId;
    const workflowId = (context as any).workflowId || (context.workflowContext as any)?.workflowId;
    const executionId = (context as any).executionId || (context.workflowContext as any)?.executionId;

    let result: any = null;

    // 1. Быстрый execution scope (в памяти контекста текущего запуска)
    if (scope === 'execution' || scope === 'conversation') {
      const memoryMap = context.workflowContext.__executionMemory || (context.workflowContext.__executionMemory = new Map());

      switch (operation) {
        case 'write':
          memoryMap.set(key, value);
          result = { success: true, key, stored: true, scope };
          break;
        case 'read':
          result = { key, value: memoryMap.get(key) ?? null, found: memoryMap.has(key) };
          break;
        case 'delete':
          const deleted = memoryMap.delete(key);
          result = { key, deleted };
          break;
        case 'clear':
          memoryMap.clear();
          result = { cleared: true, scope };
          break;
        case 'search':
          const allEntries: Array<{ key: string; value: any }> = [];
          for (const [k, v] of memoryMap.entries()) {
            if (!params.searchQuery || k.includes(params.searchQuery) || JSON.stringify(v).includes(params.searchQuery)) {
              allEntries.push({ key: k, value: v });
            }
          }
          result = { items: allEntries.slice(0, params.limit || 5) };
          break;
      }

      return {
        outputData: result,
        output: result.value !== undefined ? result.value : result,
        selectedPort: 'main',
      };
    }

    // 2. Persistent / Workflow / User scope (БД с fallback на in-memory)
    try {
      const db = getDatabase();

      if (operation === 'write') {
        const expiresAt = params.ttlSeconds ? new Date(Date.now() + params.ttlSeconds * 1000) : null;
        
        // Преобразуем scope схемы в тип БД ('execution' | 'workflow' | 'agent' | 'user')
        const dbScope = scope === 'workspace' ? 'user' : (scope === 'persistent' ? 'agent' : 'workflow');

        // Проверяем существующую запись
        const existing = await db
          .select()
          .from(agentMemories)
          .where(and(eq(agentMemories.scope, dbScope), eq(agentMemories.key, key)))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(agentMemories)
            .set({
              value: typeof value === 'object' ? value : { text: String(value) },
              updatedAt: new Date(),
              expiresAt,
            })
            .where(eq(agentMemories.id, existing[0].id));
        } else if (userId) {
          await db.insert(agentMemories).values({
            userId,
            workflowId: workflowId || null,
            executionId: executionId || null,
            scope: dbScope,
            key,
            value: typeof value === 'object' ? value : { text: String(value) },
            expiresAt,
          });
        }
        result = { success: true, key, stored: true, scope };
      } else if (operation === 'read') {
        const dbScope = scope === 'workspace' ? 'user' : (scope === 'persistent' ? 'agent' : 'workflow');
        const rows = await db
          .select()
          .from(agentMemories)
          .where(and(eq(agentMemories.scope, dbScope), eq(agentMemories.key, key)))
          .limit(1);

        if (rows.length > 0) {
          result = { key, value: rows[0].value, found: true };
        } else {
          result = { key, value: null, found: false };
        }
      } else if (operation === 'delete') {
        const dbScope = scope === 'workspace' ? 'user' : (scope === 'persistent' ? 'agent' : 'workflow');
        await db
          .delete(agentMemories)
          .where(and(eq(agentMemories.scope, dbScope), eq(agentMemories.key, key)));
        result = { key, deleted: true };
      } else if (operation === 'search') {
        const dbScope = scope === 'workspace' ? 'user' : (scope === 'persistent' ? 'agent' : 'workflow');
        const rows = await db
          .select()
          .from(agentMemories)
          .where(eq(agentMemories.scope, dbScope))
          .limit(params.limit || 5);
        result = { items: rows.map((r: any) => ({ key: r.key, value: r.value })) };
      } else if (operation === 'clear') {
        const dbScope = scope === 'workspace' ? 'user' : (scope === 'persistent' ? 'agent' : 'workflow');
        await db.delete(agentMemories).where(eq(agentMemories.scope, dbScope));
        result = { cleared: true, scope };
      }
    } catch {
      // In-memory fallback
      const storeKey = `${scope}:${key}`;
      if (operation === 'write') {
        inMemoryStore.set(storeKey, value);
        result = { success: true, key, stored: true, scope, mode: 'in-memory' };
      } else if (operation === 'read') {
        const found = inMemoryStore.has(storeKey);
        result = { key, value: inMemoryStore.get(storeKey) ?? null, found, mode: 'in-memory' };
      } else if (operation === 'delete') {
        const deleted = inMemoryStore.delete(storeKey);
        result = { key, deleted, mode: 'in-memory' };
      } else if (operation === 'search') {
        const items: Array<{ key: string; value: any }> = [];
        for (const [k, v] of inMemoryStore.entries()) {
          if (k.startsWith(`${scope}:`)) {
            items.push({ key: k.replace(`${scope}:`, ''), value: v });
          }
        }
        result = { items: items.slice(0, params.limit || 5), mode: 'in-memory' };
      } else if (operation === 'clear') {
        for (const k of inMemoryStore.keys()) {
          if (k.startsWith(`${scope}:`)) {
            inMemoryStore.delete(k);
          }
        }
        result = { cleared: true, scope, mode: 'in-memory' };
      }
    }

    return {
      outputData: result,
      output: result?.value !== undefined ? result.value : result,
      selectedPort: 'main',
    };
  }
}
