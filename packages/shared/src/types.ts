import {
  ExecutionStatus,
  NodeExecutionStatus,
  NodeCategory,
  WorkflowTriggerType,
} from './enums.js';

export interface WorkflowNodePosition {
  x: number;
  y: number;
}

export interface WorkflowPortDefinition {
  id: string;
  name: string;
  type: 'main' | 'true' | 'false' | 'custom';
  description?: string;
}

export interface NodeDefinitionMeta {
  type: string;
  name: string;
  description: string;
  category: NodeCategory;
  icon: string;
  color?: string;
  inputs: WorkflowPortDefinition[];
  outputs: WorkflowPortDefinition[];
  parameterSchema: Record<string, any>;
  defaultParameters: Record<string, any>;
}

export interface WorkflowNodeData {
  label: string;
  type: string;
  parameters: Record<string, any>;
  credentialsId?: string | null;
  [key: string]: any;
}

export interface WorkflowNode {
  id: string;
  type: string;
  position: WorkflowNodePosition;
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowSettings {
  saveExecutionProgress?: boolean;
  timeoutSeconds?: number;
  retryOnFailure?: boolean;
  maxRetries?: number;
}

export interface WorkflowDto {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  version: number;
  graph: WorkflowGraph;
  settings: WorkflowSettings;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionInput {
  triggerNodeId?: string;
  payload?: Record<string, any>;
}

export interface NodeExecutionRecord {
  id: string;
  executionId: string;
  nodeId: string;
  nodeType: string;
  status: NodeExecutionStatus;
  startedAt: string;
  finishedAt?: string | null;
  durationMs?: number | null;
  inputData?: any;
  outputData?: any;
  error?: string | null;
}

export interface ExecutionRecord {
  id: string;
  workflowId: string;
  workflowVersion: number;
  status: ExecutionStatus;
  startedAt: string;
  finishedAt?: string | null;
  durationMs?: number | null;
  triggerType: WorkflowTriggerType;
  inputPayload?: any;
  outputPayload?: any;
  error?: string | null;
  nodeExecutions?: NodeExecutionRecord[];
}

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: UserDto;
}

export interface CredentialDto {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}
