import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BrowserTestServer } from './fixtures/browser-test-server.js';
import { AIBrowserAgent, IAIProvider } from '@neuroflow/nodes';
import { AIProviderType } from '@neuroflow/shared';

describe('AIBrowserAgent ReAct Loop (Observe -> Plan -> Act -> Verify)', () => {
  const testServer = new BrowserTestServer();
  let baseUrl = '';

  beforeAll(async () => {
    baseUrl = await testServer.start();
  }, 15000);

  afterAll(async () => {
    await testServer.stop();
  });

  it('должен автономно проходить цикл Observe -> Plan -> Act -> Verify и решать задачу', async () => {
    let callIndex = 0;

    const mockResponses = [
      // Шаг 1: ввод в поле
      'Thought: Введу поисковый запрос в поле формы.\nAction: type\nAction Input: { "selector": "#query-input", "text": "AI NeuroFlow" }',
      // Шаг 2: клик по кнопке
      'Thought: Нажму кнопку отправки формы поиска.\nAction: click\nAction Input: { "selector": "#search-submit" }',
      // Шаг 3: извлечение
      'Thought: Извлеку полученный результат поиска.\nAction: extract\nAction Input: { "selector": "#search-result", "extractType": "text" }',
      // Шаг 4: завершение
      'Thought: Результат успешно получен.\nAction: finish\nAction Input: { "summary": "Поиск успешно выполнен, найдено: AI NeuroFlow", "result": { "query": "AI NeuroFlow" } }',
    ];

    const mockProvider: IAIProvider = {
      id: 'mock-agent-provider',
      name: 'Mock Agent Provider',
      type: 'openai',
      capabilities: { chat: true, structuredOutput: true },
      getModels: async () => [{ id: 'mock', name: 'Mock Model', contextWindow: 4096 }],
      testConnection: async () => ({ success: true, message: 'OK' }),
      generateText: async () => {
        const text = mockResponses[callIndex] || 'Action: finish\nAction Input: { "summary": "Готово" }';
        callIndex++;
        return {
          text,
          model: 'mock-agent-model',
          durationMs: 10,
          usage: { promptTokens: 50, completionTokens: 25, totalTokens: 75 },
        };
      },
    };

    const agent = new AIBrowserAgent();
    const result = await agent.run({
      task: 'Выполни поиск на сайте по фразе AI NeuroFlow и сообщи результат',
      startUrl: baseUrl,
      provider: mockProvider,
      allowLocalhost: true,
      maxSteps: 6,
    });

    expect(result.success).toBe(true);
    expect(result.finalAnswer).toContain('Поиск успешно выполнен');
    expect(result.steps.length).toBe(4);

    expect(result.steps[0].action).toBe('type');
    expect(result.steps[1].action).toBe('click');
    expect(result.steps[2].action).toBe('extract');
    expect(result.steps[3].action).toBe('finish');

    // Проверяем, что к каждому шагу прикреплены наблюдения
    expect(result.steps[0].observation).toBeDefined();
    expect(result.steps[1].observation).toBeDefined();
    expect(result.steps[2].observation.data).toContain('AI NeuroFlow');
  }, 30000);
});
