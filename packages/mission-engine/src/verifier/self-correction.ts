import { MissionTaskDefinition } from '@neuroflow/shared';
import { VerificationResult } from './result-verifier.js';

export interface CorrectionPlan {
  canRetry: boolean;
  strategy: 'retry_with_guidance' | 'switch_agent' | 'escalate_failure';
  reason: string;
  adjustedInputData?: Record<string, any>;
  guidancePrompt?: string;
}

export class SelfCorrectionService {
  /**
   * Анализ сбоя этапа миссии и выработка безопасной стратегии самокоррекции
   */
  public static analyzeFailure(
    task: MissionTaskDefinition & { retryCount: number; maxRetries: number },
    errorOrVerification: { error?: string; verification?: VerificationResult }
  ): CorrectionPlan {
    const currentRetries = task.retryCount || 0;
    const maxRetries = Math.min(task.maxRetries || 3, 3); // Защита: максимум 3 повтора

    if (currentRetries >= maxRetries) {
      return {
        canRetry: false,
        strategy: 'escalate_failure',
        reason: `Исчерпан лимит повторных попыток (${currentRetries}/${maxRetries}). Требуется вмешательство пользователя.`,
      };
    }

    const failedCriteria = errorOrVerification.verification?.details.filter((d) => d.status === 'failed') || [];
    const errorMsg = errorOrVerification.error || '';

    // Формируем четкую подсказку для следующей попытки
    let guidance = `ВНИМАНИЕ: Предыдущая попытка задачи "${task.title}" (попытка ${currentRetries + 1}/${maxRetries}) завершилась неудачей.\n`;

    if (failedCriteria.length > 0) {
      guidance += `Не пройдены следующие критерии готовности:\n`;
      for (const fc of failedCriteria) {
        guidance += `- Критерий: "${fc.description}". Причина отказа: ${fc.message}\n`;
      }
      guidance += `\nТребование: обязательно исправь указанные ошибки. Не завершай шаг, пока фактический результат не будет удовлетворять критериям.`;
    } else if (errorMsg) {
      guidance += `Ошибка выполнения: ${errorMsg}\n`;
      guidance += `Требование: локализуй и устрани причину сбоя, примени альтернативный подход к решению задачи.`;
    }

    const adjustedInput = {
      ...(task.inputData || {}),
      _selfCorrectionAttempt: currentRetries + 1,
      _selfCorrectionGuidance: guidance,
    };

    return {
      canRetry: true,
      strategy: 'retry_with_guidance',
      reason: `Доступна попытка самокоррекции (${currentRetries + 1}/${maxRetries})`,
      adjustedInputData: adjustedInput,
      guidancePrompt: guidance,
    };
  }
}
