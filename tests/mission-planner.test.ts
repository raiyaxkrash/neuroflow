import { describe, it, expect } from 'vitest';
import { DAGValidator, MissionPlanner } from '@neuroflow/mission-engine';
import { MissionTaskDefinition } from '@neuroflow/shared';

describe('Mission Planner & DAG Validator', () => {
  it('должен успешно валидировать корректный ациклический граф и строить параллельные слои', () => {
    const tasks: MissionTaskDefinition[] = [
      {
        taskKey: 'step_1_research',
        title: 'Исследование',
        description: 'Сбор данных',
        assignedAgent: 'Web Researcher',
        dependencies: [],
        criteria: [],
        inputData: {},
        maxRetries: 3,
      },
      {
        taskKey: 'step_2a_analysis',
        title: 'Анализ данных',
        description: 'Обработка собранных данных',
        assignedAgent: 'Data Analyst',
        dependencies: ['step_1_research'],
        criteria: [],
        inputData: {},
        maxRetries: 3,
      },
      {
        taskKey: 'step_2b_code_check',
        title: 'Проверка репозитория',
        description: 'Параллельная проверка кода',
        assignedAgent: 'Code Specialist',
        dependencies: ['step_1_research'],
        criteria: [],
        inputData: {},
        maxRetries: 3,
      },
      {
        taskKey: 'step_3_report',
        title: 'Сводный отчет',
        description: 'Объединение аналитики и кода',
        assignedAgent: 'Report Writer',
        dependencies: ['step_2a_analysis', 'step_2b_code_check'],
        criteria: [],
        inputData: {},
        maxRetries: 3,
      },
    ];

    const result = DAGValidator.validate(tasks);
    expect(result.valid).toBe(true);
    expect(result.executionLayers).toBeDefined();
    expect(result.executionLayers?.length).toBe(3);
    // Слой 0: step_1_research
    expect(result.executionLayers?.[0]).toEqual(['step_1_research']);
    // Слой 1: step_2a_analysis и step_2b_code_check параллельно
    expect(result.executionLayers?.[1]).toContain('step_2a_analysis');
    expect(result.executionLayers?.[1]).toContain('step_2b_code_check');
    // Слой 2: step_3_report
    expect(result.executionLayers?.[2]).toEqual(['step_3_report']);
  });

  it('должен обнаруживать циклы и блокировать циклические планы (детекция цикла)', () => {
    const cyclicTasks: MissionTaskDefinition[] = [
      {
        taskKey: 'task_a',
        title: 'Задача А',
        description: '...',
        assignedAgent: 'Agent',
        dependencies: ['task_b'], // А зависит от Б
        criteria: [],
        inputData: {},
        maxRetries: 3,
      },
      {
        taskKey: 'task_b',
        title: 'Задача Б',
        description: '...',
        assignedAgent: 'Agent',
        dependencies: ['task_a'], // Б зависит от А -> ЦИКЛ!
        criteria: [],
        inputData: {},
        maxRetries: 3,
      },
    ];

    const result = DAGValidator.validate(cyclicTasks);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Обнаружен цикл в графе зависимостей');
  });

  it('должен отклонять план с несуществующими зависимостями', () => {
    const tasks: MissionTaskDefinition[] = [
      {
        taskKey: 'task_1',
        title: 'Задача 1',
        description: '...',
        assignedAgent: 'Agent',
        dependencies: ['phantom_task'],
        criteria: [],
        inputData: {},
        maxRetries: 3,
      },
    ];

    const result = DAGValidator.validate(tasks);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('несуществующую зависимость');
  });

  it('должен ограничивать максимальное число задач (до 20)', () => {
    const tooManyTasks: MissionTaskDefinition[] = Array.from({ length: 25 }, (_, i) => ({
      taskKey: `task_${i}`,
      title: `Задача ${i}`,
      description: '...',
      assignedAgent: 'Agent',
      dependencies: i > 0 ? [`task_${i - 1}`] : [],
      criteria: [],
      inputData: {},
      maxRetries: 3,
    }));

    const result = DAGValidator.validate(tooManyTasks);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('превышает максимально допустимое количество задач');
  });

  it('MissionPlanner должен успешно строить структурированный план по текстовой цели', async () => {
    const plan = await MissionPlanner.plan('Исследовать конкурентов и составить сводный отчет');
    expect(plan.tasks.length).toBeGreaterThanOrEqual(2);
    expect(plan.summary).toBeDefined();
    expect(plan.successCriteria.length).toBeGreaterThan(0);

    const validation = DAGValidator.validate(plan.tasks);
    expect(validation.valid).toBe(true);
  });
});
