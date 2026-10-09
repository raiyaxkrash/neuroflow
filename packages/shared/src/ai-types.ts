import { WorkflowGraph } from './types.js';

export type AIProviderType =
  | 'openai'
  | 'gemini'
  | 'anthropic'
  | 'ollama'
  | 'openai-compatible'
  | 'custom-rest';

export type AIAuthType =
  | 'bearer'
  | 'api-key-header'
  | 'basic'
  | 'none'
  | 'custom-headers';

export interface AIModelMeta {
  id: string;
  name: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  inputPricePer1k?: number;
  outputPricePer1k?: number;
  supportsVision?: boolean;
}

export interface AIProviderCapabilities {
  chat: boolean;
  structuredOutput: boolean;
  streaming: boolean;
  functionCalling: boolean;
  modelDiscovery: boolean;
}

export interface AIProviderDto {
  id: string;
  userId: string;
  name: string;
  providerType: AIProviderType;
  apiProtocol: string;
  baseUrl?: string | null;
  authType: AIAuthType;
  apiKeyMasked?: string | null;
  customHeadersMasked?: Record<string, string> | null;
  customRequestPath?: string | null;
  customResponsePath?: string | null;
  customBodyTemplate?: any;
  defaultModelId?: string | null;
  availableModels: AIModelMeta[];
  settings: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    timeoutMs?: number;
    retryCount?: number;
    allowLocalOllama?: boolean;
    customParams?: Record<string, any>;
  };
  isDefault: boolean;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAIProviderDto {
  name: string;
  providerType: AIProviderType;
  apiProtocol?: string;
  baseUrl?: string;
  authType?: AIAuthType;
  apiKey?: string;
  customHeaders?: Record<string, string>;
  customRequestPath?: string;
  customResponsePath?: string;
  customBodyTemplate?: any;
  defaultModelId?: string;
  availableModels?: AIModelMeta[];
  settings?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    timeoutMs?: number;
    retryCount?: number;
    allowLocalOllama?: boolean;
    customParams?: Record<string, any>;
  };
  isDefault?: boolean;
  isEnabled?: boolean;
}

export interface UpdateAIProviderDto extends Partial<CreateAIProviderDto> {}

export interface TestConnectionRequest {
  providerType: AIProviderType;
  baseUrl?: string;
  authType?: AIAuthType;
  apiKey?: string;
  customHeaders?: Record<string, string>;
  model?: string;
  customRequestPath?: string;
  allowLocalOllama?: boolean;
}

export interface TestConnectionResult {
  success: boolean;
  latencyMs: number;
  modelsFound?: string[];
  message: string;
  errorDetails?: string;
}

export interface GenerateTextOptions {
  systemPrompt?: string;
  userPrompt?: string;
  prompt?: string;
  schema?: any;
  messages?: Array<{ role: string; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  customParams?: Record<string, any>;
  signal?: AbortSignal;
  responseFormat?: 'text' | 'json';
}

export interface GenerateTextResult {
  text: string;
  json?: any;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  durationMs: number;
}

export interface AIModelNodeParameters {
  providerId?: string;
  model: string;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
  timeoutMs?: number;
  retryCount?: number;
}

// AI Workflow Generator
export interface AIGenerateWorkflowRequest {
  prompt: string;
  providerId?: string;
  model?: string;
  contextGraph?: WorkflowGraph;
}

export interface AIGenerateWorkflowResponse {
  name: string;
  description: string;
  graph: WorkflowGraph;
  explanation: string;
  missingParameters?: Array<{
    nodeId: string;
    nodeLabel: string;
    parameterName: string;
    description: string;
  }>;
}

// AI Copilot Actions
export type AICopilotActionType =
  | 'add_node'
  | 'remove_node'
  | 'connect_nodes'
  | 'update_parameters'
  | 'replace_graph';

export interface AICopilotAction {
  type: AICopilotActionType;
  description: string;
  payload: any;
}

export interface AICopilotMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  actions?: AICopilotAction[];
}

export interface AICopilotRequest {
  workflowId?: string;
  message?: string;
  history?: any[];
  selectedNodeId?: string;
  messages?: AICopilotMessage[];
  currentGraph: WorkflowGraph;
  providerId?: string;
  model?: string;
}

export interface AICopilotResponse {
  reply?: string;
  message: AICopilotMessage;
  proposedGraph?: WorkflowGraph;
  actions: AICopilotAction[];
  explanation: string;
}

// AI Debugger
export interface AIDebugRequest {
  executionId: string;
  failedNodeId?: string;
  providerId?: string;
}

export interface AIDebugResponse {
  summary: string;
  rootCause: string;
  explanation: string;
  suggestedFix: string;
  recommendations?: string[];
  proposedNodeParameters?: Record<string, any>;
  suggestedNodePatch?: Record<string, any>;
  proposedGraph?: WorkflowGraph;
}
