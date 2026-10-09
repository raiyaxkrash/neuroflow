import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getDatabase,
  workflows,
  executions,
  eq,
} from '@neuroflow/database';
import {
  ExecutionStatus,
  WorkflowTriggerType,
  WorkflowGraph,
} from '@neuroflow/shared';
import { getWorkflowQueue } from '@neuroflow/workflow-engine';
import crypto from 'node:crypto';

export async function webhookRoutes(fastify: FastifyInstance) {
  // Универсальный эндпоинт приема Webhook (GET / POST)
  fastify.route({
    method: ['GET', 'POST', 'PUT', 'PATCH'],
    url: '/:token',
    schema: {
      tags: ['Webhooks'],
      summary: 'Универсальный эндпоинт приема внешних Webhook запросов',
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { token } = request.params as { token: string };
      const db = getDatabase();

      // Ищем активный воркфлоу, у которого в узле webhook-trigger указан данный token, либо token равен id workflow/узла
      const activeWorkflows = await db.select().from(workflows).where(eq(workflows.isActive, true));
      let matchedWorkflow: any = null;
      let matchedNode: any = null;

      for (const wf of activeWorkflows) {
        const graph = wf.graph as WorkflowGraph;
        if (!graph || !Array.isArray(graph.nodes)) continue;

        for (const node of graph.nodes) {
          if (node.type === 'webhook-trigger') {
            const params = node.data?.parameters || {};
            if (params.webhookToken === token || node.id === token || wf.id === token) {
              matchedWorkflow = wf;
              matchedNode = node;
              break;
            }
          }
        }
        if (matchedWorkflow) break;
      }

      if (!matchedWorkflow || !matchedNode) {
        return reply.status(404).send({
          error: 'Webhook endpoint not found or workflow is inactive',
        });
      }

      const params = matchedNode.data?.parameters || {};
      const method = request.method.toUpperCase();
      const expectedMethod = (params.httpMethod || 'POST').toUpperCase();

      if (expectedMethod !== 'ANY' && method !== expectedMethod) {
        return reply.status(405).send({
          error: `HTTP Method ${method} is not allowed. Expected: ${expectedMethod}`,
        });
      }

      // Проверка авторизации
      if (params.authType === 'bearer' && params.authSecret) {
        const authHeader = (request.headers['authorization'] || '') as string;
        const incomingToken = authHeader.replace(/^Bearer\s+/i, '').trim();
        if (incomingToken !== params.authSecret) {
          return reply.status(401).send({ error: 'Unauthorized: Invalid Bearer token' });
        }
      } else if (params.authType === 'hmac' && params.authSecret) {
        const headerName = (params.hmacHeader || 'x-signature').toLowerCase();
        const signature = request.headers[headerName] as string;
        const rawPayload = typeof request.body === 'string'
          ? request.body
          : JSON.stringify(request.body || {});

        if (!signature) {
          return reply.status(401).send({ error: `Missing required signature header "${headerName}"` });
        }

        const hmac = crypto.createHmac('sha256', params.authSecret);
        hmac.update(rawPayload);
        const calculated = hmac.digest('hex');

        if (signature !== calculated && signature !== `sha256=${calculated}`) {
          return reply.status(401).send({ error: 'Invalid HMAC signature' });
        }
      }

      const executionId = crypto.randomUUID();
      const initialPayload = {
        method,
        headers: request.headers,
        query: request.query || {},
        body: request.body || {},
        ip: request.ip,
        receivedAt: new Date().toISOString(),
      };

      // Создаем запись выполнения
      await db.insert(executions).values({
        id: executionId,
        workflowId: matchedWorkflow.id,
        workflowVersion: matchedWorkflow.version,
        status: ExecutionStatus.PENDING,
        triggerType: WorkflowTriggerType.WEBHOOK,
        inputPayload: initialPayload,
        startedAt: new Date(),
      });

      // Ставим в очередь исполнения
      const queue = getWorkflowQueue();
      await queue.addJob({
        executionId,
        workflowId: matchedWorkflow.id,
        graph: matchedWorkflow.graph as WorkflowGraph,
        initialPayload,
        triggerNodeId: matchedNode.id,
      });

      const responseStatus = params.responseStatus || 200;
      const customResponse = params.customResponse || {
        success: true,
        executionId,
        message: 'Webhook received and workflow enqueued',
      };

      return reply.status(responseStatus).send(customResponse);
    },
  });
}
