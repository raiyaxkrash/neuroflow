export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  WAITING_FOR_APPROVAL = 'waiting_for_approval',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  SKIPPED = 'skipped',
}

export enum NodeExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  WAITING_FOR_APPROVAL = 'waiting_for_approval',
  SUCCESS = 'success',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export enum WorkflowTriggerType {
  MANUAL = 'manual',
  WEBHOOK = 'webhook',
  SCHEDULE = 'schedule',
  EVENT = 'event',
}

export enum NodeCategory {
  TRIGGER = 'trigger',
  ACTION = 'action',
  LOGIC = 'logic',
  DATA = 'data',
  UTILITY = 'utility',
  AI = 'ai',
  AGENT = 'agent',
  INTEGRATION = 'integration',
  TELEGRAM = 'telegram',
  GITHUB = 'github',
  DISCORD = 'discord',
  FILESYSTEM = 'filesystem',
  KNOWLEDGE = 'knowledge',
  BROWSER = 'browser',
  DESKTOP = 'desktop',
}

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  HEAD = 'HEAD',
}

export enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  IS_EMPTY = 'is_empty',
  IS_NOT_EMPTY = 'is_not_empty',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
}
