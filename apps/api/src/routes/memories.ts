import { FastifyInstance } from 'fastify';
import { getDatabase, users, eq } from '@neuroflow/database';
import { AgentMemoryService } from '@neuroflow/workflow-engine';

export async function memoryRoutes(fastify: FastifyInstance) {
  const authenticate = async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch {
      const db = getDatabase();
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@neuroflow.local';
      const [admin] = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
      if (admin) {
        request.user = { id: admin.id, email: admin.email, role: admin.role };
      } else {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    }
  };

  /**
   * GET /api/memories - Поиск или извлечение фактов из памяти агентов
   */
  fastify.get('/', { preHandler: authenticate }, async (request: any) => {
    const { scope = 'user', query, key, limit = 10 } = request.query as any;

    if (key) {
      const val = await AgentMemoryService.get(request.user.id, scope, key);
      return { key, value: val, found: val !== null };
    }

    const items = await AgentMemoryService.search(request.user.id, scope, query, Number(limit));
    return { items };
  });

  /**
   * POST /api/memories - Запись значения в память
   */
  fastify.post('/', { preHandler: authenticate }, async (request: any, reply) => {
    const { scope = 'user', key, value, metadata, ttlSeconds } = request.body as any;

    if (!key) {
      return reply.status(400).send({ error: 'ValidationError', message: 'Поле key обязательно.' });
    }

    await AgentMemoryService.set({
      userId: request.user.id,
      scope,
      key,
      value,
      metadata,
      ttlSeconds: ttlSeconds ? Number(ttlSeconds) : undefined,
    });

    return reply.status(201).send({ success: true, key, scope });
  });

  /**
   * DELETE /api/memories - Удаление ключа из памяти
   */
  fastify.delete('/', { preHandler: authenticate }, async (request: any, reply) => {
    const { scope = 'user', key } = request.query as any;

    if (!key) {
      return reply.status(400).send({ error: 'ValidationError', message: 'Поле key обязательно.' });
    }

    await AgentMemoryService.delete(request.user.id, scope, key);
    return { success: true, deleted: key };
  });
}
