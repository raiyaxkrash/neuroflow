import {
  AIModelMeta,
  AIProviderCapabilities,
  GenerateTextOptions,
  GenerateTextResult,
  TestConnectionResult,
} from '@neuroflow/shared';
import { IAIProvider } from './provider-interface.js';

export class MockAIProvider implements IAIProvider {
  id = 'mock-provider';
  name = 'Mock AI Provider';
  type = 'openai' as const;
  capabilities: AIProviderCapabilities = {
    chat: true,
    structuredOutput: true,
    streaming: true,
    functionCalling: true,
    modelDiscovery: true,
  };

  public simulatedResponse: string = '{"success": true, "message": "Simulated AI Response"}';
  public cannedResponses: Record<string, string> = {};
  public shouldFail: boolean = false;
  public failureMessage: string = 'Simulated Provider API Failure';
  public latencyMs: number = 20;

  constructor(
    customResponseOrConfig?:
      | string
      | {
          cannedResponses?: Record<string, string>;
          defaultResponse?: string;
          mockLatencyMs?: number;
        }
  ) {
    if (typeof customResponseOrConfig === 'string') {
      this.simulatedResponse = customResponseOrConfig;
    } else if (customResponseOrConfig && typeof customResponseOrConfig === 'object') {
      if (customResponseOrConfig.cannedResponses) {
        this.cannedResponses = customResponseOrConfig.cannedResponses;
      }
      if (customResponseOrConfig.defaultResponse) {
        this.simulatedResponse = customResponseOrConfig.defaultResponse;
      }
      if (customResponseOrConfig.mockLatencyMs !== undefined) {
        this.latencyMs = customResponseOrConfig.mockLatencyMs;
      }
    }
  }

  async getModels(): Promise<AIModelMeta[]> {
    return [
      { id: 'mock-gpt-4o', name: 'Mock GPT-4o' },
      { id: 'mock-gemini-2.0', name: 'Mock Gemini 2.0' },
      { id: 'mock-claude-3.5', name: 'Mock Claude 3.5' },
    ];
  }

  async testConnection(model?: string): Promise<TestConnectionResult> {
    if (this.shouldFail) {
      return {
        success: false,
        latencyMs: this.latencyMs,
        message: this.failureMessage,
      };
    }
    return {
      success: true,
      latencyMs: this.latencyMs,
      modelsFound: ['mock-gpt-4o', 'mock-gemini-2.0'],
      message: `Тестовое соединение с Mock Provider успешно (${this.latencyMs}ms)`,
    };
  }

  async generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    if (this.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.latencyMs));
    }

    let responseText = this.simulatedResponse;
    const userPrompt = options.userPrompt || options.prompt || '';
    if (userPrompt) {
      for (const [key, val] of Object.entries(this.cannedResponses)) {
        if (userPrompt.includes(key)) {
          responseText = val;
          break;
        }
      }
    } else if (options.messages && options.messages.length > 0) {
      const last = options.messages[options.messages.length - 1].content;
      for (const [key, val] of Object.entries(this.cannedResponses)) {
        if (last.includes(key)) {
          responseText = val;
          break;
        }
      }
    }

    let parsedJson: any = undefined;
    if (options.responseFormat === 'json') {
      try {
        parsedJson = JSON.parse(responseText);
      } catch {
        // Игнорируем
      }
    }

    return {
      text: responseText,
      json: parsedJson,
      model: options.model || 'mock-gpt-4o',
      usage: {
        promptTokens: 25,
        completionTokens: 40,
        totalTokens: 65,
      },
      durationMs: this.latencyMs,
    };
  }

  async generateStructuredOutput<T = any>(
    options: GenerateTextOptions,
    validator?: (data: any) => { valid: boolean; data?: T; error?: string }
  ): Promise<{ data: T; rawResult: GenerateTextResult }> {
    const rawResult = await this.generateText({
      ...options,
      responseFormat: 'json',
    });

    let parsed = rawResult.json;
    if (parsed === undefined) {
      try {
        parsed = JSON.parse(rawResult.text);
      } catch (err: any) {
        throw new Error(`Модель вернула некорректный JSON: ${err.message}`);
      }
    }

    // Интеллектуальный mock-fallback для специализированных системных промптов NeuroFlow
    if (parsed && typeof parsed === 'object') {
      const sysPrompt = options.systemPrompt || '';
      if (sysPrompt.includes('AI Architect') && !parsed.graph) {
        parsed = {
          name: 'AI Generated Workflow',
          description: 'Сгенерировано AI Архитектором NeuroFlow',
          graph: {
            nodes: [
              { id: 'node_trigger_1', type: 'manual-trigger', label: 'Manual Trigger' },
              { id: 'node_http_1', type: 'http-request', label: 'HTTP Request', parameters: { url: 'https://httpbin.org/get' } },
              { id: 'node_ai_1', type: 'ai-model', label: 'AI Model' },
              { id: 'node_output_1', type: 'output', label: 'Output' },
            ],
            edges: [
              { id: 'e1', source: 'node_trigger_1', target: 'node_http_1' },
              { id: 'e2', source: 'node_http_1', target: 'node_ai_1' },
              { id: 'e3', source: 'node_ai_1', target: 'node_output_1' },
            ],
          },
        };
      } else if (sysPrompt.includes('Copilot') && !parsed.actions) {
        parsed = {
          reply: 'Я проанализировал сценарий и добавил блок AI Model.',
          hasModifications: true,
          actions: [
            {
              action: 'add_node',
              type: 'ai-model',
              label: 'AI Model',
              parameters: { model: 'gpt-4o-mini' },
            },
          ],
        };
      }
    }

    if (validator) {
      const validation = validator(parsed);
      if (!validation.valid) {
        throw new Error(`Ошибка валидации структуры ответа ИИ: ${validation.error || 'Несоответствие схемы'}`);
      }
      return { data: validation.data as T, rawResult };
    }

    return { data: parsed as T, rawResult };
  }
}
