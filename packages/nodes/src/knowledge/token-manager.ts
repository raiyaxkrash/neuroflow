import {
  getDatabase,
  tokenUsages,
  applicationSettings,
  eq,
  and,
  sql,
} from '@neuroflow/database';
import { TokenBudgetConfig, TokenUsageRecordDto } from '@neuroflow/shared';

export class TokenBudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenBudgetExceededError';
  }
}

// Тарифная сетка для оценочной стоимости (микродоллары за 1K токенов = $0.001 = 1000 микродолларов)
const MODEL_PRICING_MICROS_PER_1K: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2500, output: 10000 },
  'gpt-4o-mini': { input: 150, output: 600 },
  'claude-3-5-sonnet': { input: 3000, output: 15000 },
  'claude-3-haiku': { input: 250, output: 1250 },
  'gemini-1.5-pro': { input: 1250, output: 5000 },
  'gemini-1.5-flash': { input: 75, output: 300 },
  // Локальные модели (Ollama, local) бесплатны:
  'ollama': { input: 0, output: 0 },
  'local': { input: 0, output: 0 },
};

export class TokenUsageManager {
  /**
   * Запись расхода токенов вызова модели
   */
  public static async recordUsage(params: {
    userId: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
    providerId?: string;
    agentId?: string;
    workflowId?: string;
    executionId?: string;
    isEstimated?: boolean;
    exactCostMicros?: number;
  }): Promise<TokenUsageRecordDto> {
    const db = getDatabase();
    const input = Math.max(0, params.inputTokens);
    const output = Math.max(0, params.outputTokens);
    const cached = Math.max(0, params.cachedTokens || 0);
    const total = input + output;

    // Расчет стоимости
    let costMicros = params.exactCostMicros || 0;
    const isLocal = (params.providerId || '').toLowerCase().includes('ollama') ||
                    (params.model || '').toLowerCase().includes('local') ||
                    (params.providerId || '').toLowerCase().includes('mock');

    if (!costMicros && !isLocal) {
      const pricing = MODEL_PRICING_MICROS_PER_1K[params.model] || { input: 500, output: 2000 };
      costMicros = Math.round((input / 1000) * pricing.input + (output / 1000) * pricing.output);
    }

    const [record] = await db
      .insert(tokenUsages)
      .values({
        userId: params.userId,
        providerId: params.providerId || null,
        model: params.model,
        agentId: params.agentId || null,
        workflowId: params.workflowId || null,
        executionId: params.executionId || null,
        inputTokens: input,
        outputTokens: output,
        cachedTokens: cached,
        totalTokens: total,
        estimatedCostMicros: costMicros,
        isEstimated: params.isEstimated !== undefined ? params.isEstimated : !Boolean(params.exactCostMicros),
      })
      .returning();

    // Проверка бюджета после записи
    await this.checkBudget(params.userId, 0);

    return {
      id: record.id,
      userId: record.userId,
      providerId: record.providerId,
      model: record.model,
      agentId: record.agentId,
      workflowId: record.workflowId,
      executionId: record.executionId,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      cachedTokens: record.cachedTokens,
      totalTokens: record.totalTokens,
      estimatedCostMicros: record.estimatedCostMicros,
      isEstimated: record.isEstimated,
      createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : String(record.createdAt),
    };
  }

  /**
   * Получение текущих настроек бюджета токенов
   */
  public static async getBudgetConfig(userId: string): Promise<TokenBudgetConfig> {
    const db = getDatabase();
    const [setting] = await db
      .select()
      .from(applicationSettings)
      .where(eq(applicationSettings.key, `token_budget_${userId}`))
      .limit(1);

    const defaultConfig: TokenBudgetConfig = {
      dailyLimitTokens: 1000000,
      perExecutionLimitTokens: 100000,
      perAgentLimitTokens: 50000,
      actionOnLimit: 'warn',
      todayUsedTokens: 0,
      isBudgetExceeded: false,
    };

    const config: TokenBudgetConfig = setting?.value ? { ...defaultConfig, ...(setting.value as any) } : defaultConfig;

    // Подсчет израсходованных токенов за сегодня (UTC)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const rows = await db
      .select({ total: tokenUsages.totalTokens, createdAt: tokenUsages.createdAt })
      .from(tokenUsages)
      .where(eq(tokenUsages.userId, userId));

    const todayTokens = rows
      .filter((r: any) => new Date(r.createdAt) >= todayStart)
      .reduce((sum: number, r: any) => sum + (r.total || 0), 0);

    config.todayUsedTokens = todayTokens;
    config.isBudgetExceeded = config.dailyLimitTokens > 0 && todayTokens >= config.dailyLimitTokens;

    return config;
  }

  /**
   * Сохранение настроек бюджета токенов
   */
  public static async saveBudgetConfig(userId: string, update: Partial<TokenBudgetConfig>): Promise<TokenBudgetConfig> {
    const db = getDatabase();
    const current = await this.getBudgetConfig(userId);
    const newConfig = { ...current, ...update };

    await db
      .insert(applicationSettings)
      .values({
        key: `token_budget_${userId}`,
        value: newConfig,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: applicationSettings.key,
        set: {
          value: newConfig,
          updatedAt: new Date(),
        },
      });

    return newConfig;
  }

  /**
   * Проверка лимитов токенов перед или после вызова
   */
  public static async checkBudget(userId: string, requestedTokens = 0): Promise<void> {
    const budget = await this.getBudgetConfig(userId);

    if (budget.dailyLimitTokens > 0 && budget.todayUsedTokens + requestedTokens > budget.dailyLimitTokens) {
      if (budget.actionOnLimit === 'stop') {
        throw new TokenBudgetExceededError(
          `[Token Budget] Превышен дневной лимит токенов (${budget.todayUsedTokens} / ${budget.dailyLimitTokens}). Новые вызовы заблокированы.`
        );
      } else {
        console.warn(`[Token Budget Warning] Дневной лимит токенов исчерпан (${budget.todayUsedTokens} / ${budget.dailyLimitTokens})`);
      }
    }
  }

  /**
   * Получение статистики расхода токенов
   */
  public static async getStats(userId: string): Promise<{
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    totalCostMicros: number;
    byModel: Record<string, number>;
    byProvider: Record<string, number>;
  }> {
    const db = getDatabase();
    const rows = await db
      .select()
      .from(tokenUsages)
      .where(eq(tokenUsages.userId, userId));

    let totalTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let cachedTokens = 0;
    let totalCostMicros = 0;
    const byModel: Record<string, number> = {};
    const byProvider: Record<string, number> = {};

    for (const row of rows) {
      totalTokens += row.totalTokens || 0;
      inputTokens += row.inputTokens || 0;
      outputTokens += row.outputTokens || 0;
      cachedTokens += row.cachedTokens || 0;
      totalCostMicros += row.estimatedCostMicros || 0;

      const modelKey = row.model || 'unknown';
      byModel[modelKey] = (byModel[modelKey] || 0) + (row.totalTokens || 0);

      const provKey = row.providerId || 'direct';
      byProvider[provKey] = (byProvider[provKey] || 0) + (row.totalTokens || 0);
    }

    return {
      totalTokens,
      inputTokens,
      outputTokens,
      cachedTokens,
      totalCostMicros,
      byModel,
      byProvider,
    };
  }
}
