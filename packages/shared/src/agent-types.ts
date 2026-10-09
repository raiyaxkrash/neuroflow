export type AgentMemoryScope =
  | 'conversation'
  | 'execution'
  | 'persistent'
  | 'workspace';

export interface AgentMemoryRecord {
  id: string;
  userId: string;
  agentId: string;
  workflowId?: string | null;
  executionId?: string | null;
  scope: AgentMemoryScope;
  key: string;
  value: string;
  metadata?: Record<string, any> | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HumanApprovalRecord {
  id: string;
  executionId: string;
  nodeId: string;
  agentId: string;
  toolName: string;
  toolArguments: Record<string, any>;
  consequences?: string | null;
  actionFingerprint: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentToolPermission {
  toolId: string;
  source: 'mcp' | 'node' | 'rest' | 'builtin';
  name: string;
  requiresApproval?: boolean;
}

export interface AgentExecutionLimits {
  maxIterations?: number;
  maxToolCalls?: number;
  maxExecutionTimeMs?: number;
  tokenBudget?: number;
  costBudgetUsd?: number;
}

export interface AgentHandoffRule {
  targetAgentId: string;
  conditionDescription: string;
  contextTransferKeys?: string[];
}

export interface AgentTraceEvent {
  id: string;
  executionId: string;
  nodeId: string;
  agentId: string;
  eventType:
    | 'thought'
    | 'tool_call'
    | 'tool_result'
    | 'handoff'
    | 'delegation'
    | 'approval_request'
    | 'approval_resolved'
    | 'memory_access'
    | 'error'
    | 'final_answer';
  payload: Record<string, any>;
  tokensUsed?: number;
  costEstimate?: string;
  durationMs?: number;
  createdAt: string;
}
