import { z } from 'zod';

export enum MissionStatus {
  DRAFT = 'draft',
  PLANNING = 'planning',
  READY = 'ready',
  RUNNING = 'running',
  WAITING_FOR_APPROVAL = 'waiting_for_approval',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum MissionTaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  WAITING_FOR_APPROVAL = 'waiting_for_approval',
}

export enum CheckpointType {
  TASK_COMPLETED = 'task_completed',
  PRE_SENSITIVE_ACTION = 'pre_sensitive_action',
  MANUAL_PAUSE = 'manual_pause',
  PERIODIC = 'periodic',
}

export const MissionTaskCriteriaSchema = z.object({
  id: z.string(),
  description: z.string(),
  expectedType: z.enum(['file_exists', 'json_match', 'non_empty_string', 'http_success', 'custom']).default('custom'),
  target: z.string().optional(),
});

export type MissionTaskCriteria = z.infer<typeof MissionTaskCriteriaSchema>;

export const MissionTaskDefinitionSchema = z.object({
  taskKey: z.string(),
  title: z.string(),
  description: z.string(),
  assignedAgent: z.string().default('General Agent'),
  dependencies: z.array(z.string()).default([]),
  criteria: z.array(MissionTaskCriteriaSchema).default([]),
  inputData: z.record(z.any()).default({}),
  maxRetries: z.number().int().nonnegative().default(3),
});

export type MissionTaskDefinition = z.infer<typeof MissionTaskDefinitionSchema>;

export const MissionPlanSchema = z.object({
  summary: z.string(),
  successCriteria: z.array(z.string()),
  tasks: z.array(MissionTaskDefinitionSchema),
  estimatedTokens: z.number().int().positive().default(10000),
  suggestedAgents: z.array(z.string()).default([]),
});

export type MissionPlan = z.infer<typeof MissionPlanSchema>;

export const CreateMissionSchema = z.object({
  goal: z.string().min(3),
  title: z.string().optional(),
  description: z.string().optional(),
  tokenBudget: z.number().int().positive().default(50000),
  costBudget: z.number().int().nonnegative().default(0),
  allowedTools: z.array(z.string()).default([]),
  deadline: z.string().optional(),
  providerId: z.string().optional(),
  model: z.string().optional(),
});

export type CreateMissionInput = z.infer<typeof CreateMissionSchema>;

export const MissionActionSchema = z.object({
  action: z.enum(['start', 'pause', 'resume', 'cancel', 'approve']),
  reason: z.string().optional(),
  approvedPlan: MissionPlanSchema.optional(),
});

export type MissionActionInput = z.infer<typeof MissionActionSchema>;

export interface MissionSummary {
  id: string;
  title: string;
  goal: string;
  status: MissionStatus;
  progressPercent: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  tokensUsed: number;
  tokenBudget: number;
  createdAt: string;
  updatedAt: string;
}
