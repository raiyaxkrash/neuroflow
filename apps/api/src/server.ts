import os from 'node:os';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { authRoutes } from './routes/auth.js';
import { nodeRoutes } from './routes/nodes.js';
import { workflowRoutes } from './routes/workflows.js';
import { executionRoutes } from './routes/executions.js';
import { aiRoutes } from './routes/ai.js';
import { mcpRoutes } from './routes/mcp.js';
import { approvalRoutes } from './routes/approvals.js';
import { memoryRoutes } from './routes/memories.js';
import { integrationRoutes } from './routes/integrations.js';
import { webhookRoutes } from './routes/webhooks.js';
import { knowledgeRoutes } from './routes/knowledge.js';
import { browserRoutes } from './routes/browser.js';
import { desktopRoutes } from './routes/desktop.js';
import { missionRoutes } from './routes/missions.js';
import { SchedulerEngine } from '@neuroflow/workflow-engine';

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
    },
    bodyLimit: 10 * 1024 * 1024, // 10MB
  });

  // CORS
  await server.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Helmet (безопасные заголовки с расслаблением для swagger-ui и canvas)
  await server.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  // JWT
  const jwtSecret = process.env.JWT_SECRET || 'neuroflow-super-secure-secret-key-change-in-production-2026';
  await server.register(jwt, {
    secret: jwtSecret,
  });

  // OpenAPI Swagger Documentation
  await server.register(swagger, {
    openapi: {
      info: {
        title: 'NeuroFlow REST API',
        description: 'Next-Gen Self-Hosted Automation Platform & Workflow Engine API',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:4000',
          description: 'Local development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  await server.register(swaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // Healthcheck
  server.get('/healthz', async () => {
    return {
      status: 'ok',
      service: 'neuroflow-api',
      timestamp: new Date().toISOString(),
    };
  });

  // Системные метрики и диагностика для личного сервера
  server.get('/api/system/metrics', async () => {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    return {
      status: 'healthy',
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        uptimeSeconds: Math.floor(process.uptime()),
        cpuCount: os.cpus().length,
        loadAverage: os.loadavg(),
        memory: {
          totalMb: Math.round(totalMem / (1024 * 1024)),
          freeMb: Math.round(freeMem / (1024 * 1024)),
          usedPercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
        },
        processMemory: {
          rssMb: Math.round(memUsage.rss / (1024 * 1024)),
          heapUsedMb: Math.round(memUsage.heapUsed / (1024 * 1024)),
          heapTotalMb: Math.round(memUsage.heapTotal / (1024 * 1024)),
        },
      },
      configuration: {
        workerConcurrency: Number(process.env.WORKER_CONCURRENCY || 5),
        historyRetentionDays: Number(process.env.HISTORY_RETENTION_DAYS || 30),
        hasRedis: !!(process.env.REDIS_URL && (process.env.REDIS_URL.startsWith('redis://') || process.env.REDIS_URL.startsWith('rediss://'))),
      },
      timestamp: new Date().toISOString(),
    };
  });

  // Регистрация маршрутов
  await server.register(authRoutes, { prefix: '/api/auth' });
  await server.register(nodeRoutes, { prefix: '/api/nodes' });
  await server.register(workflowRoutes, { prefix: '/api/workflows' });
  await server.register(executionRoutes, { prefix: '/api/executions' });
  await server.register(aiRoutes, { prefix: '/api/ai' });
  await server.register(mcpRoutes, { prefix: '/api/mcp' });
  await server.register(approvalRoutes, { prefix: '/api/approvals' });
  await server.register(memoryRoutes, { prefix: '/api/memories' });
  await server.register(integrationRoutes, { prefix: '/api/integrations' });
  await server.register(webhookRoutes, { prefix: '/api/webhooks' });
  await server.register(knowledgeRoutes, { prefix: '/api/knowledge' });
  await server.register(browserRoutes, { prefix: '/api/browser' });
  await server.register(desktopRoutes, { prefix: '/api/desktop' });
  await server.register(missionRoutes, { prefix: '/api/missions' });

  // Восстановление активных расписаний из базы данных
  server.addHook('onReady', async () => {
    try {
      const restoredCount = await SchedulerEngine.syncSchedulesFromDatabase();
      if (restoredCount > 0) {
        server.log.info(`[Scheduler] Восстановлено ${restoredCount} активных расписаний из базы данных.`);
      }
    } catch {
      // Игнорируем в тестовом окружении
    }
  });

  // Глобальный error handler
  server.setErrorHandler((error: any, request, reply) => {
    request.log.error(error);
    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      error: error.name || 'InternalServerError',
      message: error.message || 'Произошла непредвиденная ошибка на сервере',
      statusCode,
    });
  });

  return server;
}
