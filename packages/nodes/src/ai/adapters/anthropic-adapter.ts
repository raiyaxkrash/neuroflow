import {
  AIModelMeta,
  AIProviderCapabilities,
  GenerateTextOptions,
  GenerateTextResult,
  TestConnectionResult,
} from '@neuroflow/shared';
import { IAIProvider } from '../provider-interface.js';
import { validateUrlForSSRF } from '../../security/ssrf-guard.js';

export interface AnthropicAdapterConfig {
  id: string;
  name: string;
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
  models?: AIModelMeta[];
  timeoutMs?: number;
}

export class AnthropicAdapter implements IAIProvider {
  id: string;
  name: string;
  type = 'anthropic' as const;
  capabilities: AIProviderCapabilities = {
    chat: true,
    structuredOutput: true,
    streaming: true,
    functionCalling: true,
    modelDiscovery: false,
  };

  private baseUrl: string;
  private apiKey?: string;
  private defaultModel: string;
  private configuredModels: AIModelMeta[];
  private timeoutMs: number;

  constructor(config: AnthropicAdapterConfig) {
    this.id = config.id;
    this.name = config.name;
    this.baseUrl = (config.baseUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.defaultModel = config.defaultModel || 'claude-3-5-sonnet-20241022';
    this.configuredModels = config.models || [];
    this.timeoutMs = config.timeoutMs || 30000;
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey || '',
      'anthropic-version': '2023-06-01',
      'User-Agent': 'NeuroFlow-AI/1.0',
    };
  }

  async getModels(): Promise<AIModelMeta[]> {
    if (this.configuredModels.length > 0) {
      return this.configuredModels;
    }

    return [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
    ];
  }

  async testConnection(model?: string): Promise<TestConnectionResult> {
    const start = Date.now();
    const targetModel = model || this.defaultModel;

    try {
      const url = `${this.baseUrl}/messages`;
      await validateUrlForSSRF(url);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
        signal: controller.signal,
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 5,
        }),
      });
      clearTimeout(timer);

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        let errText = `HTTP ${res.status}`;
        try {
          const errJson = await res.json();
          errText = errJson?.error?.message || errText;
        } catch {}
        return {
          success: false,
          latencyMs,
          message: `Ошибка Anthropic API: ${errText}`,
          errorDetails: errText,
        };
      }

      return {
        success: true,
        latencyMs,
        message: `Успешное подключение к Anthropic! Задержка: ${latencyMs}ms. Модель: ${targetModel}`,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return {
        success: false,
        latencyMs,
        message: `Не удалось связаться с Anthropic API: ${err.message}`,
        errorDetails: err.stack,
      };
    }
  }

  async generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    const start = Date.now();
    const model = options.model || this.defaultModel;
    const url = `${this.baseUrl}/messages`;

    await validateUrlForSSRF(url);

    const payload: Record<string, any> = {
      model,
      messages: [{ role: 'user', content: options.userPrompt ?? options.prompt ?? '' }],
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.7,
      ...(options.topP !== undefined ? { top_p: options.topP } : {}),
    };

    if (options.systemPrompt) {
      payload.system = options.systemPrompt;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        let errMessage = `Anthropic API Error: HTTP ${res.status}`;
        try {
          const errData = await res.json();
          errMessage = errData?.error?.message || errMessage;
        } catch {}
        throw new Error(errMessage);
      }

      const data = await res.json();
      const content = data?.content?.[0]?.text || '';

      const usage = data?.usage ? {
        promptTokens: data.usage.input_tokens || 0,
        completionTokens: data.usage.output_tokens || 0,
        totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
      } : undefined;

      let parsedJson: any = undefined;
      if (options.responseFormat === 'json') {
        try {
          parsedJson = JSON.parse(content);
        } catch {
          const clean = content.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
          try {
            parsedJson = JSON.parse(clean);
          } catch {}
        }
      }

      return {
        text: content,
        json: parsedJson,
        model,
        usage,
        durationMs: Date.now() - start,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateStructuredOutput<T = any>(
    options: GenerateTextOptions,
    validator?: (data: any) => { valid: boolean; data?: T; error?: string }
  ): Promise<{ data: T; rawResult: GenerateTextResult }> {
    const rawResult = await this.generateText({
      ...options,
      responseFormat: 'json',
      systemPrompt: `${options.systemPrompt || ''}\nIMPORTANT: Respond ONLY with valid JSON.`.trim(),
    });

    let parsed = rawResult.json;
    if (parsed === undefined) {
      try {
        const clean = rawResult.text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(clean);
      } catch (err: any) {
        throw new Error(`Модель вернула некорректный JSON: ${err.message}. Ответ: ${rawResult.text.slice(0, 200)}`);
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
