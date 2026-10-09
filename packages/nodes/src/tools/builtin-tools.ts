import { validateUrlForSSRF } from '../security/ssrf-guard.js';
import { BrowserSessionManager } from '../browser/browser-session-manager.js';
import { BrowserEngine } from '../browser/browser-engine.js';

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Безопасный калькулятор без использования eval / Function.
 * Парсит и вычисляет базовые математические выражения.
 */
export function safeCalculate(expression: string): number {
  if (typeof expression !== 'string') {
    throw new Error('Выражение должно быть строкой.');
  }

  // Очистка от пробелов
  const expr = expression.replace(/\s+/g, '');
  if (!expr) {
    throw new Error('Пустое выражение для калькулятора.');
  }

  // Разрешаем только цифры, точки, скобки и базовые арифметические операторы
  if (!/^[0-9+\-*/().^%]+$/.test(expr)) {
    throw new Error(`Выражение содержит недопустимые символы: "${expression}"`);
  }

  // Простой парсер с рекурсивным спуском
  let pos = 0;

  function peek(): string {
    return expr[pos] || '';
  }

  function get(): string {
    return expr[pos++] || '';
  }

  function parseNumber(): number {
    let start = pos;
    if (peek() === '-') {
      get();
    }
    while (peek() >= '0' && peek() <= '9') {
      get();
    }
    if (peek() === '.') {
      get();
      while (peek() >= '0' && peek() <= '9') {
        get();
      }
    }
    const str = expr.slice(start, pos);
    const num = Number(str);
    if (isNaN(num)) {
      throw new Error(`Некорректное число: "${str}"`);
    }
    return num;
  }

  function parseFactor(): number {
    if (peek() === '(') {
      get(); // consume '('
      const val = parseExpression();
      if (peek() !== ')') {
        throw new Error('Ожидалась закрывающая скобка ")"');
      }
      get(); // consume ')'
      return val;
    }
    return parseNumber();
  }

  function parsePower(): number {
    let left = parseFactor();
    while (peek() === '^') {
      get();
      const right = parseFactor();
      left = Math.pow(left, right);
    }
    return left;
  }

  function parseTerm(): number {
    let left = parsePower();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = get();
      const right = parsePower();
      if (op === '*') left *= right;
      else if (op === '/') {
        if (right === 0) throw new Error('Деление на ноль.');
        left /= right;
      } else if (op === '%') {
        if (right === 0) throw new Error('Деление по модулю на ноль.');
        left %= right;
      }
    }
    return left;
  }

  function parseExpression(): number {
    let left = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = get();
      const right = parseTerm();
      if (op === '+') left += right;
      else if (op === '-') left -= right;
    }
    return left;
  }

  const result = parseExpression();
  if (pos < expr.length) {
    throw new Error(`Неожиданный символ в позиции ${pos}: "${expr[pos]}"`);
  }

  return result;
}

export interface BuiltInToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  handler: (args: Record<string, any>, context?: any) => Promise<any>;
}

