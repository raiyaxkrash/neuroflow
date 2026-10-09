import { BaseNodeDef, NodeExecutionContext, NodeExecutionOutput } from '../base.js';
import { NodeCategory, WorkflowPortDefinition } from '@neuroflow/shared';
import { SetDataParametersSchema } from '@neuroflow/shared';

function getNestedValue(obj: any, path: string): any {
  if (!obj || typeof obj !== 'object' || !path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

function setNestedValue(obj: any, path: string, value: any): void {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * Безопасная замена плейсхолдеров типа {{field.name}} значениями из входных данных
 */
function interpolateString(template: string, data: any): string {
  if (typeof template !== 'string') return template;
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, path) => {
    const val = getNestedValue(data, path);
    if (val !== undefined && val !== null) {
      return typeof val === 'object' ? JSON.stringify(val) : String(val);
    }
    return '';
  });
}

export class SetDataNode extends BaseNodeDef {
  type = 'set-data';
  name = 'Set Data';
  description = 'Создание, трансформация и модификация JSON полей';
  category = NodeCategory.DATA;
  icon = 'Database';
  color = '#10B981';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Входящие данные для модификации' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Output', type: 'main', description: 'Результирующие обновленные данные' },
  ];

  parameterSchema = SetDataParametersSchema;
  defaultParameters = {
    operations: [
      {
        targetKey: 'user.role',
        sourceValue: 'admin',
        valueType: 'string',
      },
    ],
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const inputData = context.inputData || {};

    // Клонируем исходный объект данных
    const resultData = JSON.parse(JSON.stringify(inputData));
    const operations = Array.isArray(params.operations) ? params.operations : [];

    for (const op of operations) {
      const targetKey = op.targetKey?.trim();
      if (!targetKey) continue;

      let finalValue: any = op.sourceValue;

      switch (op.valueType) {
        case 'number':
          finalValue = Number(op.sourceValue);
          break;

        case 'boolean':
          finalValue = op.sourceValue === true || op.sourceValue === 'true' || op.sourceValue === 1;
          break;

        case 'json':
          if (typeof op.sourceValue === 'string') {
            try {
              finalValue = JSON.parse(op.sourceValue);
            } catch {
              finalValue = op.sourceValue;
            }
          }
          break;

        case 'expression':
          // Безопасное извлечение значения по пути из входных данных
          if (typeof op.sourceValue === 'string') {
            const cleanPath = op.sourceValue.replace(/^\{\{|\}\}$/g, '').trim();
            const extracted = getNestedValue(inputData, cleanPath);
            finalValue = extracted !== undefined ? extracted : interpolateString(op.sourceValue, inputData);
          }
          break;

        case 'string':
        default:
          if (typeof op.sourceValue === 'string') {
            finalValue = interpolateString(op.sourceValue, inputData);
          } else {
            finalValue = op.sourceValue;
          }
          break;
      }

      setNestedValue(resultData, targetKey, finalValue);
    }

    return {
      outputData: resultData,
      selectedPort: 'main',
    };
  }
}
