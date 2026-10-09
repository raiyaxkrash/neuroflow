import { MissionTaskDefinition } from '@neuroflow/shared';

export interface DAGValidationResult {
  valid: boolean;
  error?: string;
  executionLayers?: string[][]; // Список параллельных слоев (taskKey[])
}

export const MAX_MISSION_TASKS = 20;

/**
 * Валидатор ориентированного ациклического графа (DAG) подзадач миссии.
 * Проверяет уникальность ключей, отсутствие циклов и вычисляет слои параллельного выполнения.
 */
export class DAGValidator {
  public static validate(tasks: MissionTaskDefinition[]): DAGValidationResult {
    if (!tasks || tasks.length === 0) {
      return { valid: false, error: 'План миссии должен содержать хотя бы одну задачу' };
    }

    if (tasks.length > MAX_MISSION_TASKS) {
      return {
        valid: false,
        error: `План миссии превышает максимально допустимое количество задач (${MAX_MISSION_TASKS}). Получено: ${tasks.length}`,
      };
    }

    const taskMap = new Map<string, MissionTaskDefinition>();
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const task of tasks) {
      if (!task.taskKey || task.taskKey.trim() === '') {
        return { valid: false, error: 'Обнаружена задача с пустым идентификатором taskKey' };
      }
      if (taskMap.has(task.taskKey)) {
        return { valid: false, error: `Дублирующийся идентификатор задачи: "${task.taskKey}"` };
      }
      taskMap.set(task.taskKey, task);
      inDegree.set(task.taskKey, 0);
      adjacency.set(task.taskKey, []);
    }

    // Проверка корректности зависимостей и построение графа
    for (const task of tasks) {
      const deps = task.dependencies || [];
      for (const depKey of deps) {
        if (!taskMap.has(depKey)) {
          return {
            valid: false,
            error: `Задача "${task.taskKey}" ссылается на несуществующую зависимость "${depKey}"`,
          };
        }
        if (depKey === task.taskKey) {
          return {
            valid: false,
            error: `Задача "${task.taskKey}" не может зависеть сама от себя (циклическая ссылка)`,
          };
        }
        adjacency.get(depKey)!.push(task.taskKey);
        inDegree.set(task.taskKey, (inDegree.get(task.taskKey) || 0) + 1);
      }
    }

    // Алгоритм Кана для топологической сортировки и построения параллельных слоев
    const layers: string[][] = [];
    let currentLayer = Array.from(inDegree.entries())
      .filter(([_, degree]) => degree === 0)
      .map(([key]) => key);

    let processedCount = 0;

    while (currentLayer.length > 0) {
      layers.push(currentLayer);
      processedCount += currentLayer.length;
      const nextLayer: string[] = [];

      for (const taskKey of currentLayer) {
        const neighbors = adjacency.get(taskKey) || [];
        for (const neighbor of neighbors) {
          const currentDeg = inDegree.get(neighbor)! - 1;
          inDegree.set(neighbor, currentDeg);
          if (currentDeg === 0) {
            nextLayer.push(neighbor);
          }
        }
      }

      currentLayer = nextLayer;
    }

    if (processedCount < tasks.length) {
      return {
        valid: false,
        error: 'Обнаружен цикл в графе зависимостей задач миссии (DAG violation). Задачи образуют взаимную блокировку.',
      };
    }

    return {
      valid: true,
      executionLayers: layers,
    };
  }
}
