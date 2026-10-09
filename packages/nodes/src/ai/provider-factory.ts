import { IAIProvider } from './provider-interface.js';
import { OpenAIAdapter } from './adapters/openai-adapter.js';
import { GeminiAdapter } from './adapters/gemini-adapter.js';
import { AnthropicAdapter } from './adapters/anthropic-adapter.js';
import { OllamaAdapter } from './adapters/ollama-adapter.js';
import { CustomRestAdapter } from './adapters/custom-rest-adapter.js';
import { MockAIProvider } from './mock-provider.js';
import { AIProviderDto } from '@neuroflow/shared';
import { decryptData } from '@neuroflow/database';

export class AIProviderFactory {
  private static registeredProviders = new Map<string, IAIProvider>();

  /**
   * Создание экземпляра адаптера на основе DTO конфигурации провайдера
   */
  public static createProvider(config: {
    id: string;
    name: string;
    providerType: string;
    apiProtocol?: string;
    baseUrl?: string | null;
    authType?: string;
    apiKeyEncrypted?: string | null;
    apiKeyPlain?: string | null;
    customHeadersEncrypted?: string | null;
    customHeadersPlain?: Record<string, string> | null;
    customRequestPath?: string | null;
    customResponsePath?: string | null;
    customBodyTemplate?: any;
    defaultModelId?: string | null;
    availableModels?: any[];
    settings?: any;
  }): IAIProvider {
    // 1. Расшифровка API-ключа
    let apiKey = config.apiKeyPlain || undefined;
    if (!apiKey && config.apiKeyEncrypted) {
      try {
        apiKey = decryptData(config.apiKeyEncrypted);
      } catch {
        apiKey = config.apiKeyEncrypted;
      }
    }

    // 2. Расшифровка Custom Headers
    let customHeaders: Record<string, string> = config.customHeadersPlain || {};
    if (config.customHeadersEncrypted) {
      try {
        const decrypted = decryptData(config.customHeadersEncrypted);
        customHeaders = { ...customHeaders, ...JSON.parse(decrypted) };
      } catch {
        // Игнорируем
      }
    }

    const type = config.providerType;
    const settings = config.settings || {};

    if (type === 'mock') {
      return new MockAIProvider();
    }

    if (type === 'gemini') {
      return new GeminiAdapter({
        id: config.id,
        name: config.name,
        baseUrl: config.baseUrl || undefined,
        apiKey,
        defaultModel: config.defaultModelId || 'gemini-2.0-flash',
        models: config.availableModels,
        timeoutMs: settings.timeoutMs,
      });
    }

    if (type === 'anthropic') {
      return new AnthropicAdapter({
        id: config.id,
        name: config.name,
        baseUrl: config.baseUrl || undefined,
        apiKey,
        defaultModel: config.defaultModelId || 'claude-3-5-sonnet-20241022',
        models: config.availableModels,
        timeoutMs: settings.timeoutMs,
      });
    }

    if (type === 'ollama') {
      return new OllamaAdapter({
        id: config.id,
        name: config.name,
        baseUrl: config.baseUrl || undefined,
        defaultModel: config.defaultModelId || 'llama3.2',
        models: config.availableModels,
        timeoutMs: settings.timeoutMs,
        allowLocalOllama: settings.allowLocalOllama !== false,
      });
    }

    if (type === 'custom-rest') {
      return new CustomRestAdapter({
        id: config.id,
        name: config.name,
        baseUrl: config.baseUrl || '',
        apiKey,
        authType: config.authType,
        customHeaders,
        customRequestPath: config.customRequestPath || undefined,
        customResponsePath: config.customResponsePath || undefined,
        customBodyTemplate: config.customBodyTemplate,
        defaultModel: config.defaultModelId || 'custom-model',
        models: config.availableModels,
        timeoutMs: settings.timeoutMs,
        allowLocalOllama: settings.allowLocalOllama,
      });
    }

    // По умолчанию: OpenAI или OpenAI-compatible (vLLM, DeepSeek, Groq)
    return new OpenAIAdapter({
      id: config.id,
      name: config.name,
      type: type === 'openai-compatible' ? 'openai-compatible' : 'openai',
      baseUrl: config.baseUrl || undefined,
      apiKey,
      authType: config.authType,
      customHeaders,
      customRequestPath: config.customRequestPath || undefined,
      defaultModel: config.defaultModelId || 'gpt-4o-mini',
      models: config.availableModels,
      timeoutMs: settings.timeoutMs,
      allowLocalOllama: settings.allowLocalOllama,
    });
  }

  private static singletonInstance?: AIProviderFactory;
  private defaultProviderId?: string;

  public static getInstance(): AIProviderFactory;
  public static getInstance(id: string): IAIProvider | undefined;
  public static getInstance(id?: string): any {
    if (typeof id === 'string') {
      return this.registeredProviders.get(id);
    }
    if (!AIProviderFactory.singletonInstance) {
      AIProviderFactory.singletonInstance = new AIProviderFactory();
    }
    return AIProviderFactory.singletonInstance;
  }

  public static registerInstance(id: string, provider: IAIProvider): void {
    this.registeredProviders.set(id, provider);
  }

  public static clearInstances(): void {
    this.registeredProviders.clear();
  }

  public registerProvider(id: string, provider: IAIProvider, isDefault: boolean = false): void {
    AIProviderFactory.registeredProviders.set(id, provider);
    if (isDefault || !this.defaultProviderId) {
      this.defaultProviderId = id;
    }
  }

  public async getProvider(id?: string): Promise<IAIProvider> {
    if (id) {
      const found = AIProviderFactory.registeredProviders.get(id);
      if (found) return found;
    }
    if (this.defaultProviderId) {
      const def = AIProviderFactory.registeredProviders.get(this.defaultProviderId);
      if (def) return def;
    }
    const first = AIProviderFactory.registeredProviders.values().next().value;
    if (first) return first;
    return new MockAIProvider();
  }

  public async getDefaultProvider(): Promise<IAIProvider> {
    return this.getProvider();
  }

  public async testConnection(id: string, model?: string): Promise<any> {
    const provider = await this.getProvider(id);
    return provider.testConnection(model);
  }
}

export const ProviderFactory = AIProviderFactory;
