import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  uuid,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import {
  ExecutionStatus,
  NodeExecutionStatus,
  WorkflowTriggerType,
} from '@neuroflow/shared';

// Таблица пользователей (локальная авторизация, подготовка к multi-tenant SaaS)
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role', { enum: ['admin', 'user'] }).default('user').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Таблица воркфлоу
export const workflows = pgTable('workflows', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  version: integer('version').default(1).notNull(),
  graph: jsonb('graph').notNull(), // { nodes: [], edges: [] }
  settings: jsonb('settings').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('workflows_user_id_idx').on(table.userId),
  index('workflows_updated_at_idx').on(table.updatedAt),
]);

// Таблица версий воркфлоу (для истории изменений и воспроизводимости)
export const workflowVersions = pgTable('workflow_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  workflowId: uuid('workflow_id').references(() => workflows.id, { onDelete: 'cascade' }).notNull(),
  version: integer('version').notNull(),
  graph: jsonb('graph').notNull(),
  settings: jsonb('settings').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('workflow_versions_wf_ver_idx').on(table.workflowId, table.version),
]);

// Таблица запусков (Executions)
export const executions = pgTable('executions', {
  id: uuid('id').defaultRandom().primaryKey(),
  workflowId: uuid('workflow_id').references(() => workflows.id, { onDelete: 'cascade' }).notNull(),
  workflowVersion: integer('workflow_version').notNull(),
  status: text('status', {
    enum: [
      ExecutionStatus.PENDING,
      ExecutionStatus.RUNNING,
      ExecutionStatus.WAITING_FOR_APPROVAL,
      ExecutionStatus.SUCCESS,
      ExecutionStatus.FAILED,
      ExecutionStatus.CANCELLED,
      ExecutionStatus.SKIPPED,
    ],
  }).default(ExecutionStatus.PENDING).notNull(),
  triggerType: text('trigger_type', {
    enum: [
      WorkflowTriggerType.MANUAL,
      WorkflowTriggerType.WEBHOOK,
      WorkflowTriggerType.SCHEDULE,
      WorkflowTriggerType.EVENT,
    ],
  }).default(WorkflowTriggerType.MANUAL).notNull(),
  inputPayload: jsonb('input_payload'),
  outputPayload: jsonb('output_payload'),
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('executions_workflow_id_idx').on(table.workflowId),
  index('executions_status_idx').on(table.status),
  index('executions_created_at_idx').on(table.createdAt),
]);

// Таблица выполнения отдельных узлов в рамках запуска
export const nodeExecutions = pgTable('node_executions', {
  id: uuid('id').defaultRandom().primaryKey(),
  executionId: uuid('execution_id').references(() => executions.id, { onDelete: 'cascade' }).notNull(),
  nodeId: text('node_id').notNull(),
  nodeType: text('node_type').notNull(),
  status: text('status', {
    enum: [
      NodeExecutionStatus.PENDING,
      NodeExecutionStatus.RUNNING,
      NodeExecutionStatus.WAITING_FOR_APPROVAL,
      NodeExecutionStatus.SUCCESS,
      NodeExecutionStatus.FAILED,
      NodeExecutionStatus.SKIPPED,
    ],
  }).default(NodeExecutionStatus.PENDING).notNull(),
  inputData: jsonb('input_data'),
  outputData: jsonb('output_data'),
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('node_executions_exec_id_idx').on(table.executionId),
  index('node_executions_node_id_idx').on(table.nodeId),
]);

// Таблица безопасного хранения учетных записей (Credentials)
export const credentials = pgTable('credentials', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  dataEncrypted: text('data_encrypted').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('credentials_user_id_idx').on(table.userId),
]);

// Системные настройки приложения
export const applicationSettings = pgTable('application_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Таблица AI провайдеров (Phase 2 & Addendum)
export const aiProviders = pgTable('ai_providers', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  providerType: text('provider_type').notNull(), // 'openai' | 'gemini' | 'anthropic' | 'ollama' | 'openai-compatible' | 'custom-rest'
  apiProtocol: text('api_protocol').default('openai').notNull(),
  baseUrl: text('base_url'),
  authType: text('auth_type').default('bearer').notNull(),
  apiKeyEncrypted: text('api_key_encrypted'),
  customHeadersEncrypted: text('custom_headers_encrypted'),
  customRequestPath: text('custom_request_path'),
  customResponsePath: text('custom_response_path'),
  customBodyTemplate: jsonb('custom_body_template'),
  defaultModelId: text('default_model_id'),
  availableModels: jsonb('available_models').default([]).notNull(),
  settings: jsonb('settings').default({}).notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  isEnabled: boolean('is_enabled').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ai_providers_user_id_idx').on(table.userId),
]);

// Таблица MCP серверов (Phase 3)
export const mcpServers = pgTable('mcp_servers', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  transport: text('transport', { enum: ['stdio', 'sse', 'http', 'streamable-http'] }).notNull(),
  serverUrl: text('server_url'),
  command: text('command'),
  args: jsonb('args').default([]).notNull(),
  envEncrypted: text('env_encrypted'),
  authType: text('auth_type', { enum: ['none', 'bearer', 'basic', 'custom_header'] }).default('none').notNull(),
  apiKeyEncrypted: text('api_key_encrypted'),
  headersEncrypted: text('headers_encrypted'),
  capabilities: jsonb('capabilities').default({}).notNull(),
  discoveredTools: jsonb('discovered_tools').default([]).notNull(),
  discoveredResources: jsonb('discovered_resources').default([]).notNull(),
  discoveredPrompts: jsonb('discovered_prompts').default([]).notNull(),
  isEnabled: boolean('is_enabled').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('mcp_servers_user_id_idx').on(table.userId),
]);

