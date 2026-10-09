import { FastifyInstance } from 'fastify';
import {
  getDatabase,
  workflows,
  workflowVersions,
  executions,
  users,
  eq,
  desc,
} from '@neuroflow/database';
import {
  CreateWorkflowSchema,
  UpdateWorkflowSchema,
  ExecuteWorkflowSchema,
  WorkflowGraphSchema,
  ExecutionStatus,
  WorkflowTriggerType,
  WORKFLOW_TEMPLATES,
} from '@neuroflow/shared';
import { WorkflowValidator, getWorkflowQueue } from '@neuroflow/workflow-engine';

export async function workflowRoutes(fastify: FastifyInstance) {
  // Аутентификация пользователя (JWT) с fallback на дефолтного пользователя
  const authenticate = async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch {
      // Для быстрого локального запуска fallback на админа
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

  // Валидация произвольного графа
  fastify.post('/validate', {
    schema: {
      tags: ['Workflows'],
      summary: 'Валидация графа воркфлоу на корректность структуры и ацикличность',
    },
  }, async (request, reply) => {
    const parseResult = WorkflowGraphSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        valid: false,
        errors: parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        warnings: [],
      });
    }

    const validation = WorkflowValidator.validate(parseResult.data);
    return reply.send(validation);
  });

  // Список всех воркфлоу
  fastify.get('/', {
    schema: {
      tags: ['Workflows'],
      summary: 'Получение списка воркфлоу',
    },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const db = getDatabase();
    const list = await db
      .select()
      .from(workflows)
      .where(eq(workflows.userId, request.user.id))
      .orderBy(desc(workflows.updatedAt));

    return reply.send({
      workflows: list,
      total: list.length,
    });
  });

  // Создание нового воркфлоу
  fastify.post('/', {
    schema: {
      tags: ['Workflows'],
      summary: 'Создание нового воркфлоу',
    },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const parseResult = CreateWorkflowSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parseResult.error.errors,
      });
    }

    const { name, description, graph, settings } = parseResult.data;
    const initialGraph = graph || {
      nodes: [
        {
          id: 'node-trigger-1',
          type: 'manual-trigger',
          position: { x: 100, y: 150 },
          data: {
            label: 'Manual Trigger',
            type: 'manual-trigger',
            parameters: {},
          },
        },
      ],
      edges: [],
    };

    const db = getDatabase();
    const [wf] = await db.insert(workflows).values({
      userId: request.user.id,
      name,
      description: description || null,
      isActive: true,
      version: 1,
      graph: initialGraph,
      settings: settings || {},
    }).returning();

    // Сохранение первой версии
    await db.insert(workflowVersions).values({
      workflowId: wf.id,
      version: 1,
      graph: initialGraph,
      settings: settings || {},
    });

    return reply.status(201).send(wf);
  });

  // Получение воркфлоу по ID
  fastify.get('/:id', {
    schema: {
      tags: ['Workflows'],
      summary: 'Получение конкретного воркфлоу по ID',
    },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { id } = request.params;
    const db = getDatabase();

    const [wf] = await db.select().from(workflows).where(eq(workflows.id, id)).limit(1);
    if (!wf) {
      return reply.status(404).send({ error: 'Воркфлоу не найден' });
    }

    return reply.send(wf);
  });

  // Обновление / автосохранение воркфлоу
  fastify.put('/:id', {
    schema: {
      tags: ['Workflows'],
      summary: 'Обновление и сохранение графа воркфлоу',
    },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { id } = request.params;
    const parseResult = UpdateWorkflowSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parseResult.error.errors,
      });
    }

    const db = getDatabase();
    const [existing] = await db.select().from(workflows).where(eq(workflows.id, id)).limit(1);
    if (!existing) {
      return reply.status(404).send({ error: 'Воркфлоу не найден' });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (parseResult.data.name !== undefined) updateData.name = parseResult.data.name;
    if (parseResult.data.description !== undefined) updateData.description = parseResult.data.description;
    if (parseResult.data.isActive !== undefined) updateData.isActive = parseResult.data.isActive;
    if (parseResult.data.settings !== undefined) updateData.settings = parseResult.data.settings;

    if (parseResult.data.graph !== undefined) {
      updateData.graph = parseResult.data.graph;
      updateData.version = existing.version + 1;

      // Запись новой версии
      await db.insert(workflowVersions).values({
        workflowId: existing.id,
        version: updateData.version,
        graph: parseResult.data.graph,
        settings: updateData.settings || existing.settings,
      });
    }

    const [updated] = await db.update(workflows).set(updateData).where(eq(workflows.id, id)).returning();
    return reply.send(updated);
  });

  // Удаление воркфлоу
  fastify.delete('/:id', {
    schema: {
      tags: ['Workflows'],
      summary: 'Удаление воркфлоу',
    },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { id } = request.params;
    const db = getDatabase();

    const [deleted] = await db.delete(workflows).where(eq(workflows.id, id)).returning();
    if (!deleted) {
      return reply.status(404).send({ error: 'Воркфлоу не найден' });
    }

    return reply.send({ success: true, message: 'Воркфлоу успешно удален' });
  });

  // Запуск воркфлоу (Execute)
  fastify.post('/:id/execute', {
    schema: {
      tags: ['Workflows'],
      summary: 'Ручной запуск выполнения воркфлоу',
    },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { id } = request.params;
    const bodyResult = ExecuteWorkflowSchema.safeParse(request.body || {});
    const executionInput = bodyResult.success ? bodyResult.data : { payload: {} };

    const db = getDatabase();
    const [wf] = await db.select().from(workflows).where(eq(workflows.id, id)).limit(1);
    if (!wf) {
      return reply.status(404).send({ error: 'Воркфлоу не найден' });
    }

    const graph = wf.graph as any;

    // Валидация перед запуском
    const validation = WorkflowValidator.validate(graph);
    if (!validation.valid) {
      return reply.status(400).send({
        error: 'Невозможно запустить некорректный воркфлоу',
        validationErrors: validation.errors,
      });
    }

    // Создание записи выполнения со статусом PENDING
    const [executionRecord] = await db.insert(executions).values({
      workflowId: wf.id,
      workflowVersion: wf.version,
      status: ExecutionStatus.PENDING,
      triggerType: WorkflowTriggerType.MANUAL,
      inputPayload: executionInput.payload || {},
      startedAt: new Date(),
    }).returning();

    // Отправка в очередь выполнения
    const queue = getWorkflowQueue();
    await queue.addJob({
      executionId: executionRecord.id,
      workflowId: wf.id,
      graph,
      initialPayload: executionInput.payload || {},
      triggerNodeId: executionInput.triggerNodeId,
    });

    return reply.status(202).send({
      executionId: executionRecord.id,
      status: ExecutionStatus.PENDING,
      workflowId: wf.id,
      version: wf.version,
      message: 'Запуск воркфлоу поставлен в очередь выполнения',
    });
  });

  // Список встроенных готовых шаблонов (Templates)
  fastify.get('/templates', {
    schema: {
      tags: ['Workflows'],
      summary: 'Каталог готовых проверенных шаблонов автоматизаций',
    },
  }, async (_request, reply) => {
    return reply.send(WORKFLOW_TEMPLATES);
  });

  // Создание воркфлоу из шаблона
  fastify.post('/templates/:templateId/instantiate', {
    schema: {
      tags: ['Workflows'],
      summary: 'Создание нового воркфлоу на основе выбранного шаблона',
    },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { templateId } = request.params;
    const template = WORKFLOW_TEMPLATES.find((t) => t.id === templateId);

    if (!template) {
      return reply.status(404).send({ error: 'Шаблон не найден' });
    }

    const db = getDatabase();
    const [created] = await db
      .insert(workflows)
      .values({
        userId: request.user.id,
        name: template.name,
        description: template.description,
        graph: template.graph,
        isActive: true,
        version: 1,
      })
      .returning();

    // Запись версии 1
    await db.insert(workflowVersions).values({
      workflowId: created.id,
      version: 1,
      graph: template.graph,
      settings: {},
    });

    return reply.status(201).send(created);
  });

  // Экспорт схемы воркфлоу в JSON
  fastify.get('/:id/export', {
    schema: {
      tags: ['Workflows'],
      summary: 'Экспорт схемы и настроек воркфлоу в JSON',
    },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const { id } = request.params;
    const db = getDatabase();

    const [wf] = await db.select().from(workflows).where(eq(workflows.id, id)).limit(1);
    if (!wf) {
      return reply.status(404).send({ error: 'Воркфлоу не найден' });
    }

    const exportData = {
      neuroflowSchemaVersion: '1.0',
      exportedAt: new Date().toISOString(),
      name: wf.name,
      description: wf.description,
      version: wf.version,
      graph: wf.graph,
      settings: wf.settings,
    };

    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(wf.name)}.neuroflow.json"`);
    return reply.send(exportData);
  });

  // Импорт схемы воркфлоу из JSON
  fastify.post('/import', {
    schema: {
      tags: ['Workflows'],
      summary: 'Импорт воркфлоу из файла JSON схемы',
    },
    preHandler: authenticate,
  }, async (request: any, reply) => {
    const body = request.body as any;
    if (!body || !body.graph) {
      return reply.status(400).send({ error: 'Некорректный формат файла экспорта. Поле graph обязательно.' });
    }

    const validation = WorkflowValidator.validate(body.graph);
    if (!validation.valid) {
      return reply.status(400).send({
        error: 'Импортируемый граф содержит ошибки валидации',
        validationErrors: validation.errors,
      });
    }

    const db = getDatabase();
    const [imported] = await db
      .insert(workflows)
      .values({
        userId: request.user.id,
        name: body.name ? `${body.name} (Импортирован)` : 'Импортированный воркфлоу',
        description: body.description || 'Импортировано из JSON файла',
        graph: body.graph,
        settings: body.settings || {},
        isActive: true,
        version: 1,
      })
      .returning();

    await db.insert(workflowVersions).values({
      workflowId: imported.id,
      version: 1,
      graph: body.graph,
      settings: body.settings || {},
    });

    return reply.status(201).send(imported);
  });
}
