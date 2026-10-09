import { z } from 'zod';
import {
  ExecutionStatus,
  NodeExecutionStatus,
  NodeCategory,
  WorkflowTriggerType,
  HttpMethod,
  ConditionOperator,
} from './enums.js';

export const WorkflowPortSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['main', 'true', 'false', 'custom']),
  description: z.string().optional(),
});

export const WorkflowNodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const WorkflowNodeDataSchema = z.object({
  label: z.string(),
  type: z.string(),
  parameters: z.record(z.any()).default({}),
  credentialsId: z.string().nullable().optional(),
}).passthrough();

export const WorkflowNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: WorkflowNodePositionSchema,
  data: WorkflowNodeDataSchema,
});

export const WorkflowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
});

export const WorkflowGraphSchema = z.object({
  nodes: z.array(WorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
});

export const WorkflowSettingsSchema = z.object({
  saveExecutionProgress: z.boolean().default(true),
  timeoutSeconds: z.number().positive().default(60),
  retryOnFailure: z.boolean().default(false),
  maxRetries: z.number().int().nonnegative().default(3),
}).default({});

export const CreateWorkflowSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  graph: WorkflowGraphSchema.optional(),
  settings: WorkflowSettingsSchema.optional(),
});

export const UpdateWorkflowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  graph: WorkflowGraphSchema.optional(),
  settings: WorkflowSettingsSchema.optional(),
});

export const ExecuteWorkflowSchema = z.object({
  triggerNodeId: z.string().optional(),
  payload: z.record(z.any()).optional().default({}),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
});

// Схемы параметров узлов первой фазы:
export const ManualTriggerParametersSchema = z.object({
  initialPayload: z.record(z.any()).optional().default({}),
});

export const HttpRequestParametersSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  method: z.nativeEnum(HttpMethod).default(HttpMethod.GET),
  headers: z.record(z.string()).optional().default({}),
  queryParams: z.record(z.string()).optional().default({}),
  body: z.any().optional(),
  timeoutMs: z.number().int().min(500).max(30000).default(10000),
});

export const ConditionParametersSchema = z.object({
  leftValue: z.string().default(''),
  operator: z.nativeEnum(ConditionOperator).default(ConditionOperator.EQUALS),
  rightValue: z.string().default(''),
});

export const SetDataParametersSchema = z.object({
  operations: z.array(
    z.object({
      targetKey: z.string().min(1),
      sourceValue: z.any(),
      valueType: z.enum(['string', 'number', 'boolean', 'json', 'expression']).default('string'),
    })
  ).default([]),
});

export const DelayParametersSchema = z.object({
  seconds: z.number().int().min(1).max(300).default(5),
});

export const OutputParametersSchema = z.object({
  includeInputs: z.boolean().default(true),
  customKey: z.string().optional(),
});

// AI Model Node Schema
export const AIModelParametersSchema = z.object({
  providerId: z.string().optional(),
  model: z.string().default('default'),
  systemPrompt: z.string().optional().default(''),
  userPrompt: z.string().default(''),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(32768).default(2048),
  responseFormat: z.enum(['text', 'json']).default('text'),
  timeoutMs: z.number().int().min(1000).max(120000).default(30000),
  retryCount: z.number().int().min(0).max(5).default(2),
});

// AI Provider Schemas
export const CreateAIProviderSchema = z.object({
  name: z.string().min(1).max(100),
  providerType: z.enum(['openai', 'gemini', 'anthropic', 'ollama', 'openai-compatible', 'custom-rest']),
  apiProtocol: z.string().optional().default(''),
  baseUrl: z.string().url().or(z.literal('')).optional(),
  authType: z.enum(['bearer', 'api-key-header', 'basic', 'none', 'custom-headers']).default('bearer'),
  apiKey: z.string().optional(),
  customHeaders: z.record(z.string()).optional(),
  customRequestPath: z.string().optional(),
  customResponsePath: z.string().optional(),
  customBodyTemplate: z.any().optional(),
  defaultModelId: z.string().optional(),
  availableModels: z.array(z.object({
    id: z.string(),
    name: z.string(),
    contextWindow: z.number().optional(),
    maxOutputTokens: z.number().optional(),
  })).optional(),
  settings: z.object({
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
    topP: z.number().min(0).max(1).optional(),
    timeoutMs: z.number().int().positive().optional(),
    retryCount: z.number().int().min(0).max(5).optional(),
    allowLocalOllama: z.boolean().optional(),
    customParams: z.record(z.any()).optional(),
  }).optional().default({}),
  isDefault: z.boolean().default(false),
  isEnabled: z.boolean().default(true),
});

