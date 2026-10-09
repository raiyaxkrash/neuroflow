import { BaseNodeDef, NodeExecutionContext, NodeExecutionOutput } from '../base.js';
import { NodeCategory, WorkflowPortDefinition, ConditionOperator } from '@neuroflow/shared';
import { ConditionParametersSchema } from '@neuroflow/shared';

/**
 * Безопасное получение значения по dot-нотации из объекта
 */
function getValueByPath(obj: any, path: string): any {
  if (!obj || typeof obj !== 'object' || !path) return obj;
  const parts = path.trim().replace(/^\{\{|\}\}$/g, '').split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

export class ConditionNode extends BaseNodeDef {
  type = 'condition';
  name = 'Condition';
  description = 'Условное ветвление потока на ветки True и False';
  category = NodeCategory.LOGIC;
  icon = 'GitBranch';
  color = '#F59E0B';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Входящие данные для проверки' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'true', name: 'True', type: 'true', description: 'Ветка при выполнении условия' },
    { id: 'false', name: 'False', type: 'false', description: 'Ветка при невыполнении условия' },
  ];

  parameterSchema = ConditionParametersSchema;
  defaultParameters = {
    leftValue: 'status',
    operator: ConditionOperator.EQUALS,
    rightValue: 'success',
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const inputData = context.inputData || {};

    const leftKey = String(params.leftValue || '').trim();
    const operator = params.operator || ConditionOperator.EQUALS;
    const rightVal = params.rightValue !== undefined ? params.rightValue : '';

    // Если левое значение является путем к полю во входящих данных
    let resolvedLeft = getValueByPath(inputData, leftKey);
    if (resolvedLeft === undefined && typeof inputData === 'object' && leftKey in inputData) {
      resolvedLeft = inputData[leftKey];
    }
    if (resolvedLeft === undefined) {
      resolvedLeft = leftKey; // Используем как строковый литерал
    }

    let isMatch = false;

    switch (operator) {
      case ConditionOperator.EQUALS:
        isMatch = String(resolvedLeft).toLowerCase() === String(rightVal).toLowerCase();
        break;

      case ConditionOperator.NOT_EQUALS:
        isMatch = String(resolvedLeft).toLowerCase() !== String(rightVal).toLowerCase();
        break;

      case ConditionOperator.CONTAINS:
        isMatch = String(resolvedLeft).toLowerCase().includes(String(rightVal).toLowerCase());
        break;

      case ConditionOperator.NOT_CONTAINS:
        isMatch = !String(resolvedLeft).toLowerCase().includes(String(rightVal).toLowerCase());
        break;

      case ConditionOperator.GREATER_THAN:
        isMatch = Number(resolvedLeft) > Number(rightVal);
        break;

      case ConditionOperator.LESS_THAN:
        isMatch = Number(resolvedLeft) < Number(rightVal);
        break;

      case ConditionOperator.IS_EMPTY:
        isMatch = resolvedLeft === null || resolvedLeft === undefined || resolvedLeft === '' || (Array.isArray(resolvedLeft) && resolvedLeft.length === 0);
        break;

      case ConditionOperator.IS_NOT_EMPTY:
        isMatch = resolvedLeft !== null && resolvedLeft !== undefined && resolvedLeft !== '' && (!Array.isArray(resolvedLeft) || resolvedLeft.length > 0);
        break;

      case ConditionOperator.STARTS_WITH:
        isMatch = String(resolvedLeft).toLowerCase().startsWith(String(rightVal).toLowerCase());
        break;

      case ConditionOperator.ENDS_WITH:
        isMatch = String(resolvedLeft).toLowerCase().endsWith(String(rightVal).toLowerCase());
        break;

      default:
        isMatch = false;
    }

    const selectedPort = isMatch ? 'true' : 'false';

    return {
      outputData: {
        ...inputData,
        _condition: {
          evaluated: true,
          result: isMatch,
          leftValue: resolvedLeft,
          operator,
          rightValue: rightVal,
          branch: selectedPort,
        },
      },
      selectedPort,
    };
  }
}
