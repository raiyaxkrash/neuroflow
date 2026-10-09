import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import postgres from 'postgres';
import { PGlite } from '@electric-sql/pglite';
import * as schema from './schema.js';
import path from 'node:path';
import fs from 'node:fs';

let dbInstance: any = null;
let pgliteInstance: PGlite | null = null;
let postgresClient: any = null;

export function getDatabase() {
  if (dbInstance) {
    return dbInstance;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))) {
    // Подключение к внешнему PostgreSQL (например в Docker или облаке)
    postgresClient = postgres(databaseUrl, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    dbInstance = drizzlePg(postgresClient, { schema });
  } else {
    // Встроенный WebAssembly PostgreSQL (zero setup для локальной разработки)
    const storageDir = process.env.PGLITE_DIR || path.resolve(process.cwd(), '.data', 'neuroflow_pg');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    pgliteInstance = new PGlite(storageDir);
    dbInstance = drizzlePglite(pgliteInstance, { schema });
  }

  return dbInstance;
}

export async function closeDatabase() {
  if (postgresClient) {
    await postgresClient.end();
    postgresClient = null;
  }
  if (pgliteInstance) {
    await pgliteInstance.close();
    pgliteInstance = null;
  }
  dbInstance = null;
}

export { schema };
