import { BaseNodeDef, NodeExecutionContext, NodeExecutionOutput } from '../base.js';
import {
  NodeCategory,
  WorkflowPortDefinition,
  BrowserStartParametersSchema,
  BrowserNavigateParametersSchema,
  BrowserClickParametersSchema,
  BrowserTypeParametersSchema,
  BrowserExtractParametersSchema,
  BrowserScreenshotParametersSchema,
  BrowserWaitParametersSchema,
  BrowserDownloadParametersSchema,
  BrowserCloseParametersSchema,
  AIBrowserAgentParametersSchema,
} from '@neuroflow/shared';
import { BrowserSessionManager } from '../browser/browser-session-manager.js';
import { BrowserEngine } from '../browser/browser-engine.js';
import { AIBrowserAgent } from '../browser/ai-browser-agent.js';
import { AIProviderFactory } from '../ai/provider-factory.js';
import { getDatabase, aiProviders, eq } from '@neuroflow/database';

function resolveSessionId(context: NodeExecutionContext, paramSessionId?: string): string {
  if (paramSessionId && paramSessionId.trim()) {
    return paramSessionId.trim();
  }
  const input = context.inputData;
  if (input && typeof input === 'object' && input.sessionId) {
    return String(input.sessionId);
  }
  if (context.workflowContext && context.workflowContext.browserSessionId) {
    return String(context.workflowContext.browserSessionId);
  }
  throw new Error(
    'Не указан ID браузерной сессии. Запустите браузер узлом "Browser Start" или укажите sessionId в параметрах.'
  );
}

// 1. Browser Start
export class BrowserStartNode extends BaseNodeDef {
  type = 'browser-start';
  name = 'Browser Start';
  description = 'Запуск изолированного экземпляра браузера (Chromium/Edge) и создание сессии';
  category = NodeCategory.BROWSER;
  icon = 'Globe';
  color = '#2563EB';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Trigger', type: 'main', description: 'Запуск создания сессии' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Session', type: 'main', description: 'Сессия браузера и метаданные' },
  ];

  parameterSchema = BrowserStartParametersSchema;
  defaultParameters = {
    browserType: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 800 },
    timeoutMs: 30000,
    allowLocalhost: false,
    saveCookies: false,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const manager = BrowserSessionManager.getInstance();

    const session = await manager.createSession({
      browserType: params.browserType || 'chromium',
      headless: params.headless !== undefined ? params.headless : true,
      viewport: params.viewport || { width: 1280, height: 800 },
      sessionName: params.sessionName,
      allowLocalhost: !!params.allowLocalhost,
      timeoutMs: params.timeoutMs,
      userId: context.userId,
    });

    // Сохраняем в контекст для последующих узлов
    if (context.workflowContext) {
      context.workflowContext.browserSessionId = session.id;
    }

    const outputData = {
      sessionId: session.id,
      name: session.name,
      browserType: session.browserType,
      createdAt: session.createdAt.toISOString(),
      status: session.status,
    };

    return {
      outputData,
      output: outputData,
      selectedPort: 'main',
    };
  }
}

// 2. Browser Navigate
export class BrowserNavigateNode extends BaseNodeDef {
  type = 'browser-navigate';
  name = 'Browser Navigate';
  description = 'Переход по веб-адресу с валидацией безопасности и защитой от SSRF';
  category = NodeCategory.BROWSER;
  icon = 'Compass';
  color = '#3B82F6';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Входные данные и URL' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Page', type: 'main', description: 'Загруженная страница и статус' },
  ];

  parameterSchema = BrowserNavigateParametersSchema;
  defaultParameters = {
    url: 'https://example.com',
    waitUntil: 'domcontentloaded',
    timeoutMs: 30000,
    allowLocalhost: false,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const sessionId = resolveSessionId(context, params.sessionId);
    const engine = new BrowserEngine();

    const targetUrl = params.url || context.inputData?.url || 'about:blank';
    const result = await engine.navigate(sessionId, targetUrl, {
      waitUntil: params.waitUntil || 'domcontentloaded',
      timeoutMs: params.timeoutMs || 30000,
      allowLocalhost: params.allowLocalhost,
    });

    const outputData = {
      sessionId,
      url: result.url,
      title: result.title,
      httpStatus: result.httpStatus,
      screenshotBase64: result.screenshotBase64,
    };

    return {
      outputData,
      output: outputData,
      selectedPort: 'main',
    };
  }
}

