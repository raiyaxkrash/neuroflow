import { createHash } from 'node:crypto';
import {
  getDatabase,
  knowledgeDocuments,
  knowledgeSources,
  eq,
} from '@neuroflow/database';

export class MissionMemory {
  private memoryMap = new Map<string, any>();
  private keyFacts: string[] = [];

  constructor(initialData: Record<string, any> = {}) {
    for (const [key, val] of Object.entries(initialData)) {
      this.memoryMap.set(key, val);
    }
  }

  public set(key: string, value: any): void {
    this.memoryMap.set(key, value);
  }

  public get<T = any>(key: string): T | undefined {
    return this.memoryMap.get(key);
  }

  public addKeyFact(fact: string): void {
    if (fact && !this.keyFacts.includes(fact)) {
      this.keyFacts.push(fact);
    }
  }

  public getKeyFacts(): string[] {
    return [...this.keyFacts];
  }

  public getAll(): Record<string, any> {
    const obj: Record<string, any> = {};
    for (const [k, v] of this.memoryMap.entries()) {
      obj[k] = v;
    }
    if (this.keyFacts.length > 0) {
      obj._keyFacts = this.keyFacts;
    }
    return obj;
  }

  /**
   * Сжатие контекста миссии для предотвращения переполнения контекстного окна LLM
   */
  public compressContext(maxLength: number = 4000): string {
    const factsText = this.keyFacts.map((f, i) => `${i + 1}. ${f}`).join('\n');
    let memorySummary = '';

    for (const [k, v] of this.memoryMap.entries()) {
      if (k === '_keyFacts') continue;
      const strVal = typeof v === 'object' ? JSON.stringify(v) : String(v);
      memorySummary += `[${k}]: ${strVal.slice(0, 300)}\n`;
    }

    const total = `ФАКТЫ МИССИИ:\n${factsText || 'Нет зафиксированных фактов'}\n\nКОНТЕКСТ ШАГОВ:\n${memorySummary}`;
    if (total.length > maxLength) {
      return total.slice(0, maxLength) + '\n... [контекст сжат для соблюдения лимита]';
    }
    return total;
  }

  /**
   * Интеграция с Second Brain: сохранение проверенных результатов миссии в долговременную базу знаний
   */
  public static async exportToSecondBrain(params: {
    userId: string;
    missionId: string;
    missionTitle: string;
    missionGoal: string;
    finalSummary: string;
    artifacts: Record<string, any>;
  }): Promise<{ documentId: string }> {
    const db = getDatabase();

    // 1. Находим или создаем источник "Autonomous Missions"
    const [existingSource] = await db
      .select()
      .from(knowledgeSources)
      .where(eq(knowledgeSources.userId, params.userId))
      .limit(1);

    let sourceId = existingSource?.id;

    if (!sourceId) {
      const [newSource] = await db
        .insert(knowledgeSources)
        .values({
          userId: params.userId,
          name: 'Autonomous Missions Archive',
          type: 'agent_output',
          status: 'indexed',
          itemCount: 1,
        })
        .returning({ id: knowledgeSources.id });
      sourceId = newSource.id;
    }

    // 2. Формируем тело документа
    const content = `# Отчет по автономной миссии: ${params.missionTitle}
**Цель миссии:** ${params.missionGoal}
**Дата завершения:** ${new Date().toISOString()}

## Итоговые результаты и выводы
${params.finalSummary}

## Зафиксированные артефакты
\`\`\`json
${JSON.stringify(params.artifacts, null, 2)}
\`\`\`
`;

    const contentHash = createHash('sha256').update(content).digest('hex');

    const [doc] = await db
      .insert(knowledgeDocuments)
      .values({
        sourceId,
        userId: params.userId,
        title: `Результат миссии: ${params.missionTitle}`,
        uri: `mission://${params.missionId}`,
        mimeType: 'text/markdown',
        byteSize: Buffer.byteLength(content, 'utf8'),
        contentHash,
        status: 'indexed',
        metadata: {
          missionId: params.missionId,
          type: 'mission_export',
          content,
        },
      })
      .returning({ id: knowledgeDocuments.id });

    return { documentId: doc.id };
  }
}
