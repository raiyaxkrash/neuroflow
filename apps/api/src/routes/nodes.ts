import { FastifyInstance } from 'fastify';
import { getNodeRegistry } from '@neuroflow/nodes';

export async function nodeRoutes(fastify: FastifyInstance) {
  fastify.get('/', {
    schema: {
      tags: ['Nodes'],
      summary: 'Список всех зарегистрированных узлов автоматизации',
    },
  }, async (request, reply) => {
    const registry = getNodeRegistry();
    const nodes = registry.getAllMeta();
    return reply.send({
      nodes,
      total: nodes.length,
    });
  });

  fastify.get('/:type', {
    schema: {
      tags: ['Nodes'],
      summary: 'Получение метаданных конкретного типа узла',
    },
  }, async (request: any, reply) => {
    const { type } = request.params;
    const registry = getNodeRegistry();
    const node = registry.getNode(type);

    if (!node) {
      return reply.status(404).send({ error: `Тип узла "${type}" не найден` });
    }

    return reply.send(node.getMeta());
  });
}
