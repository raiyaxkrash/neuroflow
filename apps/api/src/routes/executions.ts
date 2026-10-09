import { FastifyInstance } from 'fastify';
import {
  getDatabase,
  executions,
  nodeExecutions,
  workflows,
} from '@neuroflow/database';
import { ExecutionStatus } from '@neuroflow/shared';
import { getWorkflowQueue } from '@neuroflow/workflow-engine';
import { eq, desc } from 'drizzle-orm';

export async function executionRoutes(fastify: FastifyInstance) {
  // Список истории запусков
  fastify.get('/', {
    schema: {
      tags: ['Executions'],
      summary: 'Список истории выполнений с метаданными',
    },
  }, async (request: any, reply) => {
    const { workflowId, limit = 50 } = request.query || {};
    const db = getDatabase();

    let query = db.select({
      id: executions.id,
      workflowId: executions.workflowId,
      workflowVersion: executions.workflowVersion,
      status: executions.status,
      triggerType: executions.triggerType,
      startedAt: executions.startedAt,
      finishedAt: executions.finishedAt,
      durationMs: executions.durationMs,
      error: executions.error,
      createdAt: executions.createdAt,
    }).from(executions);

    if (workflowId) {
      query = query.where(eq(executions.workflowId, workflowId));
    }

    const list = await query.orderBy(desc(executions.createdAt)).limit(Number(limit));
    return reply.send({
      executions: list,
      total: list.length,
    });
  });

  // Получение детального статуса выполнения по ID
  fastify.get('/:id', {
    schema: {
      tags: ['Executions'],
      summary: 'Детали запуска и результаты выполнения отдельных узлов',
    },
  }, async (request: any, reply) => {
    const { id } = request.params;
    const db = getDatabase();

    const [execution] = await db.select().from(executions).where(eq(executions.id, id)).limit(1);
    if (!execution) {
      return reply.status(404).send({ error: 'Запуск не найден' });
    }

    const nodes = await db
      .select()
      .from(nodeExecutions)
      .where(eq(nodeExecutions.executionId, id))
      .orderBy(nodeExecutions.startedAt);

    return reply.send({
      ...execution,
      nodeExecutions: nodes,
    });
  });

  // Отмена выполнения
  fastify.post('/:id/cancel', {
    schema: {
      tags: ['Executions'],
      summary: 'Отмена активного выполнения воркфлоу',
    },
  }, async (request: any, reply) => {
    const { id } = request.params;
    const db = getDatabase();

    const [execution] = await db.select().from(executions).where(eq(executions.id, id)).limit(1);
    if (!execution) {
      return reply.status(404).send({ error: 'Запуск не найден' });
    }

    if (execution.status !== ExecutionStatus.RUNNING && execution.status !== ExecutionStatus.PENDING) {
      return reply.status(400).send({ error: `Нельзя отменить запуск в статусе "${execution.status}"` });
    }

    const queue = getWorkflowQueue();
    const cancelled = await queue.cancelJob(id);

    await db.update(executions).set({
      status: ExecutionStatus.CANCELLED,
      error: 'Выполнение отменено пользователем',
      finishedAt: new Date(),
    }).where(eq(executions.id, id));

    return reply.send({
      success: true,
      cancelled,
      message: 'Выполнение воркфлоу успешно отменено',
    });
  });

  // SSE Stream для живого отображения статуса в браузере
  fastify.get('/:id/stream', {
    schema: {
      tags: ['Executions'],
      summary: 'Server-Sent Events (SSE) поток обновления статуса выполнения в реальном времени',
    },
  }, async (request: any, reply) => {
    const { id } = request.params;
    const queue = getWorkflowQueue();

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.flushHeaders?.();

    const sendEvent = (event: string, data: any) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Отправляем текущее состояние
    const db = getDatabase();
    const [current] = await db.select().from(executions).where(eq(executions.id, id)).limit(1);
    if (current) {
      sendEvent('state', current);
    }

    const listener = (event: { type: string; executionId: string; payload: any }) => {
      if (event.executionId === id) {
        sendEvent(event.type, event.payload);
        if (event.type === 'execution:complete') {
          reply.raw.end();
        }
      }
    };

    queue.onEvent(listener);

    request.raw.on('close', () => {
      // Клиент отключился
    });
  });
}
