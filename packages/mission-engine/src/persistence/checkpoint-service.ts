import {
  getDatabase,
  missionCheckpoints,
  missions,
  missionTasks,
  eq,
  desc,
} from '@neuroflow/database';
import { CheckpointType } from '@neuroflow/shared';

export interface MissionStateSnapshot {
  missionId: string;
  missionStatus: string;
  tokensUsed: number;
  tokenBudget: number;
  tasks: Array<{
    id: string;
    taskKey: string;
    title: string;
    status: string;
    inputData: any;
    outputData: any;
    retryCount: number;
    tokensUsed: number;
  }>;
  missionMemory: Record<string, any>;
  timestamp: string;
}

export class CheckpointService {
  /**
   * Сохранение контрольной точки (чекпоинта) состояния миссии в базу данных
   */
  public static async saveCheckpoint(params: {
    missionId: string;
    taskId?: string;
    checkpointType: CheckpointType | string;
    stateSnapshot: MissionStateSnapshot;
  }): Promise<string> {
    const db = getDatabase();

    const [created] = await db
      .insert(missionCheckpoints)
      .values({
        missionId: params.missionId,
        taskId: params.taskId || null,
        checkpointType: params.checkpointType,
        stateSnapshot: params.stateSnapshot,
      })
      .returning({ id: missionCheckpoints.id });

    return created.id;
  }

  /**
   * Получение последней контрольной точки миссии
   */
  public static async getLatestCheckpoint(missionId: string) {
    const db = getDatabase();

    const rows = await db
      .select()
      .from(missionCheckpoints)
      .where(eq(missionCheckpoints.missionId, missionId))
      .orderBy(desc(missionCheckpoints.createdAt))
      .limit(1);

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Список всех чекпоинтов миссии для UI и аудита
   */
  public static async listCheckpoints(missionId: string) {
    const db = getDatabase();

    return db
      .select()
      .from(missionCheckpoints)
      .where(eq(missionCheckpoints.missionId, missionId))
      .orderBy(desc(missionCheckpoints.createdAt));
  }

  /**
   * Формирование актуального слепка состояния миссии из БД
   */
  public static async captureSnapshot(missionId: string, memory: Record<string, any> = {}): Promise<MissionStateSnapshot> {
    const db = getDatabase();

    const [mission] = await db
      .select()
      .from(missions)
      .where(eq(missions.id, missionId))
      .limit(1);

    if (!mission) {
      throw new Error(`Миссия ${missionId} не найдена для создания чекпоинта`);
    }

    const tasks = await db
      .select()
      .from(missionTasks)
      .where(eq(missionTasks.missionId, missionId));

    return {
      missionId,
      missionStatus: mission.status,
      tokensUsed: mission.tokensUsed || 0,
      tokenBudget: mission.tokenBudget || 50000,
      tasks: tasks.map((t: any) => ({
        id: t.id,
        taskKey: t.taskKey,
        title: t.title,
        status: t.status,
        inputData: t.inputData,
        outputData: t.outputData,
        retryCount: t.retryCount,
        tokensUsed: t.tokensUsed,
      })),
      missionMemory: memory,
      timestamp: new Date().toISOString(),
    };
  }
}
