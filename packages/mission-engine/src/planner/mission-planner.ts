import {
  MissionPlan,
  MissionPlanSchema,
  MissionTaskDefinition,
} from '@neuroflow/shared';
import { IAIProvider, MockAIProvider } from '@neuroflow/nodes';
import { DAGValidator } from './dag-validator.js';

export interface PlanMissionOptions {
  aiProvider?: IAIProvider;
  model?: string;
  userId?: string;
  allowedTools?: string[];
  tokenBudget?: number;
}

export class MissionPlanner {
  /**
   * Интеллектуальное планирование многоэтапной миссии на основе естественного описания цели
   */
  public static async plan(goal: string, options?: PlanMissionOptions): Promise<MissionPlan> {
    const trimmedGoal = goal.trim();
    if (!trimmedGoal) {
      throw new Error('Цель миссии не может быть пустой');
    }

    const provider = options?.aiProvider;

    if (provider) {
      try {
        const plan = await this.planWithAI(trimmedGoal, provider, options);
        // Валидируем DAG
        const validation = DAGValidator.validate(plan.tasks);
        if (validation.valid) {
          return plan;
        }
        console.warn(`[MissionPlanner] AI сгенерировал некорректный DAG: ${validation.error}. Запуск эвристической коррекции.`);
      } catch (err: any) {
        console.warn(`[MissionPlanner] Ошибка генерации плана через AI: ${err.message}. Применяется детерминированный планировщик.`);
      }
    }

    // Детерминированный fallback планировщик (обеспечивает 100% надежность даже при оффлайн/сбоях LLM)
    return this.createDeterministicPlan(trimmedGoal, options);
  }

  /**
   * Планирование через языковую модель
   */
  private static async planWithAI(
    goal: string,
    provider: IAIProvider,
    options?: PlanMissionOptions
  ): Promise<MissionPlan> {
    const systemPrompt = `Ты — ведущий AI-архитектор автономных миссий в системе NeuroFlow.
Твоя задача — декомпозировать цель пользователя в ориентированный ациклический граф (DAG) структурированных подзадач.

ПРАВИЛА И ОГРАНИЧЕНИЯ:
1. Максимум 15-20 подзадач (оптимально 3-7 для фокусировки).
2. Граф должен быть строго ациклическим (без циклических зависимостей).
3. Каждая задача должна иметь:
   - taskKey: уникальный латинский идентификатор (например "research_phase", "data_extraction", "report_generation").
   - title: четкое краткое название задачи на русском языке.
   - description: подробное описание действий.
   - assignedAgent: рекомендуемая роль агента ("Web Researcher", "Data Analyst", "Code Specialist", "Desktop Assistant", "Report Writer", "General Agent").
   - dependencies: массив taskKey задач, завершения которых необходимо дождаться перед запуском (пустой массив для начальных независимых задач).
   - criteria: массив критериев готовности с полями id, description, expectedType ("file_exists" | "json_match" | "non_empty_string" | "http_success" | "custom").
   - inputData: объект входных параметров.
   - maxRetries: допустимое число повторов при сбое (от 1 до 3).
4. Запрещены опасные или неограниченные действия.

ВЫВОД ТОЛЬКО В JSON ФОРМАТЕ:
{
  "summary": "Краткое резюме стратегии выполнения миссии на русском языке",
  "successCriteria": ["Критерий успеха 1", "Критерий успеха 2"],
  "tasks": [ ... ],
  "estimatedTokens": 15000,
  "suggestedAgents": ["Web Researcher", "Report Writer"]
}`;

    const userPrompt = `ЦЕЛЬ МИССИИ:
${goal}

Разрешенные инструменты: ${JSON.stringify(options?.allowedTools || ['all_safe_tools'])}
Бюджет токенов: ${options?.tokenBudget || 50000}`;

    const response = await provider.generateText({
      prompt: userPrompt,
      systemPrompt,
      temperature: 0.2,
      model: options?.model,
    });

    const cleaned = response.text
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);
    const validated = MissionPlanSchema.parse(parsed);

    return validated;
  }

  /**
   * Детерминированный fallback планировщик для гарантированной надежности и тестов
   */
  public static createDeterministicPlan(goal: string, options?: PlanMissionOptions): MissionPlan {
    const lower = goal.toLowerCase();

    // Определяем специфику цели
    const isWeb = lower.includes('браузер') || lower.includes('сайт') || lower.includes('поиск') || lower.includes('парсинг') || lower.includes('web') || lower.includes('http');
    const isDesktop = lower.includes('desktop') || lower.includes('окно') || lower.includes('приложени') || lower.includes('файл') || lower.includes('скриншот');
    const isCode = lower.includes('код') || lower.includes('репозитори') || lower.includes('тест') || lower.includes('git') || lower.includes('bug');

    const tasks: MissionTaskDefinition[] = [];

    // Шаг 1: Сбор информации и контекста
    const step1Key = 'step_1_gather_context';
    tasks.push({
      taskKey: step1Key,
      title: 'Сбор контекста и исследование требований',
      description: `Анализ цели: "${goal}". Выявление начальных условий, источников данных и необходимых параметров.`,
      assignedAgent: isWeb ? 'Web Researcher' : isDesktop ? 'Desktop Assistant' : isCode ? 'Code Specialist' : 'General Agent',
      dependencies: [],
      criteria: [
        {
          id: 'c_context_gathered',
          description: 'Контекст и исходные данные успешно собраны и зафиксированы',
          expectedType: 'non_empty_string',
        },
      ],
      inputData: { goal, searchScope: 'initial_context' },
      maxRetries: 3,
    });

    // Шаг 2: Основное выполнение / обработка
    const step2Key = 'step_2_core_execution';
    tasks.push({
      taskKey: step2Key,
      title: 'Выполнение основного сценария и извлечение данных',
      description: `Реализация основной части миссии в соответствии с собранными требованиями: "${goal}".`,
      assignedAgent: isWeb ? 'Web Researcher' : isCode ? 'Code Specialist' : 'General Agent',
      dependencies: [step1Key],
      criteria: [
        {
          id: 'c_core_completed',
          description: 'Целевое действие выполнено без критических ошибок',
          expectedType: 'custom',
        },
      ],
      inputData: { goal, primaryAction: true },
      maxRetries: 3,
    });

    // Шаг 3: Верификация результатов и формирование итогового артефакта
    const step3Key = 'step_3_verification_and_reporting';
    tasks.push({
      taskKey: step3Key,
      title: 'Верификация результатов и формирование артефакта',
      description: `Проверка соответствия критериям готовности, структурирование финального отчета по цели: "${goal}".`,
      assignedAgent: 'Report Writer',
      dependencies: [step2Key],
      criteria: [
        {
          id: 'c_final_report_ready',
          description: 'Финальный отчет и структурированный результат сформированы',
          expectedType: 'non_empty_string',
        },
      ],
      inputData: { goal, reportFormat: 'markdown_summary' },
      maxRetries: 2,
    });

    return {
      summary: `План автономного выполнения миссии: ${goal.slice(0, 100)}...`,
      successCriteria: [
        'Все этапы графа DAG завершены успешно',
        'Критерии готовности каждого шага подтверждены независимым верификатором',
        'Сформирован и сохранен итоговый отчет',
      ],
      tasks,
      estimatedTokens: 12000,
      suggestedAgents: Array.from(new Set(tasks.map((t) => t.assignedAgent))),
    };
  }
}
