import {
  WorkflowGraph,
  WorkflowNode,
  WorkflowEdge,
} from '@neuroflow/shared';
import { getNodeRegistry } from '@neuroflow/nodes';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class WorkflowValidator {
  /**
   * Экземплярный метод валидации воркфлоу или графа
   */
  public validate(graphOrWorkflow: WorkflowGraph | { graph: WorkflowGraph }): ValidationResult {
    return WorkflowValidator.validate(graphOrWorkflow);
  }

  /**
   * Полная валидация структуры графа
   */
  public static validate(graphOrWorkflow: WorkflowGraph | { graph: WorkflowGraph }): ValidationResult {
    const graph: WorkflowGraph = (graphOrWorkflow as any)?.graph ? (graphOrWorkflow as any).graph : graphOrWorkflow;
    const errors: string[] = [];
    const warnings: string[] = [];
    const registry = getNodeRegistry();

    const nodes = graph?.nodes || [];
    const edges = graph?.edges || [];

    if (nodes.length === 0) {
      return { valid: false, errors: ['Граф воркфлоу пуст. Добавьте хотя бы один узел.'], warnings: [] };
    }

    const nodeMap = new Map<string, WorkflowNode>();
    for (const node of nodes) {
      if (nodeMap.has(node.id)) {
        errors.push(`Дублирующийся идентификатор узла: "${node.id}".`);
      }
      nodeMap.set(node.id, node);

      // Проверка типа узла
      const nodeDef = registry.getNode(node.type);
      if (!nodeDef) {
        errors.push(`Узел "${node.id}" (${node.data?.label || node.id}) имеет неизвестный тип: "${node.type}".`);
      } else {
        // Проверка параметров узла
        const paramValidation = nodeDef.validateParameters(node.data?.parameters || {});
        if (!paramValidation.valid && paramValidation.errors) {
          for (const err of paramValidation.errors) {
            errors.push(`Ошибка конфигурации узла "${node.data?.label || node.id}": ${err}`);
          }
        }
      }
    }

    // Проверка ребер
    const outgoingEdges = new Map<string, WorkflowEdge[]>();
    const incomingEdges = new Map<string, WorkflowEdge[]>();

    for (const edge of edges) {
      if (!nodeMap.has(edge.source)) {
        errors.push(`Ребро "${edge.id}" указывает на несуществующий исходный узел "${edge.source}".`);
      }
      if (!nodeMap.has(edge.target)) {
        errors.push(`Ребро "${edge.id}" указывает на несуществующий целевой узел "${edge.target}".`);
      }
      if (edge.source === edge.target) {
        errors.push(`Недопустимая петля: узел "${edge.source}" соединен сам с собой.`);
      }

      // Проверка портов
      const sourceNode = nodeMap.get(edge.source);
      if (sourceNode) {
        const sourceDef = registry.getNode(sourceNode.type);
        if (sourceDef && edge.sourceHandle) {
          const hasPort = sourceDef.outputs.some((p) => p.id === edge.sourceHandle);
          if (!hasPort) {
            errors.push(`Узел "${sourceNode.data?.label}" не имеет выходного порта "${edge.sourceHandle}".`);
          }
        }
      }

      const outList = outgoingEdges.get(edge.source) || [];
      outList.push(edge);
      outgoingEdges.set(edge.source, outList);

      const inList = incomingEdges.get(edge.target) || [];
      inList.push(edge);
      incomingEdges.set(edge.target, inList);
    }

    // Поиск стартовых узлов (триггеров или узлов без входящих ребер)
    const startNodes = nodes.filter((n) => {
      const incoming = incomingEdges.get(n.id) || [];
      return incoming.length === 0;
    });

    if (startNodes.length === 0) {
      errors.push('В графе не найден стартовый узел (узел без входящих соединений). Возможно, граф зациклен.');
    }

    // Проверка наличия триггера
    const hasTrigger = nodes.some((n) => {
      const def = registry.getNode(n.type);
      return (
        (def && (def.category === 'trigger' || def.category === 'telegram' || def.category === 'github' || def.category === 'discord')) ||
        n.type.endsWith('-trigger')
      );
    });
    if (!hasTrigger) {
      warnings.push('В воркфлоу отсутствует узел-триггер (например, Manual Trigger). Запуск будет производиться с корневого узла.');
    }

    // Обнаружение циклов через DFS (Поиск в глубину с тремя цветами)
    // 0 = White (не посещен), 1 = Gray (в стеке рекурсии), 2 = Black (полностью обработан)
    const visited = new Map<string, number>();
    for (const node of nodes) {
      visited.set(node.id, 0);
    }

    let hasCycle = false;
    const cyclePath: string[] = [];

    const dfs = (nodeId: string, path: string[]): boolean => {
      visited.set(nodeId, 1);
      path.push(nodeId);

      const nextEdges = outgoingEdges.get(nodeId) || [];
      for (const edge of nextEdges) {
        const targetId = edge.target;
        const targetState = visited.get(targetId);

        if (targetState === 1) {
          // Найден цикл!
          hasCycle = true;
          const cycleStartIdx = path.indexOf(targetId);
          cyclePath.push(...path.slice(cycleStartIdx), targetId);
          return true;
        }

        if (targetState === 0) {
          if (dfs(targetId, path)) {
            return true;
          }
        }
      }

      visited.set(nodeId, 2);
      path.pop();
      return false;
    };

    for (const node of nodes) {
      if (visited.get(node.id) === 0) {
        if (dfs(node.id, [])) {
          break;
        }
      }
    }

    if (hasCycle) {
      const formattedCycle = cyclePath
        .map((id) => nodeMap.get(id)?.data?.label || id)
        .join(' -> ');
      errors.push(`Обнаружен недопустимый цикл в графе выполнения: ${formattedCycle}. Граф должен быть ациклическим (DAG).`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