export const UpdateAIProviderSchema = CreateAIProviderSchema.partial();

export const TestConnectionSchema = z.object({
  providerType: z.enum(['openai', 'gemini', 'anthropic', 'ollama', 'openai-compatible', 'custom-rest']),
  baseUrl: z.string().optional(),
  authType: z.enum(['bearer', 'api-key-header', 'basic', 'none', 'custom-headers']).optional(),
  apiKey: z.string().optional(),
  customHeaders: z.record(z.string()).optional(),
  model: z.string().optional(),
  customRequestPath: z.string().optional(),
  allowLocalOllama: z.boolean().optional(),
});

export const AIGenerateWorkflowSchema = z.object({
  prompt: z.string().min(3).max(4000),
  providerId: z.string().optional(),
  model: z.string().optional(),
  contextGraph: WorkflowGraphSchema.optional(),
});

export const AICopilotRequestSchema = z.object({
  workflowId: z.string().optional(),
  message: z.string().optional(),
  history: z.array(z.any()).optional(),
  selectedNodeId: z.string().optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    timestamp: z.string().optional(),
    actions: z.array(z.any()).optional(),
  })).optional().default([]),
  currentGraph: WorkflowGraphSchema,
  providerId: z.string().optional(),
  model: z.string().optional(),
});

export const AIDebugRequestSchema = z.object({
  executionId: z.string(),
  failedNodeId: z.string().optional(),
  providerId: z.string().optional(),
});

// Phase 3: Multi-Agent Node Parameters Schemas
export const AIAgentParametersSchema = z.object({
  agentName: z.string().default('Agent'),
  roleDescription: z.string().default('Autonomous problem-solving agent'),
  systemInstructions: z.string().default('You are a specialized agent. Think step by step and use tools when needed.'),
  userPrompt: z.string().default('Process task: {{input}}'),
  providerId: z.string().optional(),
  model: z.string().default('default'),
  temperature: z.number().min(0).max(2).default(0.5),
  allowedTools: z.array(z.string()).default([]), // список toolId или 'mcp:serverId:toolName'
  memoryScope: z.enum(['conversation', 'execution', 'persistent', 'workspace', 'none']).default('conversation'),
  maxIterations: z.number().int().min(1).max(30).default(10),
  maxToolCalls: z.number().int().min(0).max(50).default(20),
  timeoutMs: z.number().int().min(1000).max(300000).default(60000),
  tokenBudget: z.number().int().min(100).max(128000).default(8192),
});

export const AgentSupervisorParametersSchema = z.object({
  supervisorName: z.string().default('Supervisor'),
  strategy: z.enum(['hierarchical', 'sequential', 'parallel', 'router']).default('hierarchical'),
  systemInstructions: z.string().default('You are a team supervisor. Deconstruct user tasks, delegate to specialized worker agents, and synthesize final answers.'),
  userGoal: z.string().default('Coordinate team to solve: {{input}}'),
  workerAgentIds: z.array(z.string()).default([]),
  providerId: z.string().optional(),
  model: z.string().default('default'),
  maxRounds: z.number().int().min(1).max(20).default(5),
  timeoutMs: z.number().int().min(5000).max(600000).default(120000),
});

export const AgentHandoffParametersSchema = z.object({
  targetAgentId: z.string().default(''),
  handoffReason: z.string().default('Delegate subtask to specialized agent'),
  contextTransferKeys: z.array(z.string()).default([]),
  maxHandoffDepth: z.number().int().min(1).max(10).default(5),
});

export const AgentMemoryParametersSchema = z.object({
  operation: z.enum(['read', 'write', 'search', 'delete', 'clear']).default('read'),
  scope: z.enum(['conversation', 'execution', 'persistent', 'workspace']).default('persistent'),
  key: z.string().optional().default(''),
  value: z.string().optional().default(''),
  searchQuery: z.string().optional().default(''),
  limit: z.number().int().min(1).max(50).default(5),
  ttlSeconds: z.number().int().min(0).optional(),
});

export const ToolExecutorParametersSchema = z.object({
  toolSource: z.enum(['mcp', 'node', 'rest', 'builtin']).default('builtin'),
  serverId: z.string().optional(),
  toolName: z.string().min(1),
  arguments: z.record(z.any()).default({}),
  requiresApproval: z.boolean().default(false),
  timeoutMs: z.number().int().min(1000).max(120000).default(30000),
});

