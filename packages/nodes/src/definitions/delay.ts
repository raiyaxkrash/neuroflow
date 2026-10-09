import { BaseNodeDef, NodeExecutionContext, NodeExecutionOutput } from '../base.js';
import { NodeCategory, WorkflowPortDefinition } from '@neuroflow/shared';
import { DelayParametersSchema } from '@neuroflow/shared';

export class DelayNode extends BaseNodeDef {
  type = 'delay';
  name = 'Delay';
  description = 'Асинхронная задержка выполнения без блокирования потока';
  category = NodeCategory.UTILITY;
  icon = 'Clock';
  color = '#6366F1';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Входящие данные' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Output', type: 'main', description: 'Данные после задержки' },
  ];

  parameterSchema = DelayParametersSchema;
  defaultParameters = {
    seconds: 2,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const seconds = Math.min(Math.max(params.seconds || 2, 1), 300);
    const ms = seconds * 1000;

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve();
      }, ms);

      if (context.signal) {
        if (context.signal.aborted) {
          clearTimeout(timer);
          reject(new Error('Выполнение прервано (Cancelled)'));
          return;
        }

        context.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('Выполнение прервано (Cancelled)'));
        }, { once: true });
      }
    });

    return {
      outputData: {
        ...(context.inputData || {}),
        _delay: {
          delayedSeconds: seconds,
          resumedAt: new Date().toISOString(),
        },
      },
      selectedPort: 'main',
    };
  }
}
