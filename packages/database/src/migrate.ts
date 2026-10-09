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
