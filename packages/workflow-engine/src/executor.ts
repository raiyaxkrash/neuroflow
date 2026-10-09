import {
  WorkflowGraph,
  WorkflowNode,
  WorkflowEdge,
  ExecutionStatus,
  NodeExecutionStatus,
} from '@neuroflow/shared';
import { getNodeRegistry } from '@neuroflow/nodes';
import { WorkflowValidator } from './validator.js';
import { WorkflowExecutionContext } from './context.js';
import { getDatabase, executions, nodeExecutions, eq } from '@neuroflow/database';

export interface WorkflowExecutorEvents {
  onExecutionStart?: (executionId: string) => Promise<void> | void;
  onNodeStart?: (nodeId: string, nodeType: string) => Promise<void> | void;
  onNodeComplete?: (nodeId: string, nodeType: string, output: any, durationMs: number, selectedPort?: string) => Promise<void> | void;
  onNodeFailed?: (nodeId: string, nodeType: string, error: string, durationMs: number) => Promise<void> | void;
  onNodeSkipped?: (nodeId: string, nodeType: string, reason: string) => Promise<void> | void;
  onExecutionComplete?: (executionId: string, status: ExecutionStatus, finalOutput: any, durationMs: number, error?: string) => Promise<void> | void;
}

export interface ExecutionOptions {
  executionId: string;
  workflowId: string;
  graph: WorkflowGraph;
  initialPayload?: any;
  triggerNodeId?: string;
  signal?: AbortSignal;
  events?: WorkflowExecutorEvents;
  saveToDatabase?: boolean;
}

