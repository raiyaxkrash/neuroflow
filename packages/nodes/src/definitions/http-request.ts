import { BaseNodeDef, NodeExecutionContext, NodeExecutionOutput } from '../base.js';
import { NodeCategory, WorkflowPortDefinition, HttpMethod } from '@neuroflow/shared';
import { HttpRequestParametersSchema } from '@neuroflow/shared';
import { validateUrlForSSRF } from '../security/ssrf-guard.js';

export class HttpRequestNode extends BaseNodeDef {
  type = 'http-request';
  name = 'HTTP Request';
  description = 'Безопасная отправка HTTP/REST запросов с защитой от SSRF';
  category = NodeCategory.ACTION;
  icon = 'Globe';
  color = '#06B6D4';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Входящие данные для запроса' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Response', type: 'main', description: 'Ответ сервера' },
  ];

  parameterSchema = HttpRequestParametersSchema;
  defaultParameters = {
    url: 'https://httpbin.org/get',
    method: HttpMethod.GET,
    headers: {},
    queryParams: {},
    body: null,
    timeoutMs: 10000,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const urlString = params.url || this.defaultParameters.url;
    const method = (params.method || HttpMethod.GET).toUpperCase();
    const timeoutMs = Math.min(params.timeoutMs || 10000, 30000);
    const maxSizeBytes = 5 * 1024 * 1024; // 5 MB max response

    // 1. SSRF защита: валидация хоста, IP и DNS резолва
    const validatedUrl = await validateUrlForSSRF(urlString);

    // Добавляем Query параметры
    if (params.queryParams && typeof params.queryParams === 'object') {
      for (const [key, value] of Object.entries(params.queryParams)) {
        if (value !== undefined && value !== null) {
          validatedUrl.searchParams.append(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      'User-Agent': 'NeuroFlow-Engine/1.0',
      ...(params.headers || {}),
    };

    let bodyData: string | undefined = undefined;
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      if (params.body !== undefined && params.body !== null) {
        if (typeof params.body === 'object') {
          bodyData = JSON.stringify(params.body);
          if (!headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
          }
        } else {
          bodyData = String(params.body);
        }
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Если родительский контекст запросил отмену
    if (context.signal) {
      context.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    const startTime = Date.now();
    try {
      let currentUrl = validatedUrl.toString();
      let response: Response | null = null;
      let redirectCount = 0;
      const maxRedirects = 5;

      while (redirectCount <= maxRedirects) {
        response = await fetch(currentUrl, {
          method,
          headers,
          body: bodyData,
          signal: controller.signal,
          redirect: 'manual', // Ручное следование с проверкой каждого URL
        });

        // Проверка на статус редиректа (301, 302, 303, 307, 308)
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const locationHeader = response.headers.get('location');
          if (!locationHeader) {
            break;
          }

          redirectCount++;
          if (redirectCount > maxRedirects) {
            throw new Error(`Превышено максимальное число перенаправлений (${maxRedirects})`);
          }

          // Резолвим относительные или абсолютные URL
          const resolvedRedirectUrl = new URL(locationHeader, currentUrl).toString();

          // КРИТИЧЕСКИ ВАЖНО: валидируем целевой URL редиректа на SSRF!
          const validatedRedirect = await validateUrlForSSRF(resolvedRedirectUrl);
          currentUrl = validatedRedirect.toString();

          // Для 303 или 302 метод может переключаться на GET без body
          if (response.status === 303 || (response.status === 302 && method !== 'GET')) {
            // switch to GET
          }
          continue;
        }

        break;
      }

      if (!response) {
        throw new Error('Не удалось получить ответ сервера');
      }

      const durationMs = Date.now() - startTime;

      // Проверка размера ответа через Content-Length, если указан
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
        throw new Error(`Размер ответа превышает допустимый лимит (${maxSizeBytes} байт)`);
      }

      const contentType = response.headers.get('content-type') || '';
      let data: any;

      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        if (text.length > maxSizeBytes) {
          throw new Error(`Размер полученных данных превышает лимит (${maxSizeBytes} байт)`);
        }
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      // Собираем заголовки ответа
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        outputData: {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: responseHeaders,
          data,
          durationMs,
        },
        selectedPort: 'main',
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Таймаут HTTP запроса (${timeoutMs}ms)`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
