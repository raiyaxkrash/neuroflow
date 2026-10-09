import {
  WorkflowGraph,
  WorkflowNode,
  WorkflowEdge,
  AIGenerateWorkflowResponse,
  WorkflowGraphSchema,
} from '@neuroflow/shared';
import { getNodeRegistry, IAIProvider } from '@neuroflow/nodes';
import { WorkflowValidator } from '../validator.js';

/**
 * Автоматический расчет координат узлов на холсте (Auto-layout)
 */
export function autoLayoutGraph(graph: WorkflowGraph): WorkflowGraph {
  const nodes = [...graph.nodes];
  const edges = graph.edges || [];

  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const n of nodes) {
    inDegree.set(n.id, 0);
    adjacency.set(n.id, []);
  }

  for (const e of edges) {
    adjacency.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
  }

  // Поиск стартовых узлов (уровень 0)
  const levels = new Map<string, number>();
  const queue: string[] = [];

  for (const [nodeId, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(nodeId);
      levels.set(nodeId, 0);
    }
  }

  // BFS для определения уровня глубины каждого узла
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = levels.get(current) || 0;

    const neighbors = adjacency.get(current) || [];
    for (const neighbor of neighbors) {
      const existingLevel = levels.get(neighbor) || 0;
      levels.set(neighbor, Math.max(existingLevel, currentLevel + 1));
      queue.push(neighbor);
    }
  }

  // Группировка узлов по уровням
  const levelGroups = new Map<number, string[]>();
  for (const n of nodes) {
    const lvl = levels.get(n.id) || 0;
    const group = levelGroups.get(lvl) || [];
    group.push(n.id);
    levelGroups.set(lvl, group);
  }

  // Назначение координат: шаг X = 300px, шаг Y = 160px
  const positionedNodes: WorkflowNode[] = nodes.map((node) => {
    const lvl = levels.get(node.id) || 0;
    const group = levelGroups.get(lvl) || [node.id];
    const indexInGroup = group.indexOf(node.id);

    // Центрирование узлов по вертикали
    const yOffset = (indexInGroup - (group.length - 1) / 2) * 160;

    return {
      ...node,
      position: {
        x: 100 + lvl * 320,
        y: Math.max(80, 240 + yOffset),
      },
    };
  });

  return {
    nodes: positionedNodes,
    edges,
  };
}