// 3. Browser Click
export class BrowserClickNode extends BaseNodeDef {
  type = 'browser-click';
  name = 'Browser Click';
  description = 'Клик по кнопке, ссылке или элементу с умным ожиданием появления в DOM';
  category = NodeCategory.BROWSER;
  icon = 'MousePointer';
  color = '#0EA5E9';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Входные данные' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Output', type: 'main', description: 'Результат клика' },
  ];

  parameterSchema = BrowserClickParametersSchema;
  defaultParameters = {
    selector: 'button',
    button: 'left',
    clickCount: 1,
    timeoutMs: 15000,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const sessionId = resolveSessionId(context, params.sessionId);
    const engine = new BrowserEngine();

    const selector = params.selector || context.inputData?.selector;
    if (!selector) {
      throw new Error('Не указан селектор для клика');
    }

    const result = await engine.click(sessionId, selector, {
      button: params.button || 'left',
      clickCount: params.clickCount || 1,
      timeoutMs: params.timeoutMs || 15000,
    });

    const outputData = {
      sessionId,
      selector: result.selector,
      currentUrl: result.currentUrl,
      success: result.success,
    };

    return {
      outputData,
      output: outputData,
      selectedPort: 'main',
    };
  }
}

// 4. Browser Type
export class BrowserTypeNode extends BaseNodeDef {
  type = 'browser-type';
  name = 'Browser Type';
  description = 'Ввод текста в поле формы, поисковую строку или текстовую область';
  category = NodeCategory.BROWSER;
  icon = 'Keyboard';
  color = '#06B6D4';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Входные данные и текст' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Output', type: 'main', description: 'Результат ввода' },
  ];

  parameterSchema = BrowserTypeParametersSchema;
  defaultParameters = {
    selector: 'input',
    text: '',
    clearBefore: true,
    pressEnter: false,
    delayMs: 10,
    timeoutMs: 15000,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const sessionId = resolveSessionId(context, params.sessionId);
    const engine = new BrowserEngine();

    const selector = params.selector || context.inputData?.selector;
    const textToType = params.text !== undefined ? String(params.text) : String(context.inputData?.text || '');

    if (!selector) {
      throw new Error('Не указан селектор поля для ввода текста');
    }

    const result = await engine.type(sessionId, selector, textToType, {
      clearBefore: params.clearBefore !== false,
      pressEnter: !!params.pressEnter,
      delayMs: params.delayMs ?? 10,
      timeoutMs: params.timeoutMs || 15000,
    });

    const outputData = {
      sessionId,
      selector: result.selector,
      typedLength: result.typedLength,
      success: result.success,
    };

    return {
      outputData,
      output: outputData,
      selectedPort: 'main',
    };
  }
}

// 5. Browser Extract
export class BrowserExtractNode extends BaseNodeDef {
  type = 'browser-extract';
  name = 'Browser Extract';
  description = 'Извлечение текста, таблиц в структурированный JSON, HTML или атрибутов со страницы';
  category = NodeCategory.BROWSER;
  icon = 'FileSearch';
  color = '#10B981';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Входные данные' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Data', type: 'main', description: 'Извлеченные структурированные данные' },
  ];

  parameterSchema = BrowserExtractParametersSchema;
  defaultParameters = {
    selector: 'body',
    extractType: 'text',
    timeoutMs: 15000,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const sessionId = resolveSessionId(context, params.sessionId);
    const engine = new BrowserEngine();

    const selector = params.selector || 'body';
    const result = await engine.extract(sessionId, selector, {
      extractType: params.extractType || 'text',
      attributeName: params.attributeName,
      timeoutMs: params.timeoutMs || 15000,
    });

    const outputData = {
      sessionId,
      selector: result.selector,
      extractType: result.extractType,
      data: result.data,
    };

    return {
      outputData,
      output: result.data,
      selectedPort: 'main',
    };
  }
}

