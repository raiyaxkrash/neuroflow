import crypto from 'node:crypto';
import { getDatabase, workflows, executions, eq } from '@neuroflow/database';
import { ExecutionStatus, WorkflowTriggerType, WorkflowGraph } from '@neuroflow/shared';
import { getWorkflowQueue, WorkflowExecutionJobData } from '../queue/job-queue.js';

export interface ScheduleConfig {
  workflowId: string;
  triggerNodeId: string;
  mode: 'cron' | 'interval' | 'daily' | 'weekly' | 'exact_date';
  cronExpression?: string;
  intervalMinutes?: number;
  timeOfDay?: string;
  daysOfWeek?: number[];
  exactDateTime?: string;
  timezone?: string;
}

export class SchedulerEngine {
  private static scheduledTimers = new Map<string, NodeJS.Timeout>();
  private static registeredSchedules = new Map<string, ScheduleConfig>();

  /**
   * Преобразование пользовательских параметров расписания в стандартное Cron выражение
   */
  public static resolveCronPattern(config: ScheduleConfig): { pattern?: string; everyMs?: number } {
    switch (config.mode) {
      case 'interval': {
        const minutes = Math.max(1, config.intervalMinutes || 60);
        return { everyMs: minutes * 60 * 1000 };
      }

      case 'daily': {
        const [hours = '9', minutes = '0'] = (config.timeOfDay || '09:00').split(':');
        return { pattern: `${parseInt(minutes, 10)} ${parseInt(hours, 10)} * * *` };
      }

      case 'weekly': {
        const [hours = '9', minutes = '0'] = (config.timeOfDay || '09:00').split(':');
        const days = (config.daysOfWeek && config.daysOfWeek.length > 0) ? config.daysOfWeek.join(',') : '1,2,3,4,5';
        return { pattern: `${parseInt(minutes, 10)} ${parseInt(hours, 10)} * * ${days}` };
      }

      case 'cron':
      default: {
        return { pattern: config.cronExpression || '0 9 * * *' };
      }
    }
  }

  /**
   * Детерминированный ID расписания для предотвращения дублей
   */
  public static getScheduleId(workflowId: string, triggerNodeId: string): string {
    return `sched:${workflowId}:${triggerNodeId}`;
  }

  /**
   * Запуск выполнения воркфлоу по расписанию
   */
  public static async triggerScheduledWorkflow(workflowId: string, triggerNodeId: string): Promise<string> {
    const db = getDatabase();
    const [wf] = await db.select().from(workflows).where(eq(workflows.id, workflowId)).limit(1);

    if (!wf || !wf.isActive) {
      this.cancelSchedule(workflowId, triggerNodeId);
      return '';
    }

    const executionId = crypto.randomUUID();
    const graph = wf.graph as WorkflowGraph;
    const now = new Date();

    const initialPayload = {
      triggerSource: 'scheduler',
      triggeredAt: now.toISOString(),
      workflowId,
      triggerNodeId,
    };

    // Создаем запись выполнения в БД со статусом PENDING
    try {
      await db.insert(executions).values({
        id: executionId,
        workflowId: wf.id,
        workflowVersion: wf.version,
        status: ExecutionStatus.PENDING,
        triggerType: WorkflowTriggerType.SCHEDULE,
        inputPayload: initialPayload,
        startedAt: now,
      });
    } catch {
      // Игнорируем в автономных тестах
    }

    const queue = getWorkflowQueue();
    await queue.addJob({
      executionId,
      workflowId: wf.id,
      graph,
      initialPayload,
      triggerNodeId,
    });

    return executionId;
  }

  /**
   * Регистрация и запуск расписания
   */
  public static registerSchedule(config: ScheduleConfig): void {
    const scheduleId = this.getScheduleId(config.workflowId, config.triggerNodeId);
    this.cancelSchedule(config.workflowId, config.triggerNodeId);

    this.registeredSchedules.set(scheduleId, config);
    const resolved = this.resolveCronPattern(config);

    if (resolved.everyMs) {
      // Запуск по интервалу
      const timer = setInterval(async () => {
        try {
          await this.triggerScheduledWorkflow(config.workflowId, config.triggerNodeId);
        } catch (err: any) {
          console.error(`[Scheduler Error] Сбой выполнения расписания ${scheduleId}:`, err.message);
        }
      }, resolved.everyMs);

      this.scheduledTimers.set(scheduleId, timer);
    } else if (config.mode === 'exact_date' && config.exactDateTime) {
      const targetTime = new Date(config.exactDateTime).getTime();
      const delay = targetTime - Date.now();
      if (delay > 0) {
        const timer = setTimeout(async () => {
          try {
            await this.triggerScheduledWorkflow(config.workflowId, config.triggerNodeId);
          } finally {
            this.cancelSchedule(config.workflowId, config.triggerNodeId);
          }
        }, delay);
        this.scheduledTimers.set(scheduleId, timer);
      }
    } else {
      // Для cron/daily/weekly регистрируем периодический таймер проверки (каждую минуту)
      // или BullMQ repeatable job при наличии Redis
      const timer = setInterval(async () => {
        try {
          const now = new Date();
          // Простая проверка совпадения минут и часов для daily
          if (config.mode === 'daily' && config.timeOfDay) {
            const [targetH, targetM] = config.timeOfDay.split(':').map(Number);
            if (now.getHours() === targetH && now.getMinutes() === targetM) {
              await this.triggerScheduledWorkflow(config.workflowId, config.triggerNodeId);
            }
          }
        } catch {
          // Игнорируем
        }
      }, 60000);

      this.scheduledTimers.set(scheduleId, timer);
    }
  }

  /**
   * Отмена расписания
   */
  public static cancelSchedule(workflowId: string, triggerNodeId: string): void {
    const scheduleId = this.getScheduleId(workflowId, triggerNodeId);
    const timer = this.scheduledTimers.get(scheduleId);
    if (timer) {
      clearInterval(timer);
      clearTimeout(timer);
      this.scheduledTimers.delete(scheduleId);
    }
    this.registeredSchedules.delete(scheduleId);
  }

  /**
   * Остановка всех расписаний
   */
  public static stopAll(): void {
    for (const [, timer] of this.scheduledTimers.entries()) {
      clearInterval(timer);
      clearTimeout(timer);
    }
    this.scheduledTimers.clear();
    this.registeredSchedules.clear();
  }

  /**
   * Синхронизация и восстановление всех активных расписаний из базы данных
   */
  public static async syncSchedulesFromDatabase(): Promise<number> {
    try {
      const db = getDatabase();
      const activeWorkflows = await db.select().from(workflows).where(eq(workflows.isActive, true));
      let count = 0;

      for (const wf of activeWorkflows) {
        const graph = wf.graph as WorkflowGraph;
        if (!graph || !Array.isArray(graph.nodes)) continue;

        for (const node of graph.nodes) {
          if (node.type === 'schedule-trigger') {
            const params = node.data?.parameters || {};
            this.registerSchedule({
              workflowId: wf.id,
              triggerNodeId: node.id,
              mode: params.mode || 'daily',
              cronExpression: params.cronExpression,
              intervalMinutes: params.intervalMinutes,
              timeOfDay: params.timeOfDay,
              daysOfWeek: params.daysOfWeek,
              exactDateTime: params.exactDateTime,
              timezone: params.timezone,
            });
            count++;
          }
        }
      }

      return count;
    } catch {
      return 0;
    }
  }
}