export class WorkflowExecutor {
  public static async execute(options: ExecutionOptions): Promise<{
    status: ExecutionStatus;
    outputs: Record<string, any>;
    finalOutput: any;
    durationMs: number;
    error?: string;
  }> {
    const {
      executionId,
      workflowId,
      graph,
      initialPayload = {},
      triggerNodeId,
      signal,
      events = {},
      saveToDatabase = true,
    } = options;

    const startTime = Date.now();
    const context = new WorkflowExecutionContext(executionId, workflowId, initialPayload);
    const registry = getNodeRegistry();
    let db: any = null;

    if (saveToDatabase) {
      try {
        db = getDatabase();
      } catch {
        db = null;
      }
    }

    // 1. Валидация графа
    const validation = WorkflowValidator.validate(graph);
    if (!validation.valid) {
      const errorMsg = `Ошибка валидации воркфлоу: ${validation.errors.join('; ')}`;
      const durationMs = Date.now() - startTime;

      if (saveToDatabase && db) {
        try {
          await db.update(executions).set({
            status: ExecutionStatus.FAILED,
            error: errorMsg,
            finishedAt: new Date(),
            durationMs,
          }).where(eq(executions.id, executionId));
        } catch {
          // Игнорируем ошибку сохранения статуса
        }
      }

      await events.onExecutionComplete?.(executionId, ExecutionStatus.FAILED, null, durationMs, errorMsg);
      return {
        status: ExecutionStatus.FAILED,
        outputs: {},
        finalOutput: null,
        durationMs,
        error: errorMsg,
      };
    }

    // 2. Обновление статуса запуска в БД на running
    if (saveToDatabase && db) {
      try {
        await db.update(executions).set({
          status: ExecutionStatus.RUNNING,
          startedAt: new Date(),
        }).where(eq(executions.id, executionId));
      } catch {
        // Ошибка БД не блокирует выполнение
      }
    }

    await events.onExecutionStart?.(executionId);

    const nodes = graph.nodes;
    const edges = graph.edges;
    const nodeMap = new Map<string, WorkflowNode>(nodes.map((n) => [n.id, n]));

    // Построение карты входящих и исходящих ребер
    const outgoing = new Map<string, WorkflowEdge[]>();
    const incoming = new Map<string, WorkflowEdge[]>();

    for (const edge of edges) {
      const outList = outgoing.get(edge.source) || [];
      outList.push(edge);
      outgoing.set(edge.source, outList);

      const inList = incoming.get(edge.target) || [];
      inList.push(edge);
      incoming.set(edge.target, inList);
    }

    // Определение стартовых узлов
    let startNodes: WorkflowNode[] = [];

    if (triggerNodeId && nodeMap.has(triggerNodeId)) {
      startNodes = [nodeMap.get(triggerNodeId)!];
    } else {
      // Ищем узел категории trigger
      const trigger = nodes.find((n) => {
        const def = registry.getNode(n.type);
        return def?.category === 'trigger';
      });
      if (trigger) {
        startNodes = [trigger];
      } else {
        // Узлы без входящих ребер
        startNodes = nodes.filter((n) => (incoming.get(n.id) || []).length === 0);
      }
    }

    // Очередь исполнения (BFS с учетом зависимостей и условий)
    const queue: string[] = startNodes.map((n) => n.id);
    const executedNodes = new Set<string>();
    const skippedNodes = new Set<string>();
    const activeIncomingData = new Map<string, any>(); // Данные, переданные в узел по ребру

    // Начальные входные данные для стартовых узлов
    for (const sn of startNodes) {
      activeIncomingData.set(sn.id, initialPayload);
    }

    let executionError: string | undefined = undefined;
    let finalExecutionStatus: ExecutionStatus = ExecutionStatus.SUCCESS;

    while (queue.length > 0) {
      if (signal?.aborted) {
        finalExecutionStatus = ExecutionStatus.CANCELLED;
        executionError = 'Выполнение отменено пользователем';
        break;
      }

      const currentId = queue.shift()!;
      if (executedNodes.has(currentId) || skippedNodes.has(currentId)) {
        continue;
      }

      const node = nodeMap.get(currentId);
      if (!node) continue;

      const nodeDef = registry.getNode(node.type);
      if (!nodeDef) {
        finalExecutionStatus = ExecutionStatus.FAILED;
        executionError = `Неизвестный тип узла: ${node.type}`;
        break;
      }

      // Получаем входящие данные: переданные по активным связям или последний результат
      const inputData = activeIncomingData.get(currentId) || context.getLastOutput();

      const nodeStartTime = Date.now();
      await events.onNodeStart?.(currentId, node.type);

      // Запись о начале выполнения узла в БД
      if (saveToDatabase && db) {
        try {
          await db.insert(nodeExecutions).values({
            executionId,
            nodeId: currentId,
            nodeType: node.type,
            status: NodeExecutionStatus.RUNNING,
            inputData,
            startedAt: new Date(),
          });
        } catch {
          // Игнорируем ошибку логирования
        }
      }

      try {
        const output = await nodeDef.execute({
          nodeId: currentId,
          parameters: node.data?.parameters || {},
          inputData,
          workflowContext: context.getAllOutputs(),
          signal,
        });

        const nodeDurationMs = Date.now() - nodeStartTime;
        context.setNodeResult(currentId, output.outputData, NodeExecutionStatus.SUCCESS);
        executedNodes.add(currentId);

        // Если это OutputNode, сохраняем как finalOutput
        if (node.type === 'output') {
          context.finalOutput = output.outputData;
        }

        // Обновление статуса узла в БД
        if (saveToDatabase && db) {
          try {
            await db.update(nodeExecutions).set({
              status: NodeExecutionStatus.SUCCESS,
              outputData: output.outputData,
              finishedAt: new Date(),
              durationMs: nodeDurationMs,
            }).where(eq(nodeExecutions.executionId, executionId));
          } catch {
            // Игнорируем
          }
        }

        await events.onNodeComplete?.(currentId, node.type, output.outputData, nodeDurationMs, output.selectedPort);

        // Обработка исходящих рёбер с учетом выбранного порта
        const outEdges = outgoing.get(currentId) || [];
        for (const edge of outEdges) {
          const isPortMatch = !edge.sourceHandle || !output.selectedPort || edge.sourceHandle === output.selectedPort;

          if (isPortMatch) {
            // Активируем следующую ветку
            activeIncomingData.set(edge.target, output.outputData);
            if (!executedNodes.has(edge.target) && !queue.includes(edge.target)) {
              queue.push(edge.target);
            }
          } else {
            // Неактивная ветка (например condition false, когда выполнился true)
            // Помечаем целевые узлы как skipped, если у них нет других активных путей
            const targetNode = nodeMap.get(edge.target);
            if (targetNode && !executedNodes.has(edge.target) && !queue.includes(edge.target)) {
              skippedNodes.add(edge.target);
              await events.onNodeSkipped?.(edge.target, targetNode.type, `Ветка ${edge.sourceHandle} не была выбрана условием`);
            }
          }
        }
      } catch (err: any) {
        const nodeDurationMs = Date.now() - nodeStartTime;
        const errMessage = err.message || String(err);
        context.setNodeResult(currentId, null, NodeExecutionStatus.FAILED);
        executedNodes.add(currentId);

        if (saveToDatabase && db) {
          try {
            await db.update(nodeExecutions).set({
              status: NodeExecutionStatus.FAILED,
              error: errMessage,
              finishedAt: new Date(),
              durationMs: nodeDurationMs,
            }).where(eq(nodeExecutions.executionId, executionId));
          } catch {
            // Игнорируем
          }
        }

        await events.onNodeFailed?.(currentId, node.type, errMessage, nodeDurationMs);

        finalExecutionStatus = ExecutionStatus.FAILED;
        executionError = `Ошибка в узле "${node.data?.label || currentId}" (${node.type}): ${errMessage}`;
        break; // Прерываем дальнейшее выполнение при критической ошибке
      }
    }

    const totalDurationMs = Date.now() - startTime;
    const finalPayload = context.finalOutput || context.getLastOutput();

    // Сохранение итогового статуса запуска
    if (saveToDatabase && db) {
      try {
        await db.update(executions).set({
          status: finalExecutionStatus,
          outputPayload: finalPayload,
          error: executionError || null,
          finishedAt: new Date(),
          durationMs: totalDurationMs,
        }).where(eq(executions.id, executionId));
      } catch {
        // Игнорируем
      }
    }

    await events.onExecutionComplete?.(
      executionId,
      finalExecutionStatus,
      finalPayload,
      totalDurationMs,
      executionError
    );

    return {
      status: finalExecutionStatus,
      outputs: context.getAllOutputs(),
      finalOutput: finalPayload,
      durationMs: totalDurationMs,
      error: executionError,
    };
  }
}
