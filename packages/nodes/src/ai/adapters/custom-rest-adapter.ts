import {
  AIModelMeta,
  AIProviderCapabilities,
  GenerateTextOptions,
  GenerateTextResult,
  TestConnectionResult,
} from '@neuroflow/shared';
import { IAIProvider } from '../provider-interface.js';
import { validateUrlForSSRF } from '../../security/ssrf-guard.js';

export interface CustomRestAdapterConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  authType?: string; // 'bearer' | 'api-key-header' | 'basic' | 'none' | 'custom-headers'
  customHeaders?: Record<string, string>;
  customRequestPath?: string;
  customResponsePath?: string; // Dot notation path to extract text, e.g. "response.text" or "choices.0.message.content"
  customBodyTemplate?: any;
  defaultModel?: string;
  models?: AIModelMeta[];
  timeoutMs?: number;
  allowLocalOllama?: boolean;
}

function getValueByDotPath(obj: any, path: string): any {
  if (!obj || typeof obj !== 'object' || !path) return obj;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    // Поддержка индексов массивов (например choices.0.text)
    if (/^\d+$/.test(part) && Array.isArray(current)) {
      current = current[parseInt(part, 10)];
    } else {
      current = current[part];
    }
  }
  return current;
}

export class CustomRestAdapter implements IAIProvider {
  id: string;
  name: string;
  type = 'custom-rest' as const;
  capabilities: AIProviderCapabilities = {
    chat: true,
    structuredOutput: true,
    streaming: false,
    functionCalling: false,
    modelDiscovery: false,
  };

  private baseUrl: string;
  private apiKey?: string;
  private authType: string;
  private customHeaders: Record<string, string>;
  private customRequestPath: string;
  private customResponsePath: string;
  private customBodyTemplate?: any;
  private defaultModel: string;
  private configuredModels: AIModelMeta[];
  private timeoutMs: number;
  private allowLocalOllama: boolean;

  constructor(config: CustomRestAdapterConfig) {
    this.id = config.id;
    this.name = config.name;
    this.baseUrl = (config.baseUrl || (config as any).endpoint || '').replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.authType = config.authType || 'bearer';
    this.customHeaders = config.customHeaders || {};
    this.customRequestPath = config.customRequestPath || '';
    this.customResponsePath = config.customResponsePath || '';
    this.customBodyTemplate = config.customBodyTemplate;
    this.defaultModel = config.defaultModel || 'custom-model';
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
        headers['x-api-key'] = this.apiKey;
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
    return [{ id: this.defaultModel, name: this.defaultModel }];
  }

  async testConnection(model?: string): Promise<TestConnectionResult> {
    const start = Date.now();
    try {
      const path = this.customRequestPath ? (this.customRequestPath.startsWith('/') ? this.customRequestPath : `/${this.customRequestPath}`) : '';
      const url = `${this.baseUrl}${path}`;

      await validateUrlForSSRF(url, { allowLocalOllama: this.allowLocalOllama });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);

      const testBody = this.customBodyTemplate
        ? JSON.parse(
            JSON.stringify(this.customBodyTemplate)
              .replace(/\{\{prompt\}\}/g, 'Ping')
              .replace(/\{\{model\}\}/g, model || this.defaultModel)
          )
        : { prompt: 'Ping', model: model || this.defaultModel };

      const res = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(testBody),
        signal: controller.signal,
      });
      clearTimeout(timer);

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        return {
          success: false,
          latencyMs,
          message: `Ошибка HTTP ${res.status} при обращении к ${url}`,
        };
      }

      return {
        success: true,
        latencyMs,
        message: `Успешное подключение к Custom REST API! Задержка: ${latencyMs}ms.`,
      };
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        message: `Ошибка подключения к Custom REST: ${err.message}`,
        errorDetails: err.stack,
      };
    }
  }

  async generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    const start = Date.now();
    const model = options.model || this.defaultModel;
    const path = this.customRequestPath ? (this.customRequestPath.startsWith('/') ? this.customRequestPath : `/${this.customRequestPath}`) : '';
    const url = `${this.baseUrl}${path}`;

    await validateUrlForSSRF(url, { allowLocalOllama: this.allowLocalOllama });

    const userPromptText = options.userPrompt ?? options.prompt ?? '';
    let requestBody: any;
    if (this.customBodyTemplate) {
      const templateStr =
        typeof this.customBodyTemplate === 'string'
          ? this.customBodyTemplate
          : JSON.stringify(this.customBodyTemplate);
      const replaced = templateStr
        .replace(/\{\{prompt\}\}/g, JSON.stringify(userPromptText).slice(1, -1))
        .replace(/\{\{userPrompt\}\}/g, JSON.stringify(userPromptText).slice(1, -1))
        .replace(/\{\{systemPrompt\}\}/g, JSON.stringify(options.systemPrompt || '').slice(1, -1))
        .replace(/\{\{model\}\}/g, model)
        .replace(/\{\{temperature\}\}/g, String(options.temperature ?? 0.7));
      try {
        requestBody = JSON.parse(replaced);
      } catch {
        requestBody = replaced;
      }
    } else {
      requestBody = {
        model,
        prompt: userPromptText,
        system: options.systemPrompt,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
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
        throw new Error(`Custom REST API error: HTTP ${res.status} ${res.statusText}`);
      }

      const bodyData = await res.json();
      let extractedText = '';

      if (this.customResponsePath) {
        const val = getValueByDotPath(bodyData, this.customResponsePath);
        extractedText = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
      } else if (bodyData?.text) {
        extractedText = bodyData.text;
      } else if (bodyData?.output) {
        extractedText = typeof bodyData.output === 'object' ? JSON.stringify(bodyData.output) : String(bodyData.output);
      } else if (bodyData?.choices?.[0]?.message?.content) {
        extractedText = bodyData.choices[0].message.content;
      } else {
        extractedText = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData);
      }

      let parsedJson: any = undefined;
      if (options.responseFormat === 'json') {
        try {
          parsedJson = JSON.parse(extractedText);
        } catch {
          const clean = extractedText.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
          try {
            parsedJson = JSON.parse(clean);
          } catch {}
        }
      }

      return {
        text: extractedText,
        json: parsedJson,
        model,
        durationMs: Date.now() - start,
      };
    } finally {
      clearTimeout(timer);
    }
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
        const clean = rawResult.text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(clean);
      } catch (err: any) {
        throw new Error(`Ответ Custom REST не является валидным JSON: ${err.message}`);
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
