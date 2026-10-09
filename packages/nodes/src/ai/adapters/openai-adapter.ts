import {
  AIProviderType,
  AIModelMeta,
  AIProviderCapabilities,
  GenerateTextOptions,
  GenerateTextResult,
  TestConnectionResult,
} from '@neuroflow/shared';
import { IAIProvider } from '../provider-interface.js';
import { validateUrlForSSRF } from '../../security/ssrf-guard.js';

export interface OpenAIAdapterConfig {
  id: string;
  name: string;
  type?: AIProviderType; // 'openai' | 'openai-compatible'
  baseUrl?: string;
  apiKey?: string;
  authType?: string; // 'bearer' | 'api-key-header' | 'basic' | 'none'
  customHeaders?: Record<string, string>;
  customRequestPath?: string;
  defaultModel?: string;
  models?: AIModelMeta[];
  timeoutMs?: number;
  allowLocalOllama?: boolean;
}

export class OpenAIAdapter implements IAIProvider {
  id: string;
  name: string;
  type: AIProviderType;
  capabilities: AIProviderCapabilities = {
    chat: true,
    structuredOutput: true,
    streaming: true,
    functionCalling: true,
    modelDiscovery: true,
  };

  private baseUrl: string;
  private apiKey?: string;
  private authType: string;
  private customHeaders: Record<string, string>;
  private customRequestPath: string;
  private defaultModel: string;
  private configuredModels: AIModelMeta[];
  private timeoutMs: number;
  private allowLocalOllama: boolean;

  constructor(config: OpenAIAdapterConfig) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type || 'openai';
    this.baseUrl = (config.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.authType = config.authType || 'bearer';
    this.customHeaders = config.customHeaders || {};
    this.customRequestPath = config.customRequestPath || '/chat/completions';
    this.defaultModel = config.defaultModel || 'gpt-4o-mini';
    this.configuredModels = config.models || [];
    this.timeoutMs = config.timeoutMs || 30000;
    this.allowLocalOllama = !!config.allowLocalOllama;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'NeuroFlow-AI/1.0',
      ...this.customHeaders,
    };

    if (this.apiKey) {
      if (this.authType === 'bearer') {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      } else if (this.authType === 'api-key-header') {
        headers['api-key'] = this.apiKey;
      } else if (this.authType === 'basic') {
        const encoded = Buffer.from(this.apiKey).toString('base64');
        headers['Authorization'] = `Basic ${encoded}`;
      }
    }

    return headers;
  }

  async getModels(): Promise<AIModelMeta[]> {
    if (this.configuredModels.length > 0) {
      return this.configuredModels;
    }

    try {
      const targetUrl = `${this.baseUrl}/models`;
      await validateUrlForSSRF(targetUrl, { allowLocalOllama: this.allowLocalOllama });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(targetUrl, {
        method: 'GET',
        headers: this.buildHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const body = await res.json();
        if (Array.isArray(body?.data)) {
          return body.data.map((m: any) => ({
            id: m.id,
            name: m.id,
          }));
        }
      }
    } catch {
      // Игнорируем сетевые ошибки discovery
    }

    // Fallback список популярных моделей
    return [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'o3-mini', name: 'o3 Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    ];
  }

  async testConnection(model?: string): Promise<TestConnectionResult> {
    const start = Date.now();
    const targetModel = model || this.defaultModel;

    try {
      // 1. SSRF проверка
      const checkPath = this.customRequestPath.startsWith('/') ? this.customRequestPath : `/${this.customRequestPath}`;
      const url = `${this.baseUrl}${checkPath}`;
      await validateUrlForSSRF(url, { allowLocalOllama: this.allowLocalOllama });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);

      // Легковесный тестовый запрос
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
        let errText = `HTTP ${res.status} ${res.statusText}`;
        try {
          const errJson = await res.json();
          errText = errJson?.error?.message || errJson?.message || errText;
        } catch {
          // Игнорируем
        }
        return {
          success: false,
          latencyMs,
          message: `Ошибка подключения к ${this.name}: ${errText}`,
          errorDetails: errText,
        };
      }

      return {
        success: true,
        latencyMs,
        message: `Успешное подключение к ${this.name}! Задержка: ${latencyMs}ms. Модель: ${targetModel}`,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return {
        success: false,
        latencyMs,
        message: `Не удалось связаться с сервером: ${err.message}`,
        errorDetails: err.stack,
      };
    }
  }

  async generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    const start = Date.now();
    const model = options.model || this.defaultModel;
    const path = this.customRequestPath.startsWith('/') ? this.customRequestPath : `/${this.customRequestPath}`;
    const url = `${this.baseUrl}${path}`;

    await validateUrlForSSRF(url, { allowLocalOllama: this.allowLocalOllama });

    const messages: Array<{ role: string; content: string }> = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: options.userPrompt ?? options.prompt ?? '' });

    const requestBody: Record<string, any> = {
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      ...(options.topP !== undefined ? { top_p: options.topP } : {}),
      ...(options.customParams || {}),
    };

    if (options.responseFormat === 'json') {
      requestBody.response_format = { type: 'json_object' };
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
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!res.ok) {
        let errMessage = `OpenAI API Error: HTTP ${res.status}`;
        try {
          const errData = await res.json();
          errMessage = errData?.error?.message || errData?.message || errMessage;
        } catch {
          // Игнорируем
        }
        throw new Error(errMessage);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content || '';
      const usage = data?.usage ? {
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0,
        totalTokens: data.usage.total_tokens || 0,
      } : undefined;

      let parsedJson: any = undefined;
      if (options.responseFormat === 'json') {
        try {
          parsedJson = JSON.parse(content);
        } catch {
          // Если модель вернула markdown code block
          const clean = content.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
          try {
            parsedJson = JSON.parse(clean);
          } catch {
            // Оставляем undefined
          }
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
      systemPrompt: `${options.systemPrompt || ''}\nIMPORTANT: Reply ONLY with valid JSON without markdown wrapping.`.trim(),
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
