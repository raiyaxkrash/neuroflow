import {
  AIModelMeta,
  AIProviderCapabilities,
  GenerateTextOptions,
  GenerateTextResult,
  TestConnectionResult,
} from '@neuroflow/shared';
import { IAIProvider } from '../provider-interface.js';
import { validateUrlForSSRF } from '../../security/ssrf-guard.js';

export interface OllamaAdapterConfig {
  id: string;
  name: string;
  baseUrl?: string;
  defaultModel?: string;
  models?: AIModelMeta[];
  timeoutMs?: number;
  allowLocalOllama?: boolean;
}

export class OllamaAdapter implements IAIProvider {
  id: string;
  name: string;
  type = 'ollama' as const;
  capabilities: AIProviderCapabilities = {
    chat: true,
    structuredOutput: true,
    streaming: true,
    functionCalling: false,
    modelDiscovery: true,
  };

  private baseUrl: string;
  private defaultModel: string;
  private configuredModels: AIModelMeta[];
  private timeoutMs: number;
  private allowLocalOllama: boolean;

  constructor(config: OllamaAdapterConfig) {
    this.id = config.id;
    this.name = config.name;
    this.baseUrl = (config.baseUrl || process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/+$/, '');
    this.defaultModel = config.defaultModel || 'llama3.2';
    this.configuredModels = config.models || [];
    this.timeoutMs = config.timeoutMs || 45000;
    this.allowLocalOllama = config.allowLocalOllama !== false; // По умолчанию для Ollama включен локальный режим
  }

  async getModels(): Promise<AIModelMeta[]> {
    if (this.configuredModels.length > 0) {
      return this.configuredModels;
    }

    try {
      const url = `${this.baseUrl}/api/tags`;
      await validateUrlForSSRF(url, { allowLocalOllama: this.allowLocalOllama });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) {
        const body = await res.json();
        if (Array.isArray(body?.models)) {
          return body.models.map((m: any) => ({
            id: m.name,
            name: m.name,
          }));
        }
      }
    } catch {
      // Игнорируем
    }

    return [
      { id: 'llama3.2', name: 'Llama 3.2' },
      { id: 'mistral', name: 'Mistral' },
      { id: 'qwen2.5', name: 'Qwen 2.5' },
      { id: 'phi3', name: 'Phi-3' },
    ];
  }

  async testConnection(model?: string): Promise<TestConnectionResult> {
    const start = Date.now();
    const targetModel = model || this.defaultModel;

    try {
      const url = `${this.baseUrl}/api/tags`;
      await validateUrlForSSRF(url, { allowLocalOllama: this.allowLocalOllama });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        return {
          success: false,
          latencyMs,
          message: `Ollama вернула статус HTTP ${res.status}: ${res.statusText}`,
        };
      }

      const body = await res.json();
      const modelsFound = Array.isArray(body?.models) ? body.models.map((m: any) => m.name) : [];

      const modelExists = modelsFound.length > 0 && modelsFound.some((m: string) => m.startsWith(targetModel));

      return {
        success: true,
        latencyMs,
        modelsFound,
        message: modelExists
          ? `Успешное подключение к Ollama (${this.baseUrl})! Найдено ${modelsFound.length} локальных моделей. Модель ${targetModel} готова.`
          : `Ollama активна (${this.baseUrl}), но модель "${targetModel}" не найдена. Доступные модели: ${modelsFound.join(', ') || 'нет'}. Выполните: ollama pull ${targetModel}`,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const errorMsg = err.message || String(err);

      return {
        success: false,
        latencyMs,
        message: `Ollama сервер недоступен по адресу ${this.baseUrl}. Убедитесь, что Ollama установлена и запущена на вашей машине (командой "ollama serve"). Ошибка сети: ${errorMsg}`,
        errorDetails: errorMsg,
      };
    }
  }

  async generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    const start = Date.now();
    const model = options.model || this.defaultModel;
    const url = `${this.baseUrl}/api/chat`;

    await validateUrlForSSRF(url, { allowLocalOllama: this.allowLocalOllama });

    const messages: Array<{ role: string; content: string }> = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: options.userPrompt ?? options.prompt ?? '' });

    const payload: Record<string, any> = {
      model,
      messages,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens ?? 2048,
        ...(options.topP !== undefined ? { top_p: options.topP } : {}),
      },
    };

    if (options.responseFormat === 'json') {
      payload.format = 'json';
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
        let errMessage = `Ollama Error: HTTP ${res.status}`;
        try {
          const errData = await res.json();
          errMessage = errData?.error || errMessage;
        } catch {}
        throw new Error(errMessage);
      }

      const data = await res.json();
      const content = data?.message?.content || data?.response || '';

      const usage = data?.prompt_eval_count !== undefined ? {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
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
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Таймаут запроса к Ollama (${this.timeoutMs}ms)`);
      }
      throw err;
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