// 6. Browser Screenshot
export class BrowserScreenshotNode extends BaseNodeDef {
  type = 'browser-screenshot';
  name = 'Browser Screenshot';
  description = 'Создание снимка экрана (PNG/JPEG) страницы или выбранного элемента';
  category = NodeCategory.BROWSER;
  icon = 'Camera';
  color = '#8B5CF6';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Входные данные' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Image', type: 'main', description: 'Снимок экрана (base64 и метаданные)' },
  ];

  parameterSchema = BrowserScreenshotParametersSchema;
  defaultParameters = {
    fullPage: false,
    format: 'png',
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const sessionId = resolveSessionId(context, params.sessionId);
    const engine = new BrowserEngine();

    const result = await engine.screenshot(sessionId, {
      selector: params.selector,
      fullPage: params.fullPage,
      format: params.format || 'png',
      quality: params.quality,
      saveToPath: params.saveToPath,
    });

    const outputData = {
      sessionId,
      base64: result.base64,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes,
      savedPath: result.savedPath,
    };

    return {
      outputData,
      output: outputData,
      selectedPort: 'main',
    };
  }
}

// 7. Browser Wait
export class BrowserWaitNode extends BaseNodeDef {
  type = 'browser-wait';
  name = 'Browser Wait';
  description = 'Умное ожидание появления, скрытия или прикрепления элемента к DOM';
  category = NodeCategory.BROWSER;
  icon = 'Clock';
  color = '#F59E0B';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Входные данные' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Output', type: 'main', description: 'Подтверждение ожидания' },
  ];

  parameterSchema = BrowserWaitParametersSchema;
  defaultParameters = {
    selector: 'body',
    state: 'visible',
    timeoutMs: 15000,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const sessionId = resolveSessionId(context, params.sessionId);
    const engine = new BrowserEngine();

    const selector = params.selector || context.inputData?.selector;
    if (!selector) {
      throw new Error('Не указан селектор для ожидания');
    }

    const result = await engine.waitFor(sessionId, selector, {
      state: params.state || 'visible',
      timeoutMs: params.timeoutMs || 15000,
    });

    const outputData = {
      sessionId,
      selector: result.selector,
      state: result.state,
      success: result.success,
    };

    return {
      outputData,
      output: outputData,
      selectedPort: 'main',
    };
  }
}

// 8. Browser Download
export class BrowserDownloadNode extends BaseNodeDef {
  type = 'browser-download';
  name = 'Browser Download';
  description = 'Скачивание файла по клику на кнопку в защищенную локальную папку';
  category = NodeCategory.BROWSER;
  icon = 'Download';
  color = '#EC4899';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Входные данные' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'File', type: 'main', description: 'Путь к сохраненному файлу' },
  ];

  parameterSchema = BrowserDownloadParametersSchema;
  defaultParameters = {
    timeoutMs: 30000,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const sessionId = resolveSessionId(context, params.sessionId);
    const engine = new BrowserEngine();

    const clickSelector = params.clickSelector || context.inputData?.clickSelector;
    const result = await engine.download(sessionId, {
      clickSelector,
      targetDirectory: params.targetDirectory,
      filename: params.filename,
      timeoutMs: params.timeoutMs || 30000,
    });

    const outputData = {
      sessionId,
      filename: result.filename,
      savedPath: result.savedPath,
    };

    return {
      outputData,
      output: outputData,
      selectedPort: 'main',
    };
  }
}

