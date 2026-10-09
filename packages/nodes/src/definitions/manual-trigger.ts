import { BaseNodeDef, NodeExecutionContext, NodeExecutionOutput } from '../base.js';
import { NodeCategory, WorkflowPortDefinition } from '@neuroflow/shared';
import { ManualTriggerParametersSchema } from '@neuroflow/shared';
import { z } from 'zod';

export class ManualTriggerNode extends BaseNodeDef {
  type = 'manual-trigger';
  name = 'Manual Trigger';
  description = 'Запуск воркфлоу вручную или через API вызов';
  category = NodeCategory.TRIGGER;
  icon = 'Play';
  color = '#8B5CF6';

  inputs: WorkflowPortDefinition[] = [];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Main', type: 'main', description: 'Основной поток выполнения' },
  ];

  parameterSchema = ManualTriggerParametersSchema;
  defaultParameters = {
    initialPayload: {},
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const inputPayload = context.inputData || {};
    const configuredPayload = params.initialPayload || {};

    const mergedData = {
      ...configuredPayload,
      ...inputPayload,
      triggeredAt: new Date().toISOString(),
      triggerMode: 'manual',
    };

    return {
      outputData: mergedData,
      selectedPort: 'main',
    };
  }
}
