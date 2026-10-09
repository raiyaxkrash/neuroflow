import { FastifyInstance } from 'fastify';
import {
  getDatabase,
  mcpServers,
  users,
  encryptData,
  decryptData,
  maskSecret,
  eq,
  and,
  desc,
} from '@neuroflow/database';
import {
  CreateMCPServerSchema,
  UpdateMCPServerSchema,
  CallMCPToolSchema,
} from '@neuroflow/shared';
import {
  MCPClientPool,
  MCPServerConfig,
  LocalMCPSandbox,
  validateUrlForSSRF,
} from '@neuroflow/nodes';

export async function mcpRoutes(fastify: FastifyInstance) {
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

  const listServersHandler = async (request: any) => {
    const db = getDatabase();
    const rows = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.userId, request.user.id))
      .orderBy(desc(mcpServers.createdAt));

    return rows.map((r: any) => {
      let apiKeyMasked: string | null = null;
      if (r.apiKeyEncrypted) {
        try {
          const plain = decryptData(r.apiKeyEncrypted);
          apiKeyMasked = maskSecret(plain);
        } catch {
          apiKeyMasked = '********';
        }
      }

      return {
        id: r.id,
        name: r.name,
        description: r.description,
        transport: r.transport,
        serverUrl: r.serverUrl,
        command: r.command,
        args: r.args,
        authType: r.authType,
        apiKeyMasked,
        capabilities: r.capabilities,
        discoveredTools: r.discoveredTools,
        discoveredResources: r.discoveredResources,
        discoveredPrompts: r.discoveredPrompts,
        isEnabled: r.isEnabled,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });
  };

  const createServerHandler = async (request: any, reply: any) => {
    const parseRes = CreateMCPServerSchema.safeParse(request.body);
    if (!parseRes.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        details: parseRes.error.format(),
      });
    }

    const data = parseRes.data;

    // Валидация безопасности
    if (data.transport === 'stdio') {
      if (!data.command) {
        return reply.status(400).send({ error: 'ValidationError', message: 'Для stdio транспорта требуется указать команду.' });
      }
      try {
        LocalMCPSandbox.validateCommand(data.command, data.args || []);
      } catch (err: any) {
        return reply.status(400).send({ error: 'SecurityError', message: err.message });
      }
    } else if (data.transport === 'sse' || data.transport === 'http' || (data.transport as string) === 'streamable-http') {
      if (!data.serverUrl) {
        return reply.status(400).send({ error: 'ValidationError', message: 'Для сетевого транспорта требуется указать serverUrl.' });
      }
      try {
        await validateUrlForSSRF(data.serverUrl);
      } catch (err: any) {
        return reply.status(400).send({ error: 'SSRFError', message: err.message });
      }
    }

    const apiKeyEncrypted = data.apiKey ? encryptData(data.apiKey) : null;
    const envEncrypted = data.env ? encryptData(JSON.stringify(data.env)) : null;
    const headersEncrypted = data.customHeaders ? encryptData(JSON.stringify(data.customHeaders)) : null;

    const db = getDatabase();
    const [created] = await db
      .insert(mcpServers)
      .values({
        userId: request.user.id,
        name: data.name,
        description: data.description || null,
        transport: data.transport,
        serverUrl: data.serverUrl || null,
        command: data.command || null,
        args: data.args || [],
        envEncrypted,
        headersEncrypted,
        authType: data.authType || 'none',
        apiKeyEncrypted,
        capabilities: {},
        discoveredTools: [],
        discoveredResources: [],
        discoveredPrompts: [],
        isEnabled: data.isEnabled !== false,
      })
      .returning();

    return reply.status(201).send(created);
  };

  /**
   * GET /api/mcp и GET /api/mcp/servers - Список всех MCP серверов пользователя
   */
  fastify.get('/', { preHandler: authenticate }, listServersHandler);
  fastify.get('/servers', { preHandler: authenticate }, listServersHandler);

  /**
   * POST /api/mcp и POST /api/mcp/servers - Создание нового MCP сервера
   */
  fastify.post('/', { preHandler: authenticate }, createServerHandler);
  fastify.post('/servers', { preHandler: authenticate }, createServerHandler);

  /**
   * POST /api/mcp/servers/:id/test - Проверка связи с сервером и интроспекция возможностей
   */
  fastify.post('/servers/:id/test', { preHandler: authenticate }, async (request: any, reply) => {
    const { id } = request.params;
    const db = getDatabase();

    const [serverRow] = await db
      .select()
      .from(mcpServers)
      .where(and(eq(mcpServers.id, id), eq(mcpServers.userId, request.user.id)))
      .limit(1);

    if (!serverRow) {
      return reply.status(404).send({ error: 'NotFound', message: 'MCP сервер не найден' });
    }

    let env: Record<string, string> | undefined = undefined;
    let apiKey: string | undefined = undefined;
    let headers: Record<string, string> | undefined = undefined;

    if (serverRow.envEncrypted) {
      try {
        env = JSON.parse(decryptData(serverRow.envEncrypted));
      } catch {}
    }
    if (serverRow.apiKeyEncrypted) {
      try {
        apiKey = decryptData(serverRow.apiKeyEncrypted);
      } catch {}
    }
    if (serverRow.headersEncrypted) {
      try {
        headers = JSON.parse(decryptData(serverRow.headersEncrypted));
      } catch {}
    }

    const config: MCPServerConfig = {
      id: serverRow.id,
      name: serverRow.name,
      transport: serverRow.transport as any,
      serverUrl: serverRow.serverUrl,
      command: serverRow.command,
      args: serverRow.args as any,
      env,
      apiKey,
      headers,
      authType: serverRow.authType as any,
    };

    try {
      // Сбрасываем старое соединение перед тестом
      await MCPClientPool.releaseClient(id);
      const client = await MCPClientPool.getClient(config);

      const [tools, resources, prompts] = await Promise.all([
        client.listTools().catch(() => []),
        client.listResources().catch(() => []),
        client.listPrompts().catch(() => []),
      ]);

      const capabilities = {
        tools: tools.length > 0,
        resources: resources.length > 0,
        prompts: prompts.length > 0,
      };

      // Обновляем метаданные сервера в БД
      await db
        .update(mcpServers)
        .set({
          capabilities,
          discoveredTools: tools,
          discoveredResources: resources,
          discoveredPrompts: prompts,
          updatedAt: new Date(),
        })
        .where(eq(mcpServers.id, id));

      return {
        success: true,
        message: `Успешное подключение к MCP серверу "${serverRow.name}". Обнаружено инструментов: ${tools.length}, ресурсов: ${resources.length}, промптов: ${prompts.length}.`,
        capabilities,
        tools,
        resources,
        prompts,
      };
    } catch (err: any) {
      return reply.status(502).send({
        success: false,
        error: 'MCPConnectionError',
        message: `Не удалось подключиться к MCP серверу "${serverRow.name}": ${err.message}`,
      });
    }
  });

  /**
   * POST /api/mcp/servers/:id/tools/call - Ручной вызов инструмента на MCP сервере
   */
  fastify.post('/servers/:id/tools/call', { preHandler: authenticate }, async (request: any, reply) => {
    const { id } = request.params;
    const parseRes = CallMCPToolSchema.safeParse(request.body);
    if (!parseRes.success) {
      return reply.status(400).send({ error: 'ValidationError', details: parseRes.error.format() });
    }

    const { toolName, arguments: toolArgs } = parseRes.data;
    const db = getDatabase();

    const [serverRow] = await db
      .select()
      .from(mcpServers)
      .where(and(eq(mcpServers.id, id), eq(mcpServers.userId, request.user.id)))
      .limit(1);

    if (!serverRow) {
      return reply.status(404).send({ error: 'NotFound', message: 'MCP сервер не найден' });
    }

    let env: Record<string, string> | undefined = undefined;
    let apiKey: string | undefined = undefined;

    if (serverRow.envEncrypted) {
      try {
        env = JSON.parse(decryptData(serverRow.envEncrypted));
      } catch {}
    }
    if (serverRow.apiKeyEncrypted) {
      try {
        apiKey = decryptData(serverRow.apiKeyEncrypted);
      } catch {}
    }

    const config: MCPServerConfig = {
      id: serverRow.id,
      name: serverRow.name,
      transport: serverRow.transport as any,
      serverUrl: serverRow.serverUrl,
      command: serverRow.command,
      args: serverRow.args as any,
      env,
      apiKey,
      authType: serverRow.authType as any,
    };

    try {
      const client = await MCPClientPool.getClient(config);
      const result = await client.callTool(toolName, toolArgs);

      return {
        success: !result.isError,
        toolName,
        content: result.content,
        durationMs: result.durationMs,
      };
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: 'MCPExecutionError',
        message: err.message,
      });
    }
  });

  /**
   * DELETE /api/mcp/servers/:id - Удаление MCP сервера
   */
  fastify.delete('/servers/:id', { preHandler: authenticate }, async (request: any, reply) => {
    const { id } = request.params;
    const db = getDatabase();

    await MCPClientPool.releaseClient(id);

    await db
      .delete(mcpServers)
      .where(and(eq(mcpServers.id, id), eq(mcpServers.userId, request.user.id)));

    return { success: true, message: 'MCP сервер успешно удален' };
  });
}
