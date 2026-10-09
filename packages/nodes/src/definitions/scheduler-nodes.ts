import { BaseNodeDef, NodeExecutionContext, NodeExecutionOutput } from '../base.js';
import {
  NodeCategory,
  WorkflowPortDefinition,
  ScheduleTriggerParametersSchema,
  WebhookTriggerParametersSchema,
} from '@neuroflow/shared';
import crypto from 'node:crypto';

// 1. Schedule Trigger Node
export class ScheduleTriggerNode extends BaseNodeDef {
  type = 'schedule-trigger';
  name = 'Schedule Trigger';
  description = 'Запуск воркфлоу по расписанию: Cron, ежедневные/еженедельные интервалы, точное время с учетом часового пояса';
  category = NodeCategory.TRIGGER;
  icon = 'Clock';
  color = '#8B5CF6';

  inputs: WorkflowPortDefinition[] = [];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Trigger Event', type: 'main', description: 'Данные момента запуска' },
  ];

  parameterSchema = ScheduleTriggerParametersSchema;
  defaultParameters = {
    mode: 'daily' as const,
    cronExpression: '0 9 * * *',
    intervalMinutes: 60,
    timeOfDay: '09:00',
    daysOfWeek: [1, 2, 3, 4, 5],
    timezone: 'Europe/Moscow',
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const input = (context as any).inputData ?? (context as any).input ?? {};
    const params = context.parameters || {};

    const now = new Date();
    const payload = {
      triggerMode: params.mode || this.defaultParameters.mode,
      timezone: params.timezone || this.defaultParameters.timezone,
      cronExpression: params.cronExpression,
      intervalMinutes: params.intervalMinutes,
      triggeredAt: input.triggeredAt || now.toISOString(),
      scheduledTime: input.scheduledTime || now.toISOString(),
      executionTimestamp: now.getTime(),
    };

    context.log?.(`[Scheduler] Воркфлоу сработал по расписанию (${payload.triggerMode}) в ${payload.triggeredAt}`);

    return {
      outputData: payload,
      output: payload,
      selectedPort: 'main',
    };
  }
}

// 2. Webhook Trigger Node
export class WebhookTriggerNode extends BaseNodeDef {
  type = 'webhook-trigger';
  name = 'Webhook Trigger';
  description = 'Универсальный эндпоинт для приема входящих HTTP запросов (GET/POST) с проверкой HMAC/Bearer аутентификации';
  category = NodeCategory.TRIGGER;
  icon = 'Webhook';
  color = '#EC4899';

  inputs: WorkflowPortDefinition[] = [];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Webhook Request', type: 'main', description: 'Тело запроса, query параметры и заголовки' },
  ];

  parameterSchema = WebhookTriggerParametersSchema;
  defaultParameters = {
    httpMethod: 'POST' as const,
    authType: 'none' as const,
    hmacHeader: 'x-signature',
    responseStatus: 200,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const input = (context as any).inputData ?? (context as any).input ?? {};
    const params = context.parameters || {};

    const method = input.method || 'POST';
    const expectedMethod = params.httpMethod || this.defaultParameters.httpMethod;

    if (expectedMethod !== 'ANY' && method.toUpperCase() !== expectedMethod.toUpperCase()) {
      throw new Error(`[Webhook Trigger] Метод запроса ${method} не разрешен (ожидался ${expectedMethod}).`);
    }

    // Проверка авторизации (Bearer или HMAC)
    if (params.authType === 'bearer' && params.authSecret) {
      const authHeader = input.headers?.['authorization'] || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (token !== params.authSecret) {
        throw new Error('[Webhook Trigger] Ошибка авторизации: неверный Bearer Token.');
      }
    } else if (params.authType === 'hmac' && params.authSecret) {
      const headerName = (params.hmacHeader || 'x-signature').toLowerCase();
      const signature = input.headers?.[headerName];
      const rawPayload = input.rawBody || JSON.stringify(input.body || {});

      if (!signature) {
        throw new Error(`[Webhook Trigger] Отсутствует заголовок подписи ${headerName}.`);
      }

      const hmac = crypto.createHmac('sha256', params.authSecret);
      hmac.update(rawPayload);
      const calculatedSig = hmac.digest('hex');

      if (signature !== calculatedSig && signature !== `sha256=${calculatedSig}`) {
        throw new Error('[Webhook Trigger] Недействительная HMAC подпись запроса.');
      }
    }

    const payload = {
      body: input.body || {},
      query: input.query || {},
      headers: input.headers || {},
      method,
      ip: input.ip,
      receivedAt: new Date().toISOString(),
      customResponse: params.customResponse || { status: 'success' },
    };

    context.log?.(`[Webhook] Получен входящий запрос ${method} (размер body: ${JSON.stringify(payload.body).length} байт)`);

    return {
      outputData: payload,
      output: payload,
      selectedPort: 'main',
    };
  }
}
