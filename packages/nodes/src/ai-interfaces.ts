import { WorkflowGraph } from '@neuroflow/shared';

/**
 * Интерфейс провайдера больших языковых моделей (LLM)
 */
export interface ILLMProvider {
  id: string;
  name: string; // OpenAI, Anthropic, Ollama, LocalLM
  supportedModels: string[];
  complete(prompt: string, options?: { model?: string; temperature?: number; maxTokens?: number }): Promise<string>;
  chat(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>, options?: any): Promise<string>;
}

/**
 * Реестр провайдеров LLM
 */
export interface ILLMProviderRegistry {
  registerProvider(provider: ILLMProvider): void;
  getProvider(id: string): ILLMProvider | undefined;
  listProviders(): string[];
}

/**
 * Долговременная и сессионная память агента
 */
export interface IAgentMemory {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttlSeconds?: number): Promise<void>;
  searchSimilar(query: string, limit?: number): Promise<Array<{ content: string; score: number }>>;
  clear(scopeId?: string): Promise<void>;
}

/**
 * Интерфейс будущего AI Agent Node
 */
export interface IAIAgentNodeConfig {
  providerId: string;
  model: string;
  systemPrompt: string;
  memoryEnabled: boolean;
  tools: string[]; // ID разрешенных узлов/инструментов
  maxIterations: number;
}

/**
 * Генератор воркфлоу на базе естественного языка (AI Workflow Generator)
 */
export interface IAIWorkflowGenerator {
  generateFromPrompt(userPrompt: string): Promise<{
    graph: WorkflowGraph;
    explanation: string;
    suggestedName: string;
  }>;
  suggestFix(errorLog: string, currentGraph: WorkflowGraph): Promise<{
    fixedGraph: WorkflowGraph;
    reasoning: string;
  }>;
}

/**
 * Мульти-агентная оркестрация
 */
export interface IMultiAgentOrchestrator {
  dispatchTask(task: string, availableAgents: string[]): Promise<{
    agentId: string;
    result: any;
  }>;
}

/**
 * Интерфейсы для мессенджер-триггеров (Telegram, Discord)
 */
export interface ITelegramTriggerPayload {
  updateId: number;
  messageId: number;
  chatId: number;
  sender: { id: number; username?: string; firstName?: string };
  text: string;
  raw: any;
}

export interface IDiscordTriggerPayload {
  guildId?: string;
  channelId: string;
  messageId: string;
  author: { id: string; username: string; bot: boolean };
  content: string;
  raw: any;
}
