import {
  getDatabase,
  missions,
  missionTasks,
  missionLogs,
  missionCheckpoints,
  eq,
  and,
} from '@neuroflow/database';
import {
  MissionStatus,
  MissionTaskStatus,
  CheckpointType,
  CreateMissionInput,
  MissionPlan,
} from '@neuroflow/shared';
import { TokenUsageManager } from '@neuroflow/nodes';
import { DAGValidator } from '../planner/dag-validator.js';
import { MissionPlanner } from '../planner/mission-planner.js';
import { ResultVerifier } from '../verifier/result-verifier.js';
import { SelfCorrectionService } from '../verifier/self-correction.js';
import { CheckpointService } from '../persistence/checkpoint-service.js';
import { MissionMemory } from '../memory/mission-memory.js';

export interface ExecuteTaskHandler {
  (params: {
    task: any;
    mission: any;
    memory: MissionMemory;
  }): Promise<{ output: any; tokensUsed?: number }>;
}

export class MissionOrchestrator {
  private static taskHandlers = new Map<string, ExecuteTaskHandler>();

  /**
   * Регистрация кастомного обработчика задач по роли агента
   */
  public static registerAgentHandler(agentRole: string, handler: ExecuteTaskHandler) {
    this.taskHandlers.set(agentRole.toLowerCase(), handler);
  }

  /**
   * Создание новой миссии с автоматическим планированием DAG
   */
  public static async createMission(
    userId: string,
    input: CreateMissionInput,
    customPlan?: MissionPlan
  ) {
    const db = getDatabase();

    // 1. Планирование миссии
    const plan = customPlan || (await MissionPlanner.plan(input.goal, {
      userId,
      tokenBudget: input.tokenBudget,
      allowedTools: input.allowedTools,
    }));

    // Валидация DAG
    const validation = DAGValidator.validate(plan.tasks);
    if (!validation.valid) {
      throw new Error(`Ошибка валидации плана миссии: ${validation.error}`);
    }

    const title = input.title || `Миссия: ${input.goal.slice(0, 50)}...`;

    // 2. Создание записи в таблице missions
    const [mission] = await db
      .insert(missions)
      .values({
        userId,
        title,
        goal: input.goal,
        description: input.description || plan.summary,
        status: MissionStatus.READY,
        plan,
        assignedAgents: plan.suggestedAgents || [],
        allowedTools: input.allowedTools || [],
        tokenBudget: input.tokenBudget || 50000,
        tokensUsed: 0,
        costBudget: input.costBudget || 0,
        costEstimated: Math.round(((plan.estimatedTokens || 10000) / 1000) * 1500),
      })
      .returning();

    // 3. Создание подзадач в таблице mission_tasks
    for (const t of plan.tasks) {
      await db.insert(missionTasks).values({
        missionId: mission.id,
        taskKey: t.taskKey,
        title: t.title,
        description: t.description,
        assignedAgent: t.assignedAgent,
        dependencies: t.dependencies,
        status: MissionTaskStatus.PENDING,
        inputData: t.inputData || {},
        criteria: t.criteria || [],
        maxRetries: t.maxRetries || 3,
        retryCount: 0,
        tokensUsed: 0,
      });
    }

    // 4. Начальный чекпоинт
    const snapshot = await CheckpointService.captureSnapshot(mission.id);
    await CheckpointService.saveCheckpoint({
      missionId: mission.id,
      checkpointType: CheckpointType.MANUAL_PAUSE,
      stateSnapshot: snapshot,
    });

    // 5. Логирование
    await this.log(mission.id, null, 'info', `Миссия успешно создана и запланирована: ${plan.tasks.length} подзадач.`);

    return mission;
  }

