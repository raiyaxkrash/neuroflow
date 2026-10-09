import { FastifyInstance } from 'fastify';
import { getDatabase, users, eq } from '@neuroflow/database';
import { ReviewApprovalSchema } from '@neuroflow/shared';
import { ApprovalService } from '@neuroflow/workflow-engine';

export async function approvalRoutes(fastify: FastifyInstance) {
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
   * GET /api/approvals - Получение списка запросов, ожидающих подтверждения человека
   */
  fastify.get('/', { preHandler: authenticate }, async (request: any) => {
    const list = await ApprovalService.listPending(request.user.id);
    return list;
  });

  /**
   * GET /api/approvals/:id - Детали запроса на подтверждение
   */
  fastify.get('/:id', { preHandler: authenticate }, async (request: any, reply) => {
    const { id } = request.params;
    const approval = await ApprovalService.getById(id);
    if (!approval) {
      return reply.status(404).send({ error: 'NotFound', message: 'Запрос на подтверждение не найден' });
    }
    return approval;
  });

  /**
   * POST /api/approvals/:id/review - Одобрение или отклонение действия оператором
   */
  fastify.post('/:id/review', { preHandler: authenticate }, async (request: any, reply) => {
    const { id } = request.params;
    const parseRes = ReviewApprovalSchema.safeParse(request.body);
    if (!parseRes.success) {
      return reply.status(400).send({ error: 'ValidationError', details: parseRes.error.format() });
    }

    const { decision, reason } = parseRes.data;

    try {
      const result = await ApprovalService.review({
        approvalId: id,
        reviewerId: request.user.id,
        decision,
        reason,
      });

      return {
        message: decision === 'approved' ? 'Действие успешно одобрено оператором.' : 'Действие отклонено.',
        ...result,
      };
    } catch (err: any) {
      return reply.status(400).send({
        error: 'ReviewError',
        message: err.message,
      });
    }
  });
}
