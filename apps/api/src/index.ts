import dotenv from 'dotenv';
dotenv.config();

import { buildServer } from './server.js';
import { runMigrations } from '@neuroflow/database';

async function main() {
  try {
    console.log('[NeuroFlow API] Инициализация базы данных и запуск миграций...');
    await runMigrations();
    console.log('[NeuroFlow API] База данных готова.');

    const server = await buildServer();
    const port = Number(process.env.PORT || 4000);
    const host = process.env.HOST || '0.0.0.0';

    await server.listen({ port, host });
    console.log(`[NeuroFlow API] Сервер успешно запущен на http://${host}:${port}`);
    console.log(`[NeuroFlow API] OpenAPI Документация доступна по адресу http://${host}:${port}/documentation`);
  } catch (err) {
    console.error('[NeuroFlow API] Критическая ошибка при запуске:', err);
    process.exit(1);
  }
}

main();
