import fs from 'node:fs';
import path from 'node:path';
import { MissionTaskCriteria } from '@neuroflow/shared';

export interface VerificationDetail {
  criterionId: string;
  description: string;
  status: 'passed' | 'failed';
  message: string;
}

export interface VerificationResult {
  passed: boolean;
  details: VerificationDetail[];
  summary: string;
}

export class ResultVerifier {
  /**
   * Независимая верификация результатов выполнения задачи миссии
   */
  public static verifyTaskOutput(
    outputData: any,
    criteria: MissionTaskCriteria[]
  ): VerificationResult {
    if (!criteria || criteria.length === 0) {
      // Если критерии не заданы, базовое требование — результат не должен быть пустым/ошибочным
      const hasContent = outputData !== null && outputData !== undefined && Object.keys(outputData).length > 0;
      return {
        passed: hasContent,
        details: [
          {
            criterionId: 'default_presence',
            description: 'Базовое наличие выходных данных задачи',
            status: hasContent ? 'passed' : 'failed',
            message: hasContent ? 'Выходные данные получены' : 'Выходные данные отсутствуют или пусты',
          },
        ],
        summary: hasContent ? 'Базовая проверка пройдена' : 'Выходные данные отсутствуют',
      };
    }

    const details: VerificationDetail[] = [];
    let allPassed = true;

    for (const crit of criteria) {
      let isCriterionPassed = false;
      let message = '';

      switch (crit.expectedType) {
        case 'non_empty_string': {
          const val = typeof outputData === 'string' 
            ? outputData 
            : (outputData?.text || outputData?.content || outputData?.result || outputData?.summary);
          
          if (typeof val === 'string' && val.trim().length > 10) {
            isCriterionPassed = true;
            message = `Текстовый результат валиден (длина: ${val.trim().length} символов)`;
          } else {
            isCriterionPassed = false;
            message = `Ожидалась непустая текстовая строка, получено: ${typeof val === 'string' ? `пустая строка (длина ${val.trim().length})` : String(val)}`;
          }
          break;
        }

        case 'file_exists': {
          const filePath = crit.target || outputData?.filePath || outputData?.path;
          if (!filePath || typeof filePath !== 'string') {
            isCriterionPassed = false;
            message = 'Путь к файлу не указан в критерии или выходных данных';
          } else {
            try {
              const resolved = path.resolve(filePath);
              if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
                isCriterionPassed = true;
                message = `Файл успешно найден на диске: ${resolved}`;
              } else {
                isCriterionPassed = false;
                message = `Файл не найден на диске: ${resolved}`;
              }
            } catch (err: any) {
              isCriterionPassed = false;
              message = `Ошибка проверки существования файла: ${err.message}`;
            }
          }
          break;
        }

        case 'json_match': {
          if (typeof outputData === 'object' && outputData !== null && !Array.isArray(outputData)) {
            if (crit.target) {
              // Если указаны обязательные поля через запятую
              const requiredKeys = crit.target.split(',').map((k) => k.trim());
              const missingKeys = requiredKeys.filter((k) => !(k in outputData));
              if (missingKeys.length === 0) {
                isCriterionPassed = true;
                message = `JSON содержит все требуемые поля: ${requiredKeys.join(', ')}`;
              } else {
                isCriterionPassed = false;
                message = `В JSON отсутствуют обязательные поля: ${missingKeys.join(', ')}`;
              }
            } else {
              isCriterionPassed = true;
              message = 'Выходные данные представляют собой валидный JSON объект';
            }
          } else {
            isCriterionPassed = false;
            message = 'Выходные данные не являются JSON объектом';
          }
          break;
        }

        case 'http_success': {
          const statusCode = outputData?.statusCode || outputData?.status;
          if (typeof statusCode === 'number' && statusCode >= 200 && statusCode < 300) {
            isCriterionPassed = true;
            message = `HTTP статус успешный: ${statusCode}`;
          } else {
            isCriterionPassed = false;
            message = `Неуспешный HTTP статус: ${statusCode || 'нет кода статуса'}`;
          }
          break;
        }

        case 'custom':
        default: {
          if (outputData && (outputData.success !== false) && !outputData.error) {
            isCriterionPassed = true;
            message = 'Пользовательский критерий успешно подтвержден';
          } else {
            isCriterionPassed = false;
            message = `Критерий не подтвержден: обнаружен флаг ошибки (${outputData?.error || 'success=false'})`;
          }
          break;
        }
      }

      if (!isCriterionPassed) {
        allPassed = false;
      }

      details.push({
        criterionId: crit.id,
        description: crit.description,
        status: isCriterionPassed ? 'passed' : 'failed',
        message,
      });
    }

    return {
      passed: allPassed,
      details,
      summary: allPassed
        ? `Все критерии готовности (${criteria.length}) успешно подтверждены`
        : `Не пройдено проверок: ${details.filter((d) => d.status === 'failed').length} из ${criteria.length}`,
    };
  }
}