// Таблица запросов на подтверждение действий человека (Human-in-the-Loop)
export const approvals = pgTable('approvals', {
  id: uuid('id').defaultRandom().primaryKey(),
  executionId: uuid('execution_id').references(() => executions.id, { onDelete: 'cascade' }).notNull(),
  nodeId: text('node_id').notNull(),
  agentId: text('agent_id'),
  toolName: text('tool_name').notNull(),
  toolArguments: jsonb('tool_arguments').default({}).notNull(),
  consequences: text('consequences'),
  actionFingerprint: text('action_fingerprint').notNull(),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).default('pending').notNull(),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('approvals_execution_id_idx').on(table.executionId),
  index('approvals_status_idx').on(table.status),
]);

// Таблица долговременной и контекстной памяти агентов (Agent Memory)
export const agentMemories = pgTable('agent_memories', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  agentId: text('agent_id'),
  workflowId: uuid('workflow_id').references(() => workflows.id, { onDelete: 'cascade' }),
  executionId: uuid('execution_id').references(() => executions.id, { onDelete: 'cascade' }),
  scope: text('scope', { enum: ['execution', 'workflow', 'agent', 'user'] }).notNull(),
  key: text('key').notNull(),
  value: jsonb('value').notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('agent_memories_user_id_idx').on(table.userId),
  index('agent_memories_scope_key_idx').on(table.scope, table.key),
  index('agent_memories_agent_id_idx').on(table.agentId),
]);

// Таблица подробных логов рассуждений и выполнения агентов (ReAct Tracing)
export const agentExecutionLogs = pgTable('agent_execution_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  executionId: uuid('execution_id').references(() => executions.id, { onDelete: 'cascade' }).notNull(),
  nodeId: text('node_id').notNull(),
  agentId: text('agent_id'),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').default({}).notNull(),
  tokensUsed: integer('tokens_used').default(0).notNull(),
  costEstimate: integer('cost_estimate').default(0).notNull(),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('agent_execution_logs_exec_id_idx').on(table.executionId),
  index('agent_execution_logs_node_id_idx').on(table.nodeId),
]);

// Таблица персональных внешних интеграций (Phase 4)
export const integrations = pgTable('integrations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  serviceType: text('service_type', {
    enum: ['telegram', 'discord', 'github', 'filesystem', 'webhook'],
  }).notNull(),
  credentialId: uuid('credential_id').references(() => credentials.id, { onDelete: 'set null' }),
  settings: jsonb('settings').default({}).notNull(),
  status: text('status', {
    enum: ['connected', 'error', 'disconnected'],
  }).default('disconnected').notNull(),
  lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
  lastError: text('last_error'),
  isEnabled: boolean('is_enabled').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('integrations_user_id_idx').on(table.userId),
  index('integrations_service_type_idx').on(table.serviceType),
]);

// Связи Drizzle Relations
export const usersRelations = relations(users, ({ many }) => ({
  workflows: many(workflows),
  credentials: many(credentials),
  aiProviders: many(aiProviders),
  mcpServers: many(mcpServers),
  agentMemories: many(agentMemories),
  integrations: many(integrations),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
  user: one(users, {
    fields: [integrations.userId],
    references: [users.id],
  }),
  credential: one(credentials, {
    fields: [integrations.credentialId],
    references: [credentials.id],
  }),
}));

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  user: one(users, {
    fields: [workflows.userId],
    references: [users.id],
  }),
  versions: many(workflowVersions),
  executions: many(executions),
  agentMemories: many(agentMemories),
}));

export const workflowVersionsRelations = relations(workflowVersions, ({ one }) => ({
  workflow: one(workflows, {
    fields: [workflowVersions.workflowId],
    references: [workflows.id],
  }),
}));

export const executionsRelations = relations(executions, ({ one, many }) => ({
  workflow: one(workflows, {
    fields: [executions.workflowId],
    references: [workflows.id],
  }),
  nodeExecutions: many(nodeExecutions),
  approvals: many(approvals),
  agentExecutionLogs: many(agentExecutionLogs),
}));

export const nodeExecutionsRelations = relations(nodeExecutions, ({ one }) => ({
  execution: one(executions, {
    fields: [nodeExecutions.executionId],
    references: [executions.id],
  }),
}));

export const approvalsRelations = relations(approvals, ({ one }) => ({
  execution: one(executions, {
    fields: [approvals.executionId],
    references: [executions.id],
  }),
  reviewer: one(users, {
    fields: [approvals.reviewedBy],
    references: [users.id],
  }),
}));

export const mcpServersRelations = relations(mcpServers, ({ one }) => ({
  user: one(users, {
    fields: [mcpServers.userId],
    references: [users.id],
  }),
}));

export const agentMemoriesRelations = relations(agentMemories, ({ one }) => ({
  user: one(users, {
    fields: [agentMemories.userId],
    references: [users.id],
  }),
  workflow: one(workflows, {
    fields: [agentMemories.workflowId],
    references: [workflows.id],
  }),
  execution: one(executions, {
    fields: [agentMemories.executionId],
    references: [executions.id],
  }),
}));

export const agentExecutionLogsRelations = relations(agentExecutionLogs, ({ one }) => ({
  execution: one(executions, {
    fields: [agentExecutionLogs.executionId],
    references: [executions.id],
  }),
}));

