import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  TokenUsageManager,
  TokenBudgetExceededError,
} from '../packages/nodes/src/knowledge/token-manager.js';
import {
  getDatabase,
  runMigrations,
  closeDatabase,
  users,
  tokenUsages,
  applicationSettings,
  eq,
} from '../packages/database/src/index.js';

describe('Second Brain: Token Usage & Budget Manager', () => {
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
    await db.delete(tokenUsages);
    await db.delete(applicationSettings).where(eq(applicationSettings.key, `token_budget_${testUserId}`));
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('должен записывать расход для локальной модели Ollama со стоимостью $0.00', async () => {
    const record = await TokenUsageManager.recordUsage({
      userId: testUserId,
      providerId: 'ollama-local',
      model: 'llama3:8b',
      inputTokens: 1500,
      outputTokens: 500,
    });

    expect(record.id).toBeDefined();
    expect(record.totalTokens).toBe(2000);
    expect(record.estimatedCostMicros).toBe(0); // Локальные модели бесплатны
  });

  it('должен рассчитывать оценочную стоимость для коммерческих моделей (GPT-4o)', async () => {
    const record = await TokenUsageManager.recordUsage({
      userId: testUserId,
      providerId: 'openai-cloud',
      model: 'gpt-4o',
      inputTokens: 2000, // 2K * 2500 micros = 5000 micros
      outputTokens: 1000, // 1K * 10000 micros = 10000 micros
    });

    expect(record.totalTokens).toBe(3000);
    expect(record.estimatedCostMicros).toBe(15000); // 15,000 микродолларов = $0.015
  });

  it('должен сохранять и считывать конфигурацию дневного бюджета токенов', async () => {
    await TokenUsageManager.saveBudgetConfig(testUserId, {
      dailyLimitTokens: 50000,
      actionOnLimit: 'warn',
    });

    const budget = await TokenUsageManager.getBudgetConfig(testUserId);
    expect(budget.dailyLimitTokens).toBe(50000);
    expect(budget.actionOnLimit).toBe('warn');
  });

  it('должен блокировать выполнение при превышении дневного лимита и политике stop', async () => {
    // Устанавливаем строгий лимит в 10 000 токенов и блокировку 'stop'
    await TokenUsageManager.saveBudgetConfig(testUserId, {
      dailyLimitTokens: 10000,
      actionOnLimit: 'stop',
    });

    // Расходуем 9 000 токенов
    await TokenUsageManager.recordUsage({
      userId: testUserId,
      model: 'gpt-4o',
      inputTokens: 6000,
      outputTokens: 3000,
    });

    // Следующий запрос на 3 000 токенов (9000 + 3000 > 10000) должен вызвать TokenBudgetExceededError
    await expect(
      TokenUsageManager.checkBudget(testUserId, 3000)
    ).rejects.toThrow(TokenBudgetExceededError);
  });

  it('должен возвращать полную агрегированную статистику по моделям и провайдерам', async () => {
    await TokenUsageManager.recordUsage({
      userId: testUserId,
      providerId: 'ollama',
      model: 'qwen2.5:14b',
      inputTokens: 1000,
      outputTokens: 400,
    });

    await TokenUsageManager.recordUsage({
      userId: testUserId,
      providerId: 'anthropic',
      model: 'claude-3-5-sonnet',
      inputTokens: 2000,
      outputTokens: 800,
    });

    const stats = await TokenUsageManager.getStats(testUserId);

    expect(stats.totalTokens).toBe(4200);
    expect(stats.inputTokens).toBe(3000);
    expect(stats.outputTokens).toBe(1200);
    expect(stats.byModel['qwen2.5:14b']).toBe(1400);
    expect(stats.byModel['claude-3-5-sonnet']).toBe(2800);
    expect(stats.byProvider['ollama']).toBe(1400);
    expect(stats.byProvider['anthropic']).toBe(2800);
  });
});