export class AIWorkflowGenerator {
  /**
   * Генерация полноценного воркфлоу по описанию на естественном языке
   */
  public static async generate(
    userPrompt: string,
    aiProvider: IAIProvider,
    options?: { model?: string; contextGraph?: WorkflowGraph }
  ): Promise<AIGenerateWorkflowResponse> {
    const registry = getNodeRegistry();
    const availableNodeMetas = registry.getAllMeta().map((m) => ({
      type: m.type,
      name: m.name,
      description: m.description,
      category: m.category,
      inputs: m.inputs.map((p) => ({ id: p.id, type: p.type })),
      outputs: m.outputs.map((p) => ({ id: p.id, type: p.type })),
      defaultParameters: m.defaultParameters,
    }));

    const systemPrompt = `You are the core AI Architect of NeuroFlow, a professional workflow automation platform.
Your task is to convert a user request into a valid, production-ready Workflow Graph JSON.

CRITICAL ARCHITECTURAL RULES:
1. ONLY use node types from the Allowed Node Registry below. NEVER invent imaginary node types.
2. The workflow must be a Directed Acyclic Graph (DAG) with NO CYCLES.
3. Every edge must connect an existing output port of the source node to an existing input port of the target node.
   - For "condition" nodes, the output ports are "true" and "false". Connect edges with sourceHandle: "true" or "false".
   - For other nodes with a single output, the output port is "main".
   - The input port for non-trigger nodes is "main".
4. Provide meaningful names and descriptions.
5. If the user mentions AI, summarization, or LLM, use the "ai-model" node.
6. Provide specific configurations in parameters where possible.

ALLOWED NODE REGISTRY:
${JSON.stringify(availableNodeMetas, null, 2)}

OUTPUT FORMAT:
Reply ONLY with valid JSON in this exact structure:
{
  "name": "Concise workflow name in Russian",
  "description": "Short explanation of the pipeline in Russian",
  "explanation": "Human-readable explanation of why this architecture was chosen and how it works in Russian",
  "graph": {
    "nodes": [
      {
        "id": "node_unique_id",
        "type": "valid_node_type",
        "position": { "x": 0, "y": 0 },
        "data": {
          "label": "Human Readable Label",
          "type": "valid_node_type",
          "parameters": {}
        }
      }
    ],
    "edges": [
      {
        "id": "edge_unique_id",
        "source": "source_node_id",
        "target": "target_node_id",
        "sourceHandle": "main|true|false",
        "targetHandle": "main"
      }
    ]
  },
  "missingParameters": [
    {
      "nodeId": "node_id",
      "nodeLabel": "Node Label",
      "parameterName": "param_name",
      "description": "Explanation of what the user needs to configure manually"
    }
  ]
}`;

    const promptMessage = `User Request: "${userPrompt}"
${options?.contextGraph?.nodes?.length ? `Current Canvas Context: ${JSON.stringify(options.contextGraph)}` : ''}

Generate the workflow JSON:`;

    const { data: rawJson } = await aiProvider.generateStructuredOutput<any>({
      systemPrompt,
      userPrompt: promptMessage,
      model: options?.model,
      temperature: 0.2, // Низкая температура для строгой структуры
      responseFormat: 'json',
    });

    if (!rawJson || !rawJson.graph || !Array.isArray(rawJson.graph.nodes)) {
      throw new Error('ИИ вернул неполную структуру данных (отсутствует поле graph.nodes)');
    }

    // 1. Фильтрация узлов: отсекаем галлюцинированные типы, которых нет в реестре
    const rawNodes = Array.isArray(rawJson.graph.nodes) ? rawJson.graph.nodes : [];
    const validRawNodes = rawNodes.filter((n: any) => n && n.type && registry.getNode(n.type));

    if (validRawNodes.length === 0) {
      throw new Error('ИИ не сгенерировал ни одного поддерживаемого типа узла');
    }

    // Нормализация узлов под схему WorkflowNode
    const normalizedNodes: WorkflowNode[] = validRawNodes.map((n: any, idx: number) => {
      const typeDef = registry.getNode(n.type);
      const defaultParams = typeDef?.defaultParameters ? { ...typeDef.defaultParameters } : {};
      const userParams = n.data?.parameters || n.parameters || {};
      const mergedParams = { ...defaultParams, ...userParams };

      return {
        id: n.id || `node_${n.type}_${idx + 1}`,
        type: n.type,
        position:
          n.position && typeof n.position.x === 'number' && typeof n.position.y === 'number'
            ? n.position
            : { x: 100 + idx * 250, y: 150 },
        data: {
          label: n.data?.label || n.label || typeDef?.name || n.type,
          type: n.type,
          parameters: mergedParams,
        },
      };
    });

    const validNodeIdSet = new Set(normalizedNodes.map((n) => n.id));

    // Нормализация связей: оставляем только ребра между валидными оставшимися узлами
    const rawEdges = Array.isArray(rawJson.graph.edges) ? rawJson.graph.edges : [];
    const normalizedEdges: WorkflowEdge[] = rawEdges
      .filter((e: any) => e && validNodeIdSet.has(e.source) && validNodeIdSet.has(e.target))
      .map((e: any, idx: number) => ({
        id: e.id || `edge_${idx + 1}`,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle || 'main',
        targetHandle: e.targetHandle || 'main',
      }));

    const rawGraphToValidate = {
      nodes: normalizedNodes,
      edges: normalizedEdges,
    };

    // 2. Zod валидация графа
    const parsedGraph = WorkflowGraphSchema.safeParse(rawGraphToValidate);
    if (!parsedGraph.success) {
      throw new Error(`Ошибка схемы сгенерированного графа: ${parsedGraph.error.errors.map((e) => e.message).join(', ')}`);
    }

    // 3. Автоматический расчет раскладки узлов (Auto-layout)
    const laidOutGraph = autoLayoutGraph(parsedGraph.data);

    // 4. Валидация DAG и циклов через официальный валидатор
    const validation = WorkflowValidator.validate(laidOutGraph);
    if (!validation.valid) {
      throw new Error(`Сгенерированный граф не прошел DAG валидацию: ${validation.errors.join('; ')}`);
    }

    return {
      name: rawJson.name || 'AI Generated Workflow',
      description: rawJson.description || 'Сгенерировано AI Архитектором NeuroFlow',
      graph: laidOutGraph,
      explanation: rawJson.explanation || 'Автоматизация создана на основе вашего описания.',
      missingParameters: rawJson.missingParameters || [],
    };
  }
}

export class WorkflowGenerator {
  constructor(private aiProvider: IAIProvider) {}

  public async generateWorkflow(options: { prompt: string; model?: string }) {
    return AIWorkflowGenerator.generate(options.prompt, this.aiProvider, { model: options.model });
  }
}