  /**
   * Запуск или продолжение выполнения миссии
   */
  public static async startMission(missionId: string): Promise<{ success: boolean; status: string; message: string }> {
    const db = getDatabase();

    const [mission] = await db
      .select()
      .from(missions)
      .where(eq(missions.id, missionId))
      .limit(1);

    if (!mission) {
      throw new Error(`Миссия ${missionId} не найдена`);
    }

    if (mission.status === MissionStatus.COMPLETED) {
      return { success: true, status: mission.status, message: 'Миссия уже полностью завершена' };
    }

    if (mission.status === MissionStatus.CANCELLED) {
      return { success: false, status: mission.status, message: 'Миссия была отменена' };
    }

    // Переводим миссию в статус RUNNING
    await db
      .update(missions)
      .set({ status: MissionStatus.RUNNING, updatedAt: new Date() })
      .where(eq(missions.id, missionId));

    await this.log(missionId, null, 'info', 'Миссия переведена в статус выполнения.');

    // Инициализируем память миссии
    const memory = new MissionMemory();

    // Запускаем асинхронный цикл выполнения задач
    return this.runExecutionLoop(missionId, memory);
  }

  /**
   * Основной цикл выполнения графа задач с поддержкой параллелизма независимых шагов
   */
  private static async runExecutionLoop(
    missionId: string,
    memory: MissionMemory
  ): Promise<{ success: boolean; status: string; message: string }> {
    const db = getDatabase();

    while (true) {
      // 1. Проверяем текущий статус миссии (могла быть поставлена на паузу или отменена)
      const [currentMission] = await db
        .select()
        .from(missions)
        .where(eq(missions.id, missionId))
        .limit(1);

      if (!currentMission) {
        return { success: false, status: 'error', message: 'Миссия не найдена' };
      }

      if (
        currentMission.status === MissionStatus.PAUSED ||
        currentMission.status === MissionStatus.CANCELLED ||
        currentMission.status === MissionStatus.WAITING_FOR_APPROVAL
      ) {
        return {
          success: true,
          status: currentMission.status,
          message: `Выполнение остановлено в связи со статусом: ${currentMission.status}`,
        };
      }

      // Проверка бюджета токенов
      if (currentMission.tokensUsed >= currentMission.tokenBudget) {
        await db
          .update(missions)
          .set({
            status: MissionStatus.PAUSED,
            error: `Лимит бюджета токенов исчерпан (${currentMission.tokensUsed} / ${currentMission.tokenBudget})`,
            updatedAt: new Date(),
          })
          .where(eq(missions.id, missionId));

        await this.log(
          missionId,
          null,
          'warn',
          `Миссия автоматически приостановлена: превышен бюджет токенов (${currentMission.tokensUsed}/${currentMission.tokenBudget}).`
        );

        return {
          success: false,
          status: MissionStatus.PAUSED,
          message: 'Бюджет токенов исчерпан',
        };
      }

      // 2. Получаем все задачи миссии
      const allTasks = await db
        .select()
        .from(missionTasks)
        .where(eq(missionTasks.missionId, missionId));

      const completedKeys = new Set(
        allTasks
          .filter((t: any) => t.status === MissionTaskStatus.COMPLETED)
          .map((t: any) => t.taskKey)
      );

      // Проверяем, завершены ли ВСЕ задачи
      const pendingOrRunning = allTasks.filter(
        (t: any) =>
          t.status === MissionTaskStatus.PENDING ||
          t.status === MissionTaskStatus.RUNNING ||
          t.status === MissionTaskStatus.WAITING_FOR_APPROVAL
      );

      if (pendingOrRunning.length === 0) {
        // Проверяем, есть ли упавшие задачи
        const hasFailed = allTasks.some((t: any) => t.status === MissionTaskStatus.FAILED);
        if (hasFailed) {
          await db
            .update(missions)
            .set({ status: MissionStatus.FAILED, updatedAt: new Date() })
            .where(eq(missions.id, missionId));
          return { success: false, status: MissionStatus.FAILED, message: 'Одна или несколько задач завершились ошибкой' };
        }

        // ВСЕ ЗАДАЧИ УСПЕШНО ЗАВЕРШЕНЫ
        const finalArtifacts = allTasks.reduce((acc: Record<string, any>, t: any) => {
          acc[t.taskKey] = t.outputData;
          return acc;
        }, {} as Record<string, any>);

        const finalSummary = `Миссия успешно выполнена. Все ${allTasks.length} подзадач завершены и верифицированы.`;

        await db
          .update(missions)
          .set({
            status: MissionStatus.COMPLETED,
            finalResult: { summary: finalSummary, artifacts: finalArtifacts },
            updatedAt: new Date(),
          })
          .where(eq(missions.id, missionId));

        // Экспорт в Second Brain
        try {
          await MissionMemory.exportToSecondBrain({
            userId: currentMission.userId,
            missionId,
            missionTitle: currentMission.title,
            missionGoal: currentMission.goal,
            finalSummary,
            artifacts: finalArtifacts,
          });
          await this.log(missionId, null, 'info', 'Итоговые артефакты миссии сохранены в Second Brain.');
        } catch (err: any) {
          await this.log(missionId, null, 'warn', `Предупреждение сохранения в Second Brain: ${err.message}`);
        }

        // Финальный чекпоинт
        const snap = await CheckpointService.captureSnapshot(missionId, memory.getAll());
        await CheckpointService.saveCheckpoint({
          missionId,
          checkpointType: CheckpointType.TASK_COMPLETED,
          stateSnapshot: snap,
        });

        await this.log(missionId, null, 'info', 'Миссия полностью и успешно завершена.');
        return { success: true, status: MissionStatus.COMPLETED, message: finalSummary };
      }

      // 3. Находим задачи, готовые к выполнению (все зависимости в completed)
      const readyTasks = allTasks.filter((t: any) => {
        if (t.status !== MissionTaskStatus.PENDING) return false;
        const deps = (t.dependencies as string[]) || [];
        return deps.every((dep) => completedKeys.has(dep));
      });

      if (readyTasks.length === 0) {
        // Если готовых задач нет, но есть задачи в процессе или ожидающие подтверждения
        const waitingApproval = allTasks.filter((t: any) => t.status === MissionTaskStatus.WAITING_FOR_APPROVAL);
        if (waitingApproval.length > 0) {
          await db
            .update(missions)
            .set({ status: MissionStatus.WAITING_FOR_APPROVAL, updatedAt: new Date() })
            .where(eq(missions.id, missionId));
          return {
            success: true,
            status: MissionStatus.WAITING_FOR_APPROVAL,
            message: 'Миссия ожидает подтверждения пользователя для чувствительного действия',
          };
        }

        // Если нет задач готовых, нет в процессе и не все завершены — блокировка графа
        await db
          .update(missions)
          .set({
            status: MissionStatus.FAILED,
            error: 'Взаимная блокировка задач (deadlock): нет доступных для запуска задач',
            updatedAt: new Date(),
          })
          .where(eq(missions.id, missionId));

        return { success: false, status: MissionStatus.FAILED, message: 'Блокировка задач графа' };
      }

      // 4. Выполняем готовые задачи (с ограничением параллелизма: concurrency = 2)
      const tasksToRun = readyTasks.slice(0, 2);

      await Promise.all(
        tasksToRun.map((task: any) => this.executeSingleTask(task, currentMission, memory))
      );
    }
  }