// 9. Browser Close
export class BrowserCloseNode extends BaseNodeDef {
  type = 'browser-close';
  name = 'Browser Close';
  description = 'Завершение браузерной сессии и освобождение оперативной памяти';
  category = NodeCategory.BROWSER;
  icon = 'PowerOff';
  color = '#64748B';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Входные данные' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Output', type: 'main', description: 'Статус завершения' },
  ];

  parameterSchema = BrowserCloseParametersSchema;
  defaultParameters = {
    saveStorageState: false,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const sessionId = resolveSessionId(context, params.sessionId);
    const manager = BrowserSessionManager.getInstance();

    let storageStateEncrypted: string | null = null;
    if (params.saveStorageState) {
      storageStateEncrypted = await manager.exportStorageState(sessionId);
    }

    const closed = await manager.closeSession(sessionId);

    if (context.workflowContext && context.workflowContext.browserSessionId === sessionId) {
      delete context.workflowContext.browserSessionId;
    }

    const outputData = {
      sessionId,
      closed,
      storageStateEncrypted,
    };

    return {
      outputData,
      output: outputData,
      selectedPort: 'main',
    };
  }
}

// 10. AI Browser Agent
export class AIBrowserAgentNode extends BaseNodeDef {
  type = 'ai-browser-agent';
  name = 'AI Browser Agent';
  description = 'Автономный AI-агент, решающий задачи в браузере по описанию на естественном языке';
  category = NodeCategory.BROWSER;
  icon = 'Bot';
  color = '#8B5CF6';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Task', type: 'main', description: 'Задача или инструкция' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Result', type: 'main', description: 'Финальный ответ агента' },
  ];

  parameterSchema = AIBrowserAgentParametersSchema;
  defaultParameters = {
    task: 'Выполни поиск на сайте и извлеки нужную информацию',
    startUrl: 'https://example.com',
    maxSteps: 12,
    allowLocalhost: false,
    requireApprovalForActions: false,
    timeoutMs: 60000,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const task = params.task || context.inputData?.task || this.defaultParameters.task;
    const startUrl = params.startUrl || context.inputData?.startUrl || this.defaultParameters.startUrl;

    // 1. Поиск AI провайдера
    let provider: any = undefined;
    const providerKey = params.providerId;

    if (providerKey) {
      provider = AIProviderFactory.getInstance(providerKey);
      if (!provider) {
        try {
          provider = await AIProviderFactory.getInstance().getProvider(providerKey);
        } catch {}
      }
    }

    if (!provider && providerKey) {
      try {
        const db = getDatabase();
        const [row] = await db.select().from(aiProviders).where(eq(aiProviders.id, providerKey)).limit(1);
        if (row && row.isEnabled) {
          provider = AIProviderFactory.createProvider(row);
        }
      } catch {}
    }

    if (!provider) {
      try {
        const db = getDatabase();
        const [defaultRow] = await db
          .select()
          .from(aiProviders)
          .where(eq(aiProviders.isDefault, true))
          .limit(1);
        if (defaultRow && defaultRow.isEnabled) {
          provider = AIProviderFactory.createProvider(defaultRow);
        }
      } catch {}
    }

    if (!provider) {
      try {
        provider = await AIProviderFactory.getInstance().getDefaultProvider();
      } catch {}
    }

    if (!provider) {
      throw new Error('Для работы AI Browser Agent не найден активный AI провайдер.');
    }

    const agent = new AIBrowserAgent();
    const result = await agent.run({
      task,
      startUrl,
      provider,
      model: params.model,
      maxSteps: params.maxSteps || 12,
      allowLocalhost: !!params.allowLocalhost,
      userId: context.userId,
      workflowId: context.workflowId,
      executionId: context.executionId,
      timeoutMs: params.timeoutMs,
      log: context.log,
    });

    return {
      outputData: result,
      output: result.finalAnswer,
      selectedPort: 'main',
    };
  }
}
