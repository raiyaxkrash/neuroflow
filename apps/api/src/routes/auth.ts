import { FastifyInstance } from 'fastify';
import { getDatabase, users, hashPassword, verifyPassword, eq } from '@neuroflow/database';
import { LoginSchema, RegisterSchema } from '@neuroflow/shared';

export async function authRoutes(fastify: FastifyInstance) {
  // Регистрация нового пользователя
  fastify.post('/register', {
    schema: {
      tags: ['Authentication'],
      summary: 'Регистрация пользователя',
    },
  }, async (request, reply) => {
    const parseResult = RegisterSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parseResult.error.errors,
      });
    }

    const { email, password, name } = parseResult.data;
    const db = getDatabase();

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return reply.status(409).send({ error: 'Пользователь с таким email уже существует' });
    }

    const passwordHash = hashPassword(password);
    const [newUser] = await db.insert(users).values({
      email,
      passwordHash,
      name,
      role: 'user',
    }).returning();

    const token = fastify.jwt.sign({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    return reply.status(201).send({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        createdAt: newUser.createdAt,
      },
    });
  });

  // Вход пользователя
  fastify.post('/login', {
    schema: {
      tags: ['Authentication'],
      summary: 'Аутентификация пользователя',
    },
  }, async (request, reply) => {
    const parseResult = LoginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: parseResult.error.errors,
      });
    }

    const { email, password } = parseResult.data;
    const db = getDatabase();

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      return reply.status(401).send({ error: 'Неверный email или пароль' });
    }

    if (!verifyPassword(password, user.passwordHash)) {
      return reply.status(401).send({ error: 'Неверный email или пароль' });
    }

    const token = fastify.jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return reply.send({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  });

  // Получение текущего профиля
  fastify.get('/me', {
    schema: {
      tags: ['Authentication'],
      summary: 'Текущий профиль пользователя',
    },
    preHandler: async (request: any, reply) => {
      try {
        await request.jwtVerify();
      } catch {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    },
  }, async (request: any, reply) => {
    const db = getDatabase();
    const [user] = await db.select().from(users).where(eq(users.id, request.user.id)).limit(1);
    if (!user) {
      return reply.status(404).send({ error: 'Пользователь не найден' });
    }

    return reply.send({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    });
  });
}
