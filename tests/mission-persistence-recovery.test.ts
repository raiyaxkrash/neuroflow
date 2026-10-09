import { describe, it, expect, beforeAll } from 'vitest';
import {
  initDatabase,
  getDatabase,
  users,
  missions,
  missionTasks,
  missionCheckpoints,
  eq,
} from '@neuroflow/database';
import {
  MissionOrchestrator,
  CheckpointService,
} from '@neuroflow/mission-engine';
import { MissionStatus, MissionTaskStatus, CheckpointType } from '@neuroflow/shared';

describe('Mission Persistence & Recovery', () => {
  let userId: string;

  beforeAll(async () => {
    await initDatabase();
    const db = getDatabase();

    const [u] = await db
      .insert(users)
      .values({
        email: `persistence-tester-${Date.now()}@neuroflow.local`,
        passwordHash: 'test-hash',
        role: 'owner',
      })
      .returning();
    userId = u.id;
  });

  it('должен фиксировать контрольные точки в БД в процессе жизненного цикла', async () => {
    const mission = await MissionOrchestrator.createMission(userId, {
      goal: 'Тест контрольных точек',
      title: 'Персистентный тест',
    });

    const initialCheckpoints = await CheckpointService.listCheckpoints(mission.id);
    expect(initialCheckpoints.length).toBeGreaterThanOrEqual(1);
    expect(initialCheckpoints[0].checkpointType).toBe(CheckpointType.MANUAL_PAUSE);

    // Запускаем миссию
    await MissionOrchestrator.startMission(mission.id);

    // После завершения должно быть создано несколько чекпоинтов (по завершению каждого шага)
    const afterCheckpoints = await CheckpointService.listCheckpoints(mission.id);
    expect(afterCheckpoints.length).toBeGreaterThan(initialCheckpoints.length);

    // Проверяем содержимое слепка состояния
    const latest = afterCheckpoints[0];
    expect(latest.stateSnapshot).toBeDefined();
    expect((latest.stateSnapshot as any).tasks).toBeDefined();
    expect((latest.stateSnapshot as any).tasks.length).toBeGreaterThan(0);
  });

  it('должен возобновлять выполнение с сохранением статуса completed и не перезапускать выполненные шаги', async () => {
    const mission = await MissionOrchestrator.createMission(userId, {
      goal: 'Тест восстановления после сбоя',
      title: 'Восстановление',
    });

    const db = getDatabase();
    const tasks = await db
      .select()
      .from(missionTasks)
      .where(eq(missionTasks.missionId, mission.id));

    // Имитируем, что первый шаг УЖЕ успешно завершен и имеет выходные данные
    const firstTask = tasks[0];
    await db
      .update(missionTasks)
      .set({
        status: MissionTaskStatus.COMPLETED,
        outputData: { preExistingResult: 'Успешно завершено до аварии' },
        completedAt: new Date(),
      })
      .where(eq(missionTasks.id, firstTask.id));

    // Сохраняем чекпоинт аварийного состояния
    const snap = await CheckpointService.captureSnapshot(mission.id);
    await CheckpointService.saveCheckpoint({
      missionId: mission.id,
      checkpointType: CheckpointType.TASK_COMPLETED,
      stateSnapshot: snap,
    });

    // Запускаем возобновление миссии
    const res = await MissionOrchestrator.startMission(mission.id);
    expect(res.success).toBe(true);
    expect(res.status).toBe(MissionStatus.COMPLETED);

    // Проверяем, что выходные данные первого шага НЕ были перезаписаны
    const [reloadedFirst] = await db
      .select()
      .from(missionTasks)
      .where(eq(missionTasks.id, firstTask.id))
      .limit(1);

    expect((reloadedFirst.outputData as any)?.preExistingResult).toBe('Успешно завершено до аварии');

    // Проверяем, что все остальные задачи также перешли в completed
    const finalTasks = await db
      .select()
      .from(missionTasks)
      .where(eq(missionTasks.missionId, mission.id));

    expect(finalTasks.every((t) => t.status === MissionTaskStatus.COMPLETED)).toBe(true);
  });
});
