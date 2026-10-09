import {
  getDatabase,
  missions,
  missionTasks,
  eq,
  desc,
} from '@neuroflow/database';
import { MissionStatus, MissionTaskStatus } from '@neuroflow/shared';
import { MissionOrchestrator } from '../orchestrator/mission-orchestrator.js';

export interface TelegramMissionControlOptions {
  allowedUserIds?: (string | number)[];
  ownerTelegramId?: string | number;
}

export class TelegramMissionControl {
  /**
   * Проверка прав доступа отправителя Telegram команды
   */
  public static isAuthorized(
    fromId: string | number | undefined,
    options?: TelegramMissionControlOptions
  ): boolean {
    if (!fromId) return false;

    const allowed = options?.allowedUserIds || [];
    const ownerId = options?.ownerTelegramId || process.env.TELEGRAM_OWNER_ID;

    const allowedList = [...allowed.map(String)];
    if (ownerId) {
      allowedList.push(String(ownerId));
    }

    // Если список разрешенных ID пуст в локальном окружении, разрешаем
    if (allowedList.length === 0) {
      return true;
    }

    return allowedList.includes(String(fromId));
  }

  /**
   * Обработка команды Telegram для управления миссиями
   */
  public static async handleCommand(
    commandText: string,
    fromId: string | number | undefined,
    options?: TelegramMissionControlOptions
  ): Promise<string> {
    if (!this.isAuthorized(fromId, options)) {
      return '⛔ Доступ запрещен. Управление автономными миссиями доступно только владельцу системы.';
    }

    const trimmed = (commandText || '').trim();
    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts[1];

    const db = getDatabase();

    switch (cmd) {
      case '/missions': {
        const all = await db
          .select()
          .from(missions)
          .orderBy(desc(missions.createdAt))
          .limit(10);

        if (all.length === 0) {
          return '📭 Список миссий пуст. Создайте новую автономную миссию через веб-интерфейс.';
        }

        let resp = `🎯 *Список автономных миссий NeuroFlow:*\n\n`;
        for (const m of all) {
          const statusIcon =
            m.status === MissionStatus.COMPLETED ? '✅' :
            m.status === MissionStatus.RUNNING ? '⚡' :
            m.status === MissionStatus.PAUSED ? '⏸️' :
            m.status === MissionStatus.WAITING_FOR_APPROVAL ? '⚠️' :
            m.status === MissionStatus.FAILED ? '❌' : '⏳';

          resp += `${statusIcon} *${m.title}*\n`;
          resp += `• ID: \`${m.id}\`\n`;
          resp += `• Статус: *${m.status}* | Токены: ${m.tokensUsed} / ${m.tokenBudget}\n\n`;
        }
        resp += `_Команды:_ \`/mission_status <id>\`, \`/mission_pause <id>\`, \`/mission_resume <id>\`, \`/mission_cancel <id>\``;
        return resp;
      }

      case '/mission_status': {
        if (!arg) {
          return '⚠️ Пожалуйста, укажите ID миссии: `/mission_status <missionId>`';
        }

        const [m] = await db
          .select()
          .from(missions)
          .where(eq(missions.id, arg))
          .limit(1);

        if (!m) {
          return `❌ Миссия с ID \`${arg}\` не найдена.`;
        }

        const tasks = await db
          .select()
          .from(missionTasks)
          .where(eq(missionTasks.missionId, arg));

        const completed = tasks.filter((t: any) => t.status === MissionTaskStatus.COMPLETED).length;
        const total = tasks.length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        let resp = `📋 *Статус миссии: ${m.title}*\n`;
        resp += `🎯 *Цель:* ${m.goal}\n`;
        resp += `📊 *Прогресс:* ${percent}% (${completed}/${total} этапов)\n`;
        resp += `🚦 *Статус:* ${m.status}\n`;
        resp += `🪙 *Токены:* ${m.tokensUsed} / ${m.tokenBudget}\n\n`;

        resp += `*Этапы миссии:*\n`;
        for (const t of tasks) {
          const icon =
            t.status === MissionTaskStatus.COMPLETED ? '✅' :
            t.status === MissionTaskStatus.RUNNING ? '⚡' :
            t.status === MissionTaskStatus.WAITING_FOR_APPROVAL ? '⚠️' :
            t.status === MissionTaskStatus.FAILED ? '❌' : '⏳';
          resp += `${icon} *${t.title}* [${t.assignedAgent}]: ${t.status}\n`;
        }

        return resp;
      }

      case '/mission_pause': {
        if (!arg) {
          return '⚠️ Пожалуйста, укажите ID миссии: `/mission_pause <missionId>`';
        }
        await MissionOrchestrator.pauseMission(arg, 'Приостановлено через Telegram');
        return `⏸️ Миссия \`${arg}\` успешно приостановлена.`;
      }

      case '/mission_resume': {
        if (!arg) {
          return '⚠️ Пожалуйста, укажите ID миссии: `/mission_resume <missionId>`';
        }
        await MissionOrchestrator.resumeMission(arg);
        return `▶️ Миссия \`${arg}\` возобновлена и переведена в режим выполнения.`;
      }

      case '/mission_cancel': {
        if (!arg) {
          return '⚠️ Пожалуйста, укажите ID миссии: `/mission_cancel <missionId>`';
        }
        await MissionOrchestrator.cancelMission(arg, 'Отменено через Telegram');
        return `🛑 Миссия \`${arg}\` отменена.`;
      }

      default:
        return '❓ Неизвестная команда. Доступные команды: `/missions`, `/mission_status`, `/mission_pause`, `/mission_resume`, `/mission_cancel`';
    }
  }
}
