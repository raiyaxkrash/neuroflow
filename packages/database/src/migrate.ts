import { getDatabase } from './client.js';
import { sql } from 'drizzle-orm';
import crypto from 'node:crypto';
import { hashPasswordSecure, verifyPasswordSecure } from './crypto.js';

export function hashPassword(password: string): string {
  return hashPasswordSecure(password);
}

export function verifyPassword(password: string, hash: string): boolean {
  return verifyPasswordSecure(password, hash);
}

export async function runMigrations() {
  const db = getDatabase();

  const statements = [
    sql`CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    sql`CREATE TABLE IF NOT EXISTS workflows (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      version INTEGER NOT NULL DEFAULT 1,
      graph JSONB NOT NULL,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE INDEX IF NOT EXISTS workflows_user_id_idx ON workflows(user_id)`,
    sql`CREATE INDEX IF NOT EXISTS workflows_updated_at_idx ON workflows(updated_at)`,

    sql`CREATE TABLE IF NOT EXISTS workflow_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      graph JSONB NOT NULL,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE INDEX IF NOT EXISTS workflow_versions_wf_ver_idx ON workflow_versions(workflow_id, version)`,

    sql`CREATE TABLE IF NOT EXISTS executions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      workflow_version INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      trigger_type TEXT NOT NULL DEFAULT 'manual',
      input_payload JSONB,
      output_payload JSONB,
      error TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ,
      duration_ms INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE INDEX IF NOT EXISTS executions_workflow_id_idx ON executions(workflow_id)`,
    sql`CREATE INDEX IF NOT EXISTS executions_status_idx ON executions(status)`,
    sql`CREATE INDEX IF NOT EXISTS executions_created_at_idx ON executions(created_at)`,

    sql`CREATE TABLE IF NOT EXISTS node_executions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
      node_id TEXT NOT NULL,
      node_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      input_data JSONB,
      output_data JSONB,
      error TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ,
      duration_ms INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE INDEX IF NOT EXISTS node_executions_exec_id_idx ON node_executions(execution_id)`,
    sql`CREATE INDEX IF NOT EXISTS node_executions_node_id_idx ON node_executions(node_id)`,

    sql`CREATE TABLE IF NOT EXISTS credentials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      data_encrypted TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE INDEX IF NOT EXISTS credentials_user_id_idx ON credentials(user_id)`,

    sql`CREATE TABLE IF NOT EXISTS application_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    sql`CREATE TABLE IF NOT EXISTS ai_providers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      provider_type TEXT NOT NULL,
      api_protocol TEXT NOT NULL DEFAULT 'openai',
      base_url TEXT,
      auth_type TEXT NOT NULL DEFAULT 'bearer',
      api_key_encrypted TEXT,
      custom_headers_encrypted TEXT,
      custom_request_path TEXT,
      custom_response_path TEXT,
      custom_body_template JSONB,
      default_model_id TEXT,
      available_models JSONB NOT NULL DEFAULT '[]'::jsonb,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE INDEX IF NOT EXISTS ai_providers_user_id_idx ON ai_providers(user_id)`,

    sql`CREATE TABLE IF NOT EXISTS mcp_servers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      transport TEXT NOT NULL,
      server_url TEXT,
      command TEXT,
      args JSONB NOT NULL DEFAULT '[]'::jsonb,
      env_encrypted TEXT,
      auth_type TEXT NOT NULL DEFAULT 'none',
      api_key_encrypted TEXT,
      headers_encrypted TEXT,
      capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
      discovered_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
      discovered_resources JSONB NOT NULL DEFAULT '[]'::jsonb,
      discovered_prompts JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE INDEX IF NOT EXISTS mcp_servers_user_id_idx ON mcp_servers(user_id)`,

    sql`CREATE TABLE IF NOT EXISTS approvals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
      node_id TEXT NOT NULL,
      agent_id TEXT,
      tool_name TEXT NOT NULL,
      tool_arguments JSONB NOT NULL DEFAULT '{}'::jsonb,
      consequences TEXT,
      action_fingerprint TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMPTZ,
      rejection_reason TEXT,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE INDEX IF NOT EXISTS approvals_execution_id_idx ON approvals(execution_id)`,
    sql`CREATE INDEX IF NOT EXISTS approvals_status_idx ON approvals(status)`,

    sql`CREATE TABLE IF NOT EXISTS agent_memories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      agent_id TEXT,
      workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
      execution_id UUID REFERENCES executions(id) ON DELETE CASCADE,
      scope TEXT NOT NULL,
      key TEXT NOT NULL,
      value JSONB NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE INDEX IF NOT EXISTS agent_memories_user_id_idx ON agent_memories(user_id)`,
    sql`CREATE INDEX IF NOT EXISTS agent_memories_scope_key_idx ON agent_memories(scope, key)`,
    sql`CREATE INDEX IF NOT EXISTS agent_memories_agent_id_idx ON agent_memories(agent_id)`,

    sql`CREATE TABLE IF NOT EXISTS agent_execution_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
      node_id TEXT NOT NULL,
      agent_id TEXT,
      event_type TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      tokens_used INTEGER NOT NULL DEFAULT 0,
      cost_estimate INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE INDEX IF NOT EXISTS agent_execution_logs_exec_id_idx ON agent_execution_logs(execution_id)`,
    sql`CREATE INDEX IF NOT EXISTS agent_execution_logs_node_id_idx ON agent_execution_logs(node_id)`,

    sql`CREATE TABLE IF NOT EXISTS integrations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      service_type TEXT NOT NULL,
      credential_id UUID REFERENCES credentials(id) ON DELETE SET NULL,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'disconnected',
      last_tested_at TIMESTAMPTZ,
      last_error TEXT,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE INDEX IF NOT EXISTS integrations_user_id_idx ON integrations(user_id)`,
    sql`CREATE INDEX IF NOT EXISTS integrations_service_type_idx ON integrations(service_type)`,

    // Phase 5: Second Brain & Knowledge Tables
    sql`CREATE TABLE IF NOT EXISTS knowledge_sources (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      path_or_url TEXT,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'idle',
      last_sync_at TIMESTAMPTZ,
      last_error TEXT,
      item_count INTEGER NOT NULL DEFAULT 0,
      content_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE INDEX IF NOT EXISTS knowledge_sources_user_id_idx ON knowledge_sources(user_id)`,
    sql`CREATE INDEX IF NOT EXISTS knowledge_sources_type_idx ON knowledge_sources(type)`,
    sql`CREATE INDEX IF NOT EXISTS knowledge_sources_status_idx ON knowledge_sources(status)`,

    sql`CREATE TABLE IF NOT EXISTS knowledge_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_id UUID NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      uri TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      content_hash TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      page_count INTEGER NOT NULL DEFAULT 1,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE INDEX IF NOT EXISTS knowledge_documents_source_id_idx ON knowledge_documents(source_id)`,
    sql`CREATE INDEX IF NOT EXISTS knowledge_documents_user_id_idx ON knowledge_documents(user_id)`,
    sql`CREATE INDEX IF NOT EXISTS knowledge_documents_hash_idx ON knowledge_documents(content_hash)`,

    sql`CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
      source_id UUID NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      page_number INTEGER,
      start_char INTEGER,
      end_char INTEGER,
      content_hash TEXT NOT NULL,
      embedding JSONB,
      embedding_model TEXT,
      embedding_dim INTEGER,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE INDEX IF NOT EXISTS knowledge_chunks_doc_id_idx ON knowledge_chunks(document_id)`,
    sql`CREATE INDEX IF NOT EXISTS knowledge_chunks_source_id_idx ON knowledge_chunks(source_id)`,
    sql`CREATE INDEX IF NOT EXISTS knowledge_chunks_hash_idx ON knowledge_chunks(content_hash)`,

    sql`CREATE TABLE IF NOT EXISTS knowledge_entities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source_id UUID REFERENCES knowledge_sources(id) ON DELETE SET NULL,
      document_id UUID REFERENCES knowledge_documents(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE INDEX IF NOT EXISTS knowledge_entities_user_id_idx ON knowledge_entities(user_id)`,
    sql`CREATE INDEX IF NOT EXISTS knowledge_entities_type_idx ON knowledge_entities(type)`,
    sql`CREATE INDEX IF NOT EXISTS knowledge_entities_name_idx ON knowledge_entities(name)`,

    sql`CREATE TABLE IF NOT EXISTS knowledge_relations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      from_entity_id UUID NOT NULL REFERENCES knowledge_entities(id) ON DELETE CASCADE,
      to_entity_id UUID NOT NULL REFERENCES knowledge_entities(id) ON DELETE CASCADE,
      relation_type TEXT NOT NULL,
      confidence INTEGER NOT NULL DEFAULT 100,
      provenance TEXT,
      status TEXT NOT NULL DEFAULT 'suggested',
      verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE INDEX IF NOT EXISTS knowledge_relations_user_id_idx ON knowledge_relations(user_id)`,
    sql`CREATE INDEX IF NOT EXISTS knowledge_relations_from_to_idx ON knowledge_relations(from_entity_id, to_entity_id)`,
    sql`CREATE INDEX IF NOT EXISTS knowledge_relations_status_idx ON knowledge_relations(status)`,

    sql`CREATE TABLE IF NOT EXISTS token_usages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_id TEXT,
      model TEXT NOT NULL,
      agent_id TEXT,
      workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
      execution_id UUID REFERENCES executions(id) ON DELETE SET NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cached_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      estimated_cost_micros INTEGER NOT NULL DEFAULT 0,
      is_estimated BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE INDEX IF NOT EXISTS token_usages_user_id_idx ON token_usages(user_id)`,
    sql`CREATE INDEX IF NOT EXISTS token_usages_created_at_idx ON token_usages(created_at)`,
    sql`CREATE INDEX IF NOT EXISTS token_usages_model_idx ON token_usages(model)`,

    // Расширение agent_memories
    sql`ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS confidence INTEGER DEFAULT 100`,
    sql`ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE`,
    sql`ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS provenance TEXT`,

    // Phase 7: Autonomous Mission Engine Tables
    sql`CREATE TABLE IF NOT EXISTS missions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      goal TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      plan JSONB NOT NULL DEFAULT '{}'::jsonb,
      assigned_agents JSONB NOT NULL DEFAULT '[]'::jsonb,
      allowed_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
      token_budget INTEGER NOT NULL DEFAULT 50000,
      tokens_used INTEGER NOT NULL DEFAULT 0,
      cost_budget INTEGER NOT NULL DEFAULT 0,
      cost_estimated INTEGER NOT NULL DEFAULT 0,
      deadline TIMESTAMPTZ,
      final_result JSONB,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE INDEX IF NOT EXISTS missions_user_id_idx ON missions(user_id)`,
    sql`CREATE INDEX IF NOT EXISTS missions_status_idx ON missions(status)`,
    sql`CREATE INDEX IF NOT EXISTS missions_created_at_idx ON missions(created_at)`,

    sql`CREATE TABLE IF NOT EXISTS mission_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      task_key TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      assigned_agent TEXT NOT NULL DEFAULT 'General Agent',
      dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'pending',
      input_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      output_data JSONB,
      criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
      verification_result JSONB,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      tokens_used INTEGER NOT NULL DEFAULT 0,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE INDEX IF NOT EXISTS mission_tasks_mission_id_idx ON mission_tasks(mission_id)`,
    sql`CREATE INDEX IF NOT EXISTS mission_tasks_task_key_idx ON mission_tasks(mission_id, task_key)`,
    sql`CREATE INDEX IF NOT EXISTS mission_tasks_status_idx ON mission_tasks(status)`,

    sql`CREATE TABLE IF NOT EXISTS mission_checkpoints (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      task_id UUID REFERENCES mission_tasks(id) ON DELETE SET NULL,
      checkpoint_type TEXT NOT NULL,
      state_snapshot JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE INDEX IF NOT EXISTS mission_checkpoints_mission_id_idx ON mission_checkpoints(mission_id)`,
    sql`CREATE INDEX IF NOT EXISTS mission_checkpoints_created_at_idx ON mission_checkpoints(created_at)`,

    sql`CREATE TABLE IF NOT EXISTS mission_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      task_id UUID REFERENCES mission_tasks(id) ON DELETE CASCADE,
      agent_id TEXT,
      level TEXT NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE INDEX IF NOT EXISTS mission_logs_mission_id_idx ON mission_logs(mission_id)`,
    sql`CREATE INDEX IF NOT EXISTS mission_logs_created_at_idx ON mission_logs(created_at)`,
  ];

  for (const stmt of statements) {
    await db.execute(stmt);
  }

  // Создание администратора по умолчанию, если отсутствует
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@neuroflow.local';
  let adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    if (process.env.NODE_ENV === 'production') {
      // В production НЕ используем слабый захардкоженный пароль
      adminPassword = crypto.randomBytes(16).toString('hex');
      console.warn(`[SECURITY WARNING] ВНИМАНИЕ: Сгенерирован защищенный пароль администратора для ${adminEmail}: ${adminPassword}`);
      console.warn(`[SECURITY WARNING] Сохраните этот пароль и измените его после первого входа.`);
    } else {
      adminPassword = 'adminneuroflow';
    }
  }

  const passwordHash = hashPasswordSecure(adminPassword);

  const existing = await db.execute(sql`
    SELECT id FROM users WHERE email = ${adminEmail} LIMIT 1
  `);

  const rows = existing?.rows || existing;
  if (!rows || rows.length === 0) {
    await db.execute(sql`
      INSERT INTO users (email, password_hash, name, role)
      VALUES (${adminEmail}, ${passwordHash}, 'NeuroFlow Administrator', 'admin')
    `);
  }
}

export * from './client.js';
export * from './schema.js';
