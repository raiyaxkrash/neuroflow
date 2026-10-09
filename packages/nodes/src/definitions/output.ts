import { BaseNodeDef, NodeExecutionContext, NodeExecutionOutput } from '../base.js';
import { NodeCategory, WorkflowPortDefinition } from '@neuroflow/shared';
import { OutputParametersSchema } from '@neuroflow/shared';

export class OutputNode extends BaseNodeDef {
  type = 'output';
  name = 'Output';
  description = 'Фиксация и форматирование конечного результата ветки';
  category = NodeCategory.DATA;
  icon = 'CheckCircle2';
  color = '#10B981';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Данные для вывода' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Output', type: 'main', description: 'Финальный результат' },
  ];

  parameterSchema = OutputParametersSchema;
  defaultParameters = {
    includeInputs: true,
    customKey: '',
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const inputData = context.inputData || {};
    const customKey = params.customKey?.trim();

    let finalOutput: any;
    if (customKey) {
      finalOutput = {
        [customKey]: inputData,
        capturedAt: new Date().toISOString(),
      };
    } else {
      finalOutput = {
        result: inputData,
        capturedAt: new Date().toISOString(),
      };
    }

    return {
      outputData: finalOutput,
      selectedPort: 'main',
    };
  }
}
