import { describe, it, expect, vi } from 'vitest';
import { MockAIProvider } from '../packages/nodes/src/ai/mock-provider.js';
import { CustomRestAdapter } from '../packages/nodes/src/ai/adapters/custom-rest-adapter.js';
import { OllamaAdapter } from '../packages/nodes/src/ai/adapters/ollama-adapter.js';
import { ProviderFactory } from '../packages/nodes/src/ai/provider-factory.js';

describe('Universal AI Provider System', () => {
  it('MockAIProvider должен генерировать текст и структурированный JSON', async () => {
    const mock = new MockAIProvider({
      cannedResponses: {
        'Tell me a joke': 'Why did the chicken cross the road? To debug the workflow!',
      },
      mockLatencyMs: 5,
    });

    const res = await mock.generateText({
      prompt: 'Tell me a joke',
      model: 'mock-model',
    });

    expect(res.text).toBe('Why did the chicken cross the road? To debug the workflow!');
    expect(res.usage.totalTokens).toBeGreaterThan(0);

    const jsonRes = await mock.generateStructuredOutput<{ status: string }>({
      prompt: 'give status',
      schema: { status: 'string' },
    });

    expect(jsonRes.data).toBeDefined();
    expect(jsonRes.rawResult.text).toBeDefined();
  });

  it('CustomRestAdapter должен подставлять параметры и извлекать ответ по dot-notation пути', async () => {
    const custom = new CustomRestAdapter({
      id: 'test-custom',
      name: 'Custom LLM Gateway',
      endpoint: 'https://example.com/v1/chat',
      customBodyTemplate: JSON.stringify({
        input_text: '{{prompt}}',
        sys: '{{systemPrompt}}',
        temperature: '{{temperature}}',
      }),
      customResponsePath: 'response.data.output_text',
    });

    // Мокаем fetch
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: {
          data: {
            output_text: 'Custom gateway answer successfully received!',
          },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await custom.generateText({
      prompt: 'Hello custom LLM',
      systemPrompt: 'You are helpful',
      temperature: 0.5,
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(result.text).toBe('Custom gateway answer successfully received!');

    vi.unstubAllGlobals();
  });

  it('OllamaAdapter должен форматировать запросы к локальному /api/generate', async () => {
    const ollama = new OllamaAdapter({
      id: 'ollama-test',
      endpoint: 'http://127.0.0.1:11434',
      defaultModel: 'llama3',
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: 'Hello from local Llama 3!',
        prompt_eval_count: 12,
        eval_count: 24,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await ollama.generateText({
      prompt: 'Hi local LLM',
      model: 'llama3',
    });

    expect(result.text).toBe('Hello from local Llama 3!');
    expect(result.usage.promptTokens).toBe(12);
    expect(result.usage.completionTokens).toBe(24);

    vi.unstubAllGlobals();
  });

  it('ProviderFactory должен управлять провайдерами и возвращать mock/default при отсутствии внешних ключей', async () => {
    const factory = ProviderFactory.getInstance();
    const mockProvider = new MockAIProvider();

    factory.registerProvider('custom-test-provider', mockProvider, true);

    const resolved = await factory.getProvider('custom-test-provider');
    expect(resolved.id).toBe(mockProvider.id);

    const defaultProvider = await factory.getDefaultProvider();
    expect(defaultProvider).toBeDefined();

    const testRes = await factory.testConnection('custom-test-provider');
    expect(testRes.success).toBe(true);
    expect(testRes.latencyMs).toBeDefined();
  });
});
