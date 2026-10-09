import { FastifyInstance } from 'fastify';
import { DesktopCompanionService } from '@neuroflow/nodes';
import { getDatabase, users, eq } from '@neuroflow/database';

export async function desktopRoutes(fastify: FastifyInstance) {
  const authenticate = async (request: any, reply: any) => {
    // Поддерживаем как Bearer токен Companion API, так и стандартный JWT пользователя
    const authHeader = request.headers.authorization;
    const companion = DesktopCompanionService.getInstance();

    if (authHeader && companion.verifyToken(authHeader)) {
      return; // Успешно авторизован через COMPANION_API_KEY
    }

    try {
      await request.jwtVerify();
    } catch {
      const db = getDatabase();
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@neuroflow.local';
      const [admin] = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
      if (admin) {
        request.user = { id: admin.id, email: admin.email, role: admin.role };
      } else {
        return reply.status(401).send({ error: 'Unauthorized: invalid token' });
      }
    }
  };

  // 1. Статус Companion Service
  fastify.get('/status', {
    schema: { tags: ['Desktop'], summary: 'Статус Desktop Companion Service' },
    preHandler: authenticate,
  }, async (_request, reply) => {
    const companion = DesktopCompanionService.getInstance();
    return reply.send(companion.getStatus());
  });

  // 2. Список открытых окон из whitelist
  fastify.get('/windows', {
    schema: { tags: ['Desktop'], summary: 'Список окон разрешенных приложений' },
    preHandler: authenticate,
  }, async (_request, reply) => {
    const companion = DesktopCompanionService.getInstance();
    const windows = await companion.listWindows();
    return reply.send({ windows, total: windows.length });
  });

  // 3. Фокусировка окна
  fastify.post('/focus', {
    schema: { tags: ['Desktop'], summary: 'Активация окна разрешенного процесса' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { processName } = request.body || {};
    if (!processName) {
      return reply.status(400).send({ error: 'Не указан processName' });
    }

    const companion = DesktopCompanionService.getInstance();
    try {
      const result = await companion.focusWindow(processName);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 4. Безопасная отправка нажатий клавиш в разрешенное окно
  fastify.post('/send-keys', {
    schema: { tags: ['Desktop'], summary: 'Отправка нажатий клавиш в разрешенное окно' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { processName, keys } = request.body || {};
    if (!processName || !keys) {
      return reply.status(400).send({ error: 'Требуются параметры processName и keys' });
    }

    const companion = DesktopCompanionService.getInstance();
    try {
      const result = await companion.sendKeys(processName, keys);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
}