export const HumanApprovalParametersSchema = z.object({
  actionTitle: z.string().default('Требуется подтверждение действия'),
  actionDescription: z.string().default('Агент запрашивает разрешение на выполнение чувствительной операции.'),
  consequences: z.string().default('Внешнее действие будет выполнено от вашего имени.'),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  timeoutMinutes: z.number().int().min(1).max(1440).default(60),
});

export const MCPToolParametersSchema = z.object({
  serverId: z.string().min(1),
  toolName: z.string().min(1),
  arguments: z.record(z.any()).default({}),
  timeoutMs: z.number().int().min(1000).max(120000).default(30000),
});

// Phase 3: MCP Server API Schemas
export const CreateMCPServerSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  transport: z.enum(['http', 'sse', 'stdio']),
  serverUrl: z.string().url().optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  authType: z.enum(['none', 'bearer', 'api-key-header', 'custom-headers']).default('none'),
  apiKey: z.string().optional(),
  customHeaders: z.record(z.string()).optional(),
  timeoutMs: z.number().int().min(1000).max(120000).default(30000),
  isEnabled: z.boolean().default(true),
});

export const UpdateMCPServerSchema = CreateMCPServerSchema.partial();

export const CallMCPToolSchema = z.object({
  toolName: z.string().min(1),
  arguments: z.record(z.any()).default({}),
});

export const ReviewApprovalSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().max(500).optional(),
});

// Phase 4: Integration Node Parameter Schemas

// Telegram Schemas
export const TelegramMessageTriggerParametersSchema = z.object({
  chatTypes: z.array(z.enum(['private', 'group', 'supergroup', 'channel'])).default(['private']),
  requireText: z.boolean().default(true),
  allowedUserIds: z.array(z.union([z.string(), z.number()])).default([]),
  allowedChatIds: z.array(z.union([z.string(), z.number()])).default([]),
});

export const TelegramCommandTriggerParametersSchema = z.object({
  command: z.string().min(1).default('/start'),
  allowedUserIds: z.array(z.union([z.string(), z.number()])).default([]),
  allowedChatIds: z.array(z.union([z.string(), z.number()])).default([]),
});

export const TelegramSendMessageParametersSchema = z.object({
  chatId: z.union([z.string(), z.number()]).default(''),
  text: z.string().default(''),
  parseMode: z.enum(['Markdown', 'MarkdownV2', 'HTML']).default('Markdown'),
  replyToMessageId: z.union([z.string(), z.number()]).optional(),
  inlineKeyboard: z.any().optional(),
});

export const TelegramSendDocumentParametersSchema = z.object({
  chatId: z.union([z.string(), z.number()]).default(''),
  caption: z.string().optional(),
  filename: z.string().optional(),
  documentUrl: z.string().optional(),
  documentBase64: z.string().optional(),
  parseMode: z.enum(['Markdown', 'MarkdownV2', 'HTML']).default('Markdown'),
});

// GitHub Schemas
export const GitHubEventTriggerParametersSchema = z.object({
  events: z.array(z.string()).default(['issues', 'pull_request', 'push']),
  repository: z.string().optional(),
});

export const GitHubGetIssueParametersSchema = z.object({
  owner: z.string().default(''),
  repo: z.string().default(''),
  issueNumber: z.union([z.string(), z.number()]).default(1),
});

export const GitHubCreateIssueParametersSchema = z.object({
  owner: z.string().default(''),
  repo: z.string().default(''),
  title: z.string().default(''),
  body: z.string().optional(),
  labels: z.array(z.string()).optional(),
  requiresApproval: z.boolean().default(false),
});

// Discord Schemas
export const DiscordTriggerParametersSchema = z.object({
  channelIds: z.array(z.string()).default([]),
  guildIds: z.array(z.string()).default([]),
  requirePrefix: z.string().optional(),
});

export const DiscordSendMessageParametersSchema = z.object({
  channelId: z.string().default(''),
  content: z.string().default(''),
  embeds: z.any().optional(),
});

// Filesystem Schemas
export const ReadFileParametersSchema = z.object({
  filePath: z.string().default(''),
  encoding: z.enum(['utf-8', 'json', 'base64']).default('utf-8'),
});

export const WriteFileParametersSchema = z.object({
  filePath: z.string().default(''),
  content: z.any().default(''),
  mode: z.enum(['overwrite', 'append']).default('overwrite'),
  requiresApproval: z.boolean().default(false),
});

export const ListDirectoryParametersSchema = z.object({
  directoryPath: z.string().default('.'),
});

export const FileChangedTriggerParametersSchema = z.object({
  directoryPath: z.string().default('./data/storage'),
  events: z.array(z.enum(['add', 'change', 'unlink'])).default(['add', 'change']),
});

