import { describe, it, expect, beforeAll } from 'vitest';
import {
  initDatabase,
  getDatabase,
  users,
  missions,
  missionTasks,
  eq,
} from '@neuroflow/database';
import {
  MissionOrchestrator,
  ResultVerifier,
  SelfCorrectionService,
  TelegramMissionControl,
} from '@neuroflow/mission-engine';
import { MissionStatus, MissionTaskStatus } from '@neuroflow/shared';

describe('Mission Orchestrator & Execution Lifecycle', () => {
  let userId: string;

  beforeAll(async () => {
    await initDatabase();
    const db = getDatabase();

    const [u] = await db
      .insert(users)
      .values({
        email: `mission-tester-${Date.now()}@neuroflow.local`,
        passwordHash: 'test-hash',
        role: 'owner',
      })
      .returning();
    userId = u.id;
  });

  it('должен успешно создавать миссию и сохранять подзадачи в БД', async () => {
    const mission = await MissionOrchestrator.createMission(userId, {
      goal: 'Провести аудит безопасности веб-сервиса',
      title: 'Аудит безопасности',
      tokenBudget: 30000,
    });

    expect(mission.id).toBeDefined();
    expect(mission.status).toBe(MissionStatus.READY);

    const db = getDatabase();
    const tasks = await db
      .select()
      .from(missionTasks)
      .where(eq(missionTasks.missionId, mission.id));

    expect(tasks.length).toBeGreaterThanOrEqual(2);
    expect(tasks.every((t) => t.status === MissionTaskStatus.PENDING)).toBe(true);
  });

  it('должен выполнять этапы миссии и завершать ее со статусом COMPLETED', async () => {
    const mission = await MissionOrchestrator.createMission(userId, {
      goal: 'Быстрый сбор метрик системы',
      title: 'Сбор метрик',
      tokenBudget: 50000,
    });

    const result = await MissionOrchestrator.startMission(mission.id);
    expect(result.success).toBe(true);
    expect(result.status).toBe(MissionStatus.COMPLETED);

    const db = getDatabase();
    const [updated] = await db
      .select()
      .from(missions)
      .where(eq(missions.id, mission.id))
      .limit(1);

    expect(updated.status).toBe(MissionStatus.COMPLETED);
    expect(updated.finalResult).toBeDefined();
    expect(updated.tokensUsed).toBeGreaterThan(0);
  });

  it('должен останавливать выполнение при превышении бюджета токенов', async () => {
    // Устанавливаем крошечный бюджет токенов (100)
    const mission = await MissionOrchestrator.createMission(userId, {
      goal: 'Длительная аналитическая задача с маленьким бюджетом',
      tokenBudget: 100,
    });

    // Имитируем расход токенов до старта
    const db = getDatabase();
    await db
      .update(missions)
      .set({ tokensUsed: 150 })
      .where(eq(missions.id, mission.id));

    const result = await MissionOrchestrator.startMission(mission.id);
    expect(result.status).toBe(MissionStatus.PAUSED);

    const [paused] = await db
      .select()
      .from(missions)
      .where(eq(missions.id, mission.id));
    expect(paused.status).toBe(MissionStatus.PAUSED);
    expect(paused.error).toContain('Лимит бюджета токенов исчерпан');
  });

  it('должен требовать подтверждения человека для чувствительных действий (Human-in-the-Loop)', async () => {
    const mission = await MissionOrchestrator.createMission(userId, {
      goal: 'Удалить устаревшие файлы резервных копий',
      title: 'Удаление бэкапов',
    });

    // Первая задача в детерминированном плане имеет title "Сбор контекста...",
    // сделаем вторую задачу явно чувствительной
    const db = getDatabase();
    const tasks = await db
      .select()
      .from(missionTasks)
      .where(eq(missionTasks.missionId, mission.id));

    // Назначаем первой задаче требование подтверждения
    await db
      .update(missionTasks)
      .set({ inputData: { requiresApproval: true } })
      .where(eq(missionTasks.id, tasks[0].id));

    const res = await MissionOrchestrator.startMission(mission.id);
    expect(res.status).toBe(MissionStatus.WAITING_FOR_APPROVAL);

    // Подтверждаем действие
    const approved = await MissionOrchestrator.approveTask(mission.id, tasks[0].id);
    expect(approved).toBe(true);
  });

  it('ResultVerifier должен независимо проверять критерии готовности', () => {
    // 1. Проверка non_empty_string
    const textValid = ResultVerifier.verifyTaskOutput(
      { content: 'Это подробный аналитический отчет с достаточной длиной содержимого.' },
      [{ id: 'c1', description: 'Непустой отчет', expectedType: 'non_empty_string' }]
    );
    expect(textValid.passed).toBe(true);

    const textInvalid = ResultVerifier.verifyTaskOutput(
      { content: '' },
      [{ id: 'c1', description: 'Непустой отчет', expectedType: 'non_empty_string' }]
    );
    expect(textInvalid.passed).toBe(false);

    // 2. Проверка json_match с обязательными ключами
    const jsonValid = ResultVerifier.verifyTaskOutput(
      { summary: 'ok', score: 100 },
      [{ id: 'c2', description: 'JSON с полями', expectedType: 'json_match', target: 'summary,score' }]
    );
    expect(jsonValid.passed).toBe(true);

    const jsonMissing = ResultVerifier.verifyTaskOutput(
      { summary: 'ok' },
      [{ id: 'c2', description: 'JSON с полями', expectedType: 'json_match', target: 'summary,score' }]
    );
    expect(jsonMissing.passed).toBe(false);
  });

  it('SelfCorrectionService должен вырабатывать стратегию повтора и останавливаться при исчерпании лимита', () => {
    const task: any = {
      title: 'Анализ логов',
      retryCount: 1,
      maxRetries: 3,
      inputData: {},
    };

    const correction1 = SelfCorrectionService.analyzeFailure(task, {
      error: 'Временный сбой сетевого соединения',
    });
    expect(correction1.canRetry).toBe(true);
    expect(correction1.strategy).toBe('retry_with_guidance');

    // Исчерпан лимит
    task.retryCount = 3;
    const correctionLimit = SelfCorrectionService.analyzeFailure(task, {
      error: 'Сбой продолжается',
    });
    expect(correctionLimit.canRetry).toBe(false);
    expect(correctionLimit.strategy).toBe('escalate_failure');
  });

  it('TelegramMissionControl должен корректно обрабатывать команды владельца', async () => {
    const resp = await TelegramMissionControl.handleCommand('/missions', '123456');
    expect(resp).toContain('Список автономных миссий');

    // Попытка неавторизованного доступа
    const denied = await TelegramMissionControl.handleCommand(
      '/missions',
      '999999',
      { allowedUserIds: ['123456'] }
    );
    expect(denied).toContain('Доступ запрещен');
  });
});
