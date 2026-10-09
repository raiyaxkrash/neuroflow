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

// Связи Drizzle Relations
export const usersRelations = relations(users, ({ many }) => ({
  workflows: many(workflows),
  credentials: many(credentials),
}));

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  user: one(users, {
    fields: [workflows.userId],
    references: [users.id],
  }),
  versions: many(workflowVersions),
  executions: many(executions),
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
}));

export const nodeExecutionsRelations = relations(nodeExecutions, ({ one }) => ({
  execution: one(executions, {
    fields: [nodeExecutions.executionId],
    references: [executions.id],
  }),
}));
