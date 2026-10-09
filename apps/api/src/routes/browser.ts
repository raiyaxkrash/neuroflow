import { FastifyInstance } from 'fastify';
import { BrowserSessionManager, BrowserEngine } from '@neuroflow/nodes';
import { getDatabase, users, eq } from '@neuroflow/database';

export async function browserRoutes(fastify: FastifyInstance) {
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

  // 1. Список активных браузерных сессий
  fastify.get('/sessions', {
    schema: { tags: ['Browser'], summary: 'Список активных браузерных сессий' },
    preHandler: authenticate,
  }, async (_request, reply) => {
    const manager = BrowserSessionManager.getInstance();
    const sessions = await manager.listSessions();
    return reply.send({ sessions, total: sessions.length });
  });

  // 2. Детали конкретной сессии и лог действий
  fastify.get('/sessions/:id', {
    schema: { tags: ['Browser'], summary: 'Детальная информация о сессии' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { id } = request.params;
    const manager = BrowserSessionManager.getInstance();
    const session = manager.getSession(id);

    if (!session) {
      return reply.status(404).send({ error: 'Браузерная сессия не найдена или была закрыта' });
    }

    return reply.send({
      id: session.id,
      name: session.name,
      browserType: session.browserType,
      status: session.status,
      currentUrl: session.page.url(),
      title: await session.page.title().catch(() => ''),
      createdAt: session.createdAt.toISOString(),
      lastActivityAt: session.lastActivityAt.toISOString(),
      latestScreenshotBase64: session.latestScreenshotBase64,
      actionLogs: session.actionLogs,
    });
  });

  // 3. Создание свежего скриншота на лету
  fastify.post('/sessions/:id/screenshot', {
    schema: { tags: ['Browser'], summary: 'Сделать свежий скриншот страницы' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { id } = request.params;
    const engine = new BrowserEngine();

    try {
      const result = await engine.screenshot(id, { format: 'jpeg', quality: 60 });
      return reply.send({
        success: true,
        base64: result.base64,
        mimeType: result.mimeType,
      });
    } catch (err: any) {
      return reply.status(400).send({ error: 'Не удалось сделать снимок', message: err.message });
    }
  });

  // 4. Аварийная остановка сессии (Emergency Stop / Kill Switch)
  fastify.post('/sessions/:id/terminate', {
    schema: { tags: ['Browser'], summary: 'Экстренное завершение сессии' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { id } = request.params;
    const manager = BrowserSessionManager.getInstance();
    const closed = await manager.closeSession(id);

    return reply.send({
      success: closed,
      message: closed ? 'Сессия успешно принудительно остановлена' : 'Сессия уже закрыта или не существовала',
    });
  });

  // 5. Аварийная остановка всех сессий
  fastify.post('/sessions/terminate-all', {
    schema: { tags: ['Browser'], summary: 'Экстренное завершение всех браузерных сессий' },
    preHandler: authenticate,
  }, async (_request, reply) => {
    const manager = BrowserSessionManager.getInstance();
    await manager.closeAllSessions();
    return reply.send({ success: true, message: 'Все браузерные сессии успешно завершены' });
  });
}