export const BUILT_IN_TOOLS: BuiltInToolDefinition[] = [
  {
    name: 'calculator',
    description: 'Выполняет безопасные математические вычисления (сложение, вычитание, умножение, деление, степени, скобки).',
    inputSchema: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Математическое выражение для вычисления (например, "((15 * 4) + 12) / 2").',
        },
      },
      required: ['expression'],
    },
    handler: async (args) => {
      const expr = args.expression;
      if (!expr || typeof expr !== 'string') {
        throw new Error('Параметр expression обязателен для calculator.');
      }
      const val = safeCalculate(expr);
      return { expression: expr, result: val };
    },
  },
  {
    name: 'web_fetch',
    description: 'Выполняет безопасный HTTP GET запрос к внешнему ресурсу с валидацией SSRF и извлечением контента.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL адрес страницы или API (например, "https://api.github.com").',
        },
        format: {
          type: 'string',
          description: 'Формат ответа: "json" или "text". По умолчанию "json".',
        },
      },
      required: ['url'],
    },
    handler: async (args) => {
      const { url, format = 'json' } = args;
      if (!url || typeof url !== 'string') {
        throw new Error('Параметр url обязателен для web_fetch.');
      }

      const validatedUrl = await validateUrlForSSRF(url);

      let currentUrl = validatedUrl.toString();
      let response: Response | null = null;
      let redirectCount = 0;
      const maxRedirects = 5;

      while (redirectCount <= maxRedirects) {
        response = await fetch(currentUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'NeuroFlow-Agent/1.0',
            Accept: 'application/json, text/plain, */*',
          },
          redirect: 'manual',
        });

        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const locationHeader = response.headers.get('location');
          if (!locationHeader) break;
          redirectCount++;
          const nextUrl = new URL(locationHeader, currentUrl).toString();
          const validatedNext = await validateUrlForSSRF(nextUrl);
          currentUrl = validatedNext.toString();
          continue;
        }
        break;
      }

      if (!response) {
        throw new Error('Не удалось получить ответ сервера.');
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (format === 'text') {
        const text = await response.text();
        return { status: response.status, data: text.slice(0, 100000) }; // Ограничение размера
      }

      try {
        const json = await response.json();
        return { status: response.status, data: json };
      } catch {
        const text = await response.text();
        return { status: response.status, data: text.slice(0, 100000) };
      }
    },
  },
  {
    name: 'json_processor',
    description: 'Обрабатывает, фильтрует или извлекает поля из JSON структуры по точечному пути (dot-notation).',
    inputSchema: {
      type: 'object',
      properties: {
        json: {
          description: 'Исходный JSON объект или валидная JSON строка.',
        },
        path: {
          type: 'string',
          description: 'Путь к свойству, например "user.profile.emails[0]" или "items.total".',
        },
      },
      required: ['json', 'path'],
    },
    handler: async (args) => {
      let data = args.json;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          throw new Error('Входные данные json не являются корректным JSON.');
        }
      }

      const pathStr = args.path;
      if (!pathStr || typeof pathStr !== 'string') {
        return { result: data };
      }

      const parts = pathStr.split('.').flatMap((p) => {
        // Поддержка foo[0] -> foo, 0
        const m = p.match(/^([^\[]+)\[(\d+)\]$/);
        if (m) {
          return [m[1], m[2]];
        }
        return [p];
      });

      let current = data;
      for (const part of parts) {
        if (current === null || current === undefined) {
          current = undefined;
          break;
        }
        current = current[part];
      }

      return { path: pathStr, result: current };
    },
  },
  {
    name: 'browser_navigate',
    description: 'Открывает веб-сайт в браузере Playwright. Возвращает sessionId, текущий URL и заголовок страницы.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL адрес страницы' },
        sessionId: { type: 'string', description: 'Опциональный ID существующей сессии' },
        allowLocalhost: { type: 'boolean', description: 'Разрешить доступ к localhost (по умолчанию false)' },
      },
      required: ['url'],
    },
    handler: async (args) => {
      const manager = BrowserSessionManager.getInstance();
      const engine = new BrowserEngine();
      let sessionId = args.sessionId;

      if (!sessionId || !manager.getSession(sessionId)) {
        const session = await manager.createSession({
          allowLocalhost: !!args.allowLocalhost,
        });
        sessionId = session.id;
      }

      const result = await engine.navigate(sessionId, args.url, {
        allowLocalhost: !!args.allowLocalhost,
      });

      return {
        sessionId,
        url: result.url,
        title: result.title,
        status: result.httpStatus,
      };
    },
  },
  {
    name: 'browser_click',
    description: 'Выполняет клик по элементу веб-страницы по CSS селектору.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'ID браузерной сессии' },
        selector: { type: 'string', description: 'CSS/Playwright селектор элемента' },
      },
      required: ['sessionId', 'selector'],
    },
    handler: async (args) => {
      const engine = new BrowserEngine();
      const result = await engine.click(args.sessionId, args.selector);
      return result;
    },
  },
  {
    name: 'browser_type',
    description: 'Вводит текст в поле формы на веб-странице.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'ID браузерной сессии' },
        selector: { type: 'string', description: 'CSS селектор поля ввода' },
        text: { type: 'string', description: 'Текст для ввода' },
        pressEnter: { type: 'boolean', description: 'Нажать ли клавишу Enter после ввода' },
      },
      required: ['sessionId', 'selector', 'text'],
    },
    handler: async (args) => {
      const engine = new BrowserEngine();
      const result = await engine.type(args.sessionId, args.selector, args.text, {
        pressEnter: !!args.pressEnter,
      });
      return result;
    },
  },
  {
    name: 'browser_extract',
    description: 'Извлекает текст, HTML-таблицу или элементы с веб-страницы.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'ID браузерной сессии' },
        selector: { type: 'string', description: 'CSS селектор (по умолчанию body)' },
        extractType: {
          type: 'string',
          enum: ['text', 'html', 'table', 'all_elements'],
          description: 'Тип извлечения (text, table, all_elements)',
        },
      },
      required: ['sessionId'],
    },
    handler: async (args) => {
      const engine = new BrowserEngine();
      const result = await engine.extract(args.sessionId, args.selector || 'body', {
        extractType: args.extractType || 'text',
      });
      return result;
    },
  },
  {
    name: 'browser_screenshot',
    description: 'Создает скриншот веб-страницы в формате base64.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'ID браузерной сессии' },
        fullPage: { type: 'boolean', description: 'Снимок всей страницы' },
      },
      required: ['sessionId'],
    },
    handler: async (args) => {
      const engine = new BrowserEngine();
      const result = await engine.screenshot(args.sessionId, {
        fullPage: !!args.fullPage,
      });
      return {
        sessionId: args.sessionId,
        sizeBytes: result.sizeBytes,
        mimeType: result.mimeType,
        base64Length: result.base64.length,
      };
    },
  },
  {
    name: 'browser_close',
    description: 'Закрывает сессию браузера и освобождает оперативную память.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'ID браузерной сессии' },
      },
      required: ['sessionId'],
    },
    handler: async (args) => {
      const manager = BrowserSessionManager.getInstance();
      const closed = await manager.closeSession(args.sessionId);
      return { sessionId: args.sessionId, closed };
    },
  },
];

