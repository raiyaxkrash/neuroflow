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
