import dotenv from 'dotenv';
dotenv.config();

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { WorkflowExecutor } from '@neuroflow/workflow-engine';
import { WorkflowExecutionJobData } from '@neuroflow/workflow-engine';
import { runMigrations } from '@neuroflow/database';

async function startWorker() {
  console.log('[NeuroFlow Worker] Запуск воркера автоматизаций...');
  await runMigrations();

  const redisUrl = process.env.REDIS_URL?.trim();
  const concurrency = Number(process.env.WORKER_CONCURRENCY || 5);

  if (redisUrl && (redisUrl.startsWith('redis://') || redisUrl.startsWith('rediss://'))) {
    console.log(`[NeuroFlow Worker] Подключение к Redis по адресу: ${redisUrl}`);
    const redisConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });

    const worker = new Worker<WorkflowExecutionJobData>(
      'neuroflow-executions',
      async (job: Job<WorkflowExecutionJobData>) => {
        console.log(`[NeuroFlow Worker] Взята задача на выполнение: ${job.id} (Workflow: ${job.data.workflowId})`);
        const result = await WorkflowExecutor.execute({
          executionId: job.data.executionId,
          workflowId: job.data.workflowId,
          graph: job.data.graph,
          initialPayload: job.data.initialPayload,
          triggerNodeId: job.data.triggerNodeId,
          saveToDatabase: true,
        });
        console.log(`[NeuroFlow Worker] Задача ${job.id} завершена со статусом: ${result.status} (${result.durationMs}ms)`);
        return result;
      },
      {
        connection: redisConnection,
        concurrency,
      }
    );

    worker.on('failed', (job, err) => {
      console.error(`[NeuroFlow Worker] Ошибка выполнения задачи ${job?.id}:`, err);
    });

    console.log(`[NeuroFlow Worker] BullMQ воркер активен (Параллельность: ${concurrency})`);
  } else {
    console.log('[NeuroFlow Worker] REDIS_URL не задан. Воркер ожидает внешних задач либо запуск обрабатывается встроенным in-process движком API.');
  }
}

startWorker().catch((err) => {
  console.error('[NeuroFlow Worker] Фатальная ошибка воркера:', err);
  process.exit(1);
});
