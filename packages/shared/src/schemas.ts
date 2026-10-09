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