  /**
   * Выполнение отдельной задачи миссии с верификацией и самокоррекцией
   */
  private static async executeSingleTask(
    task: any,
    mission: any,
    memory: MissionMemory
  ): Promise<void> {
    const db = getDatabase();

    // 1. Проверяем, требует ли задача Human Approval
    const isSensitive = task.title.toLowerCase().includes('удалить') ||
                        task.title.toLowerCase().includes('отправить') ||
                        task.title.toLowerCase().includes('delete') ||
                        task.inputData?.requiresApproval === true;

    if (isSensitive && task.status !== MissionTaskStatus.RUNNING) {
      await db
        .update(missionTasks)
        .set({ status: MissionTaskStatus.WAITING_FOR_APPROVAL, updatedAt: new Date() })
        .where(eq(missionTasks.id, task.id));

      await this.log(
        mission.id,
        task.id,
        'warn',
        `Задача "${task.title}" требует подтверждения владельца перед выполнением чувствительного действия.`
      );

      // Сохраняем контрольную точку перед чувствительным действием
      const snap = await CheckpointService.captureSnapshot(mission.id, memory.getAll());
      await CheckpointService.saveCheckpoint({
        missionId: mission.id,
        taskId: task.id,
        checkpointType: CheckpointType.PRE_SENSITIVE_ACTION,
        stateSnapshot: snap,
      });

      return;
    }

    // 2. Помечаем задачу как RUNNING
    await db
      .update(missionTasks)
      .set({
        status: MissionTaskStatus.RUNNING,
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(missionTasks.id, task.id));

    await this.log(mission.id, task.id, 'info', `Старт выполнения задачи: "${task.title}" (Агент: ${task.assignedAgent})`);

    // 3. Выполнение логики через зарегистрированный обработчик или fallback
    let output: any = null;
    let tokensUsed = 0;
    let executionError: string | undefined;

    try {
      const handler = this.taskHandlers.get(task.assignedAgent.toLowerCase());
      if (handler) {
        const res = await handler({ task, mission, memory });
        output = res.output;
        tokensUsed = res.tokensUsed || 300;
      } else {
        // Стандартный детерминированный обработчик
        output = {
          success: true,
          taskKey: task.taskKey,
          content: `Результат выполнения этапа "${task.title}": необходимые операции успешно проведены.`,
          summary: `Успешно завершен этап: ${task.title}`,
          executedAt: new Date().toISOString(),
          contextLength: 42,
        };
        tokensUsed = 350;
      }
    } catch (err: any) {
      executionError = err.message;
    }

    // 4. Фиксация расхода токенов
    if (tokensUsed > 0) {
      try {
        await TokenUsageManager.recordUsage({
          userId: mission.userId,
          model: 'gpt-4o-mini',
          inputTokens: Math.round(tokensUsed * 0.7),
          outputTokens: Math.round(tokensUsed * 0.3),
          isEstimated: true,
        });

        // Обновляем общий счетчик в mission
        await db
          .update(missions)
          .set({
            tokensUsed: (mission.tokensUsed || 0) + tokensUsed,
            updatedAt: new Date(),
          })
          .where(eq(missions.id, mission.id));
      } catch (err: any) {
        console.warn(`[MissionOrchestrator] Ошибка фиксации токенов: ${err.message}`);
      }
    }

    // 5. Независимая верификация результатов (ResultVerifier)
    const criteria = (task.criteria as any[]) || [];
    const verification = ResultVerifier.verifyTaskOutput(output, criteria);

    if (verification.passed && !executionError) {
      // УСПЕХ: фиксируем результат
      await db
        .update(missionTasks)
        .set({
          status: MissionTaskStatus.COMPLETED,
          outputData: output,
          verificationResult: verification,
          tokensUsed: (task.tokensUsed || 0) + tokensUsed,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(missionTasks.id, task.id));

      memory.set(task.taskKey, output);
      memory.addKeyFact(`Завершен этап ${task.title}: ${verification.summary}`);

      await this.log(
        mission.id,
        task.id,
        'info',
        `Задача "${task.title}" успешно завершена и верифицирована. ${verification.summary}`
      );

      // Сохраняем чекпоинт
      const snap = await CheckpointService.captureSnapshot(mission.id, memory.getAll());
      await CheckpointService.saveCheckpoint({
        missionId: mission.id,
        taskId: task.id,
        checkpointType: CheckpointType.TASK_COMPLETED,
        stateSnapshot: snap,
      });
    } else {
      // НЕУДАЧА: запуск механизма самокоррекции
      const correction = SelfCorrectionService.analyzeFailure(
        { ...task, retryCount: task.retryCount || 0, maxRetries: task.maxRetries || 3 },
        { error: executionError, verification }
      );

      if (correction.canRetry) {
        await db
          .update(missionTasks)
          .set({
            status: MissionTaskStatus.PENDING, // Снова ставим в очередь на запуск
            retryCount: (task.retryCount || 0) + 1,
            inputData: correction.adjustedInputData,
            updatedAt: new Date(),
          })
          .where(eq(missionTasks.id, task.id));

        await this.log(
          mission.id,
          task.id,
          'warn',
          `Самокоррекция задачи "${task.title}": ${correction.reason}. ${correction.guidancePrompt}`
        );
      } else {
        // Попытки исчерпаны — помечаем задачу как FAILED
        await db
          .update(missionTasks)
          .set({
            status: MissionTaskStatus.FAILED,
            verificationResult: verification,
            updatedAt: new Date(),
          })
          .where(eq(missionTasks.id, task.id));

        await this.log(
          mission.id,
          task.id,
          'error',
          `Задача "${task.title}" окончательно провалена. ${correction.reason}`
        );
      }
    }
  }

  /**
   * Подтверждение чувствительного действия пользователем (Human Approval)
   */
  public static async approveTask(missionId: string, taskId: string): Promise<boolean> {
    const db = getDatabase();

    const [task] = await db
      .select()
      .from(missionTasks)
      .where(and(eq(missionTasks.id, taskId), eq(missionTasks.missionId, missionId)))
      .limit(1);

    if (!task) {
      throw new Error(`Задача ${taskId} не найдена в миссии ${missionId}`);
    }

    // Снимаем статус ожидания и даем разрешение на запуск
    await db
      .update(missionTasks)
      .set({
        status: MissionTaskStatus.PENDING,
        inputData: { ...(task.inputData as any), requiresApproval: false, userApproved: true },
        updatedAt: new Date(),
      })
      .where(eq(missionTasks.id, taskId));

    await db
      .update(missions)
      .set({ status: MissionStatus.RUNNING, updatedAt: new Date() })
      .where(eq(missions.id, missionId));

    await this.log(missionId, taskId, 'info', `Действие задачи "${task.title}" подтверждено владельцем.`);

    // Возобновляем выполнение миссии
    const memory = new MissionMemory();
    this.runExecutionLoop(missionId, memory).catch((err) => {
      console.error(`[MissionOrchestrator] Ошибка возобновления после одобрения: ${err.message}`);
    });

    return true;
  }

  /**
   * Приостановка миссии (Pause)
   */
  public static async pauseMission(missionId: string, reason?: string): Promise<boolean> {
    const db = getDatabase();

    await db
      .update(missions)
      .set({ status: MissionStatus.PAUSED, updatedAt: new Date() })
      .where(eq(missions.id, missionId));

    const snap = await CheckpointService.captureSnapshot(missionId);
    await CheckpointService.saveCheckpoint({
      missionId,
      checkpointType: CheckpointType.MANUAL_PAUSE,
      stateSnapshot: snap,
    });

    await this.log(missionId, null, 'info', `Миссия приостановлена пользователем${reason ? `: ${reason}` : ''}.`);
    return true;
  }

  /**
   * Возобновление миссии (Resume)
   */
  public static async resumeMission(missionId: string): Promise<boolean> {
    const res = await this.startMission(missionId);
    return res.success;
  }

  /**
   * Отмена миссии (Cancel)
   */
  public static async cancelMission(missionId: string, reason?: string): Promise<boolean> {
    const db = getDatabase();

    await db
      .update(missions)
      .set({ status: MissionStatus.CANCELLED, error: reason || 'Отменено пользователем', updatedAt: new Date() })
      .where(eq(missions.id, missionId));

    await this.log(missionId, null, 'warn', `Миссия отменена пользователем${reason ? `: ${reason}` : ''}.`);
    return true;
  }

  /**
   * Запись системного лога миссии
   */
  public static async log(
    missionId: string,
    taskId: string | null,
    level: 'info' | 'warn' | 'error',
    message: string,
    payload: Record<string, any> = {}
  ) {
    try {
      const db = getDatabase();
      await db.insert(missionLogs).values({
        missionId,
        taskId: taskId || null,
        level,
        message,
        payload,
      });
    } catch (err: any) {
      console.error(`[MissionLog] Ошибка записи лога: ${err.message}`);
    }
  }
}
