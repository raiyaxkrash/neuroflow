import {
  AIModelMeta,
  AIProviderCapabilities,
  GenerateTextOptions,
  GenerateTextResult,
  TestConnectionResult,
} from '@neuroflow/shared';
import { IAIProvider } from '../provider-interface.js';
import { validateUrlForSSRF } from '../../security/ssrf-guard.js';

export interface GeminiAdapterConfig {
  id: string;
  name: string;
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
  models?: AIModelMeta[];
  timeoutMs?: number;
}

export class GeminiAdapter implements IAIProvider {
  id: string;
  name: string;
  type = 'gemini' as const;
  capabilities: AIProviderCapabilities = {
    chat: true,
    structuredOutput: true,
    streaming: true,
    functionCalling: true,
    modelDiscovery: true,
  };

  private baseUrl: string;
  private apiKey?: string;
  private defaultModel: string;
  private configuredModels: AIModelMeta[];
  private timeoutMs: number;

  constructor(config: GeminiAdapterConfig) {
    this.id = config.id;
    this.name = config.name;
    this.baseUrl = (config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.defaultModel = config.defaultModel || 'gemini-2.0-flash';
    this.configuredModels = config.models || [];
    this.timeoutMs = config.timeoutMs || 30000;
  }

  async getModels(): Promise<AIModelMeta[]> {
    if (this.configuredModels.length > 0) {
      return this.configuredModels;
    }

    try {
      if (this.apiKey) {
        const url = `${this.baseUrl}/models?key=${encodeURIComponent(this.apiKey)}`;
        await validateUrlForSSRF(url);

        const res = await fetch(url);
        if (res.ok) {
          const body = await res.json();
          if (Array.isArray(body?.models)) {
            return body.models
              .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
              .map((m: any) => ({
                id: m.name.replace(/^models\//, ''),
                name: m.displayName || m.name.replace(/^models\//, ''),
              }));
          }
        }
      }
    } catch {
      // Игнорируем
    }

    return [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    ];
  }

  async testConnection(model?: string): Promise<TestConnectionResult> {
    const start = Date.now();
    const targetModel = model || this.defaultModel;

    try {
      const url = `${this.baseUrl}/models/${targetModel}:generateContent?key=${encodeURIComponent(this.apiKey || '')}`;
      await validateUrlForSSRF(url);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'NeuroFlow-AI/1.0',
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Ping' }] }],
          generationConfig: { maxOutputTokens: 5 },
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
          message: `Ошибка Gemini API: ${errText}`,
          errorDetails: errText,
        };
      }

      return {
        success: true,
        latencyMs,
        message: `Успешное подключение к Google Gemini! Задержка: ${latencyMs}ms. Модель: ${targetModel}`,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return {
        success: false,
        latencyMs,
        message: `Не удалось связаться с Gemini API: ${err.message}`,
        errorDetails: err.stack,
      };
    }
  }

  async generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    const start = Date.now();
    const targetModel = options.model || this.defaultModel;
    const cleanModel = targetModel.replace(/^models\//, '');
    const url = `${this.baseUrl}/models/${cleanModel}:generateContent?key=${encodeURIComponent(this.apiKey || '')}`;

    await validateUrlForSSRF(url);

    const generationConfig: Record<string, any> = {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 2048,
    };

    if (options.topP !== undefined) {
      generationConfig.topP = options.topP;
    }

    if (options.responseFormat === 'json') {
      generationConfig.responseMimeType = 'application/json';
    }

    const payload: Record<string, any> = {
      contents: [
        {
          role: 'user',
          parts: [{ text: options.userPrompt ?? options.prompt ?? '' }],
        },
      ],
      generationConfig,
    };

    if (options.systemPrompt) {
      payload.systemInstruction = {
        parts: [{ text: options.systemPrompt }],
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'NeuroFlow-AI/1.0',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        let errMessage = `Gemini API Error: HTTP ${res.status}`;
        try {
          const errData = await res.json();
          errMessage = errData?.error?.message || errMessage;
        } catch {}
        throw new Error(errMessage);
      }

      const data = await res.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      const usage = data?.usageMetadata ? {
        promptTokens: data.usageMetadata.promptTokenCount || 0,
        completionTokens: data.usageMetadata.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata.totalTokenCount || 0,
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
        model: cleanModel,
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
