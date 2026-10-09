import { FastifyInstance } from 'fastify';
import {
  getDatabase,
  missions,
  missionTasks,
  missionLogs,
  missionCheckpoints,
  users,
  eq,
  desc,
} from '@neuroflow/database';
import {
  CreateMissionSchema,
  MissionActionSchema,
  MissionStatus,
  MissionTaskStatus,
} from '@neuroflow/shared';
import {
  MissionOrchestrator,
  CheckpointService,
} from '@neuroflow/mission-engine';

export async function missionRoutes(fastify: FastifyInstance) {
  const authenticate = async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch {
      const db = getDatabase();
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@neuroflow.local';
      const [admin] = await db
        .select()
        .from(users)
        .where(eq(users.email, adminEmail))
        .limit(1);

      if (admin) {
        request.user = { id: admin.id, email: admin.email, role: admin.role };
      } else {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    }
  };

  // 1. Список миссий
  fastify.get('/', {
    schema: { tags: ['Missions'], summary: 'Получение списка автономных миссий' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const db = getDatabase();
    const userId = request.user.id;

    const allMissions = await db
      .select()
      .from(missions)
      .where(eq(missions.userId, userId))
      .orderBy(desc(missions.createdAt));

    // Обогащаем данными о прогрессе подзадач
    const result = await Promise.all(
      allMissions.map(async (m: any) => {
        const tasks = await db
          .select()
          .from(missionTasks)
          .where(eq(missionTasks.missionId, m.id));

        const total = tasks.length;
        const completed = tasks.filter((t: any) => t.status === MissionTaskStatus.COMPLETED).length;
        const failed = tasks.filter((t: any) => t.status === MissionTaskStatus.FAILED).length;
        const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

        return {
          id: m.id,
          title: m.title,
          goal: m.goal,
          status: m.status,
          progressPercent,
          totalTasks: total,
          completedTasks: completed,
          failedTasks: failed,
          tokensUsed: m.tokensUsed,
          tokenBudget: m.tokenBudget,
          costBudget: m.costBudget,
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString(),
        };
      })
    );

    return reply.send({ missions: result, total: result.length });
  });

  // 2. Создание и планирование новой миссии
  fastify.post('/', {
    schema: { tags: ['Missions'], summary: 'Создание и планирование автономной миссии' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const parseResult = CreateMissionSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Некорректные параметры миссии',
        details: parseResult.error.errors,
      });
    }

    try {
      const created = await MissionOrchestrator.createMission(
        request.user.id,
        parseResult.data
      );

      return reply.status(201).send({
        success: true,
        mission: created,
      });
    } catch (err: any) {
      return reply.status(500).send({
        error: `Ошибка создания миссии: ${err.message}`,
      });
    }
  });

  // 3. Детальная информация о миссии со списком подзадач
  fastify.get('/:id', {
    schema: { tags: ['Missions'], summary: 'Детальная информация о миссии' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const db = getDatabase();
    const { id } = request.params as { id: string };

    const [mission] = await db
      .select()
      .from(missions)
      .where(eq(missions.id, id))
      .limit(1);

    if (!mission) {
      return reply.status(404).send({ error: 'Миссия не найдена' });
    }

    const tasks = await db
      .select()
      .from(missionTasks)
      .where(eq(missionTasks.missionId, id))
      .orderBy(missionTasks.createdAt);

    return reply.send({
      mission,
      tasks,
    });
  });

  // 4. Управление жизненным циклом миссии (Start, Pause, Resume, Cancel, Approve)
  fastify.post('/:id/action', {
    schema: { tags: ['Missions'], summary: 'Управление жизненным циклом миссии' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = MissionActionSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Некорректное действие',
        details: parseResult.error.errors,
      });
    }

    const { action, reason } = parseResult.data;

    try {
      switch (action) {
        case 'start': {
          const res = await MissionOrchestrator.startMission(id);
          return reply.send(res);
        }
        case 'pause': {
          const paused = await MissionOrchestrator.pauseMission(id, reason);
          return reply.send({ success: paused, status: MissionStatus.PAUSED });
        }
        case 'resume': {
          const resumed = await MissionOrchestrator.resumeMission(id);
          return reply.send({ success: resumed, status: MissionStatus.RUNNING });
        }
        case 'cancel': {
          const cancelled = await MissionOrchestrator.cancelMission(id, reason);
          return reply.send({ success: cancelled, status: MissionStatus.CANCELLED });
        }
        case 'approve': {
          const { taskId } = (request.body as any) || {};
          if (!taskId) {
            return reply.status(400).send({ error: 'Для подтверждения требуется указать taskId' });
          }
          const approved = await MissionOrchestrator.approveTask(id, taskId);
          return reply.send({ success: approved, message: 'Действие подтверждено' });
        }
        default:
          return reply.status(400).send({ error: `Неизвестное действие: ${action}` });
      }
    } catch (err: any) {
      return reply.status(500).send({ error: `Ошибка выполнения действия: ${err.message}` });
    }
  });

  // 5. Контрольные точки миссии (Checkpoints)
  fastify.get('/:id/checkpoints', {
    schema: { tags: ['Missions'], summary: 'Список контрольных точек миссии' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { id } = request.params as { id: string };
    const checkpoints = await CheckpointService.listCheckpoints(id);
    return reply.send({ checkpoints, total: checkpoints.length });
  });

  // 6. Логи миссии (Logs)
  fastify.get('/:id/logs', {
    schema: { tags: ['Missions'], summary: 'Журнал событий миссии' },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const db = getDatabase();
    const { id } = request.params as { id: string };

    const logs = await db
      .select()
      .from(missionLogs)
      .where(eq(missionLogs.missionId, id))
      .orderBy(desc(missionLogs.createdAt))
      .limit(100);

    return reply.send({ logs, total: logs.length });
  });
}