// Scheduler & Webhook Schemas
export const ScheduleTriggerParametersSchema = z.object({
  mode: z.enum(['cron', 'interval', 'daily', 'weekly', 'exact_date']).default('daily'),
  cronExpression: z.string().optional().default('0 9 * * *'),
  intervalMinutes: z.number().int().min(1).max(10080).optional().default(60),
  timeOfDay: z.string().optional().default('09:00'),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional().default([1, 2, 3, 4, 5]),
  exactDateTime: z.string().optional(),
  timezone: z.string().default('Europe/Moscow'),
});

export const WebhookTriggerParametersSchema = z.object({
  httpMethod: z.enum(['GET', 'POST', 'ANY']).default('POST'),
  authType: z.enum(['none', 'bearer', 'hmac']).default('none'),
  authSecret: z.string().optional(),
  hmacHeader: z.string().default('x-signature'),
  responseStatus: z.number().int().default(200),
  customResponse: z.any().optional(),
});

// Phase 5: Second Brain & Knowledge Nodes Schemas

export const CreateKnowledgeSourceSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['file', 'directory', 'git', 'github', 'execution_history', 'user_note', 'agent_output']),
  pathOrUrl: z.string().optional(),
  config: z.record(z.any()).default({}),
});

export const KnowledgeSearchParametersSchema = z.object({
  query: z.string().default(''),
  searchMode: z.enum(['hybrid', 'text', 'vector']).default('hybrid'),
  limit: z.number().int().min(1).max(50).default(5),
  sourceIds: z.array(z.string()).optional(),
  minScore: z.number().min(0).max(1).default(0.3),
});

export const KnowledgeInsertParametersSchema = z.object({
  title: z.string().default(''),
  content: z.string().default(''),
  sourceId: z.string().optional(),
  metadata: z.record(z.any()).default({}),
  chunkSize: z.number().int().min(100).max(5000).default(800),
  chunkOverlap: z.number().int().min(0).max(1000).default(150),
});

export const DocumentLoaderParametersSchema = z.object({
  sourceType: z.enum(['file_path', 'raw_text', 'url']).default('file_path'),
  pathOrText: z.string().default(''),
  encoding: z.enum(['utf-8', 'binary']).default('utf-8'),
});

export const DocumentChunkerParametersSchema = z.object({
  chunkSize: z.number().int().min(100).max(5000).default(800),
  chunkOverlap: z.number().int().min(0).max(1000).default(150),
  strategy: z.enum(['recursive', 'sentence', 'fixed']).default('recursive'),
});

export const EmbeddingsGeneratorParametersSchema = z.object({
  providerId: z.string().optional(),
  model: z.string().default('default'),
  batchSize: z.number().int().min(1).max(50).default(10),
});

export const RAGQueryParametersSchema = z.object({
  question: z.string().default(''),
  searchMode: z.enum(['hybrid', 'text', 'vector']).default('hybrid'),
  maxChunks: z.number().int().min(1).max(20).default(5),
  providerId: z.string().optional(),
  model: z.string().default('default'),
  temperature: z.number().min(0).max(1).default(0.2),
  systemPrompt: z.string().optional(),
  strictCitation: z.boolean().default(true),
});

export const MemoryReadParametersSchema = z.object({
  scope: z.enum(['episodic', 'semantic', 'project', 'shared', 'execution', 'workflow', 'agent', 'user']).default('semantic'),
  key: z.string().default(''),
  query: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

export const MemoryWriteParametersSchema = z.object({
  scope: z.enum(['episodic', 'semantic', 'project', 'shared', 'execution', 'workflow', 'agent', 'user']).default('semantic'),
  key: z.string().default(''),
  value: z.any().default(''),
  requiresApproval: z.boolean().default(false),
  provenance: z.string().optional(),
  confidence: z.number().int().min(0).max(100).default(100),
  ttlSeconds: z.number().int().min(0).optional(),
});

export const KnowledgeGraphQueryParametersSchema = z.object({
  query: z.string().default(''),
  entityTypes: z.array(z.string()).optional(),
  relationTypes: z.array(z.string()).optional(),
  startEntityId: z.string().optional(),
  maxDepth: z.number().int().min(1).max(5).default(2),
});

export const TokenBudgetConfigSchema = z.object({
  dailyLimitTokens: z.number().int().min(0).default(1000000),
  perExecutionLimitTokens: z.number().int().min(0).default(100000),
  perAgentLimitTokens: z.number().int().min(0).default(50000),
  actionOnLimit: z.enum(['warn', 'stop']).default('warn'),
});




