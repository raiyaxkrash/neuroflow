import { chromium, firefox, webkit, Browser, BrowserContext, Page } from 'playwright';
import { randomUUID } from 'node:crypto';
import { BrowserActionLog, BrowserSessionSummary } from '@neuroflow/shared';
import { encryptData, decryptData } from '@neuroflow/database';

export interface CreateSessionOptions {
  browserType?: 'chromium' | 'firefox' | 'webkit';
  headless?: boolean;
  viewport?: { width: number; height: number };
  sessionName?: string;
  allowLocalhost?: boolean;
  userId?: string;
  encryptedStorageState?: string;
  timeoutMs?: number;
}

export interface ActiveBrowserSession {
  id: string;
  name: string;
  browserType: 'chromium' | 'firefox' | 'webkit';
  browser: Browser;
  context: BrowserContext;
  page: Page;
  createdAt: Date;
  lastActivityAt: Date;
  status: 'active' | 'idle' | 'closed' | 'error';
  allowLocalhost: boolean;
  userId?: string;
  actionLogs: BrowserActionLog[];
  latestScreenshotBase64?: string;
}

export class BrowserSessionManager {
  private static instance: BrowserSessionManager | null = null;

  private sessions: Map<string, ActiveBrowserSession> = new Map();
  private maxSessions = 5; // Лимит одновременных сессий для экономии памяти
  private idleTimeoutMs = 5 * 60 * 1000; // 5 минут неактивности
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Периодическая очистка зависших/неактивных сессий
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleSessions().catch(() => {});
    }, 60 * 1000);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  public static getInstance(): BrowserSessionManager {
    if (!BrowserSessionManager.instance) {
      BrowserSessionManager.instance = new BrowserSessionManager();
    }
    return BrowserSessionManager.instance;
  }

  /**
   * Запуск инстанса браузера Playwright с отказоустойчивыми параметрами
   */
  private async launchPlaywrightBrowser(
    browserType: 'chromium' | 'firefox' | 'webkit' = 'chromium',
    headless: boolean = true
  ): Promise<Browser> {
    const launchOptions: any = {
      headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    };

    if (browserType === 'firefox') {
      return await firefox.launch(launchOptions);
    }
    if (browserType === 'webkit') {
      return await webkit.launch(launchOptions);
    }

    // Для Chromium пробуем стандартный, а в случае отсутствия — системный Edge на Windows
    try {
      return await chromium.launch(launchOptions);
    } catch (err: any) {
      try {
        return await chromium.launch({
          ...launchOptions,
          channel: 'msedge',
        });
      } catch {
        throw new Error(`Не удалось запустить браузер Chromium/Edge: ${err.message}`);
      }
    }
  }

  /**
   * Создание новой изолированной браузерной сессии
   */
  public async createSession(options: CreateSessionOptions = {}): Promise<ActiveBrowserSession> {
    // 1. Проверка лимита сессий
    if (this.sessions.size >= this.maxSessions) {
      await this.evictOldestIdleSession();
    }

    const sessionId = randomUUID();
    const browserType = options.browserType || 'chromium';
    const headless = options.headless !== undefined ? options.headless : true;
    const viewport = options.viewport || { width: 1280, height: 800 };

    const browser = await this.launchPlaywrightBrowser(browserType, headless);

    // Восстановление куков/хранилища при наличии
    let storageState: any = undefined;
    if (options.encryptedStorageState) {
      try {
        const decryptedJson = decryptData(options.encryptedStorageState);
        storageState = JSON.parse(decryptedJson);
      } catch (err) {
        console.warn(`[BrowserSessionManager] Ошибка расшифровки storageState:`, err);
      }
    }

    const context = await browser.newContext({
      viewport,
      storageState,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 NeuroFlow/1.0',
    });

    const page = await context.newPage();
    if (options.timeoutMs) {
      page.setDefaultTimeout(options.timeoutMs);
    }

    const session: ActiveBrowserSession = {
      id: sessionId,
      name: options.sessionName || `Session-${sessionId.slice(0, 8)}`,
      browserType,
      browser,
      context,
      page,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      status: 'active',
      allowLocalhost: !!options.allowLocalhost,
      userId: options.userId,
      actionLogs: [],
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Получение активной сессии по ID
   */
  public getSession(sessionId: string): ActiveBrowserSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivityAt = new Date();
      session.status = 'active';
    }
    return session;
  }

  /**
   * Добавление записи в журнал действий сессии
   */
  public logAction(
    sessionId: string,
    action: string,
    details: {
      target?: string;
      parameters?: Record<string, any>;
      durationMs: number;
      success: boolean;
      error?: string;
    }
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.lastActivityAt = new Date();
    session.actionLogs.push({
      action,
      target: details.target,
      parameters: details.parameters,
      timestamp: new Date().toISOString(),
      durationMs: details.durationMs,
      success: details.success,
      error: details.error,
    });

    // Ограничение длины лога действий
    if (session.actionLogs.length > 100) {
      session.actionLogs = session.actionLogs.slice(-100);
    }
  }

  /**
   * Обновление последнего скриншота сессии
   */
  public setLatestScreenshot(sessionId: string, base64: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.latestScreenshotBase64 = base64;
    }
  }

  /**
   * Экспорт зашифрованного состояния хранилища (cookies и localStorage)
   */
  public async exportStorageState(sessionId: string): Promise<string | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    try {
      const state = await session.context.storageState();
      return encryptData(JSON.stringify(state));
    } catch {
      return null;
    }
  }

  /**
   * Закрытие и освобождение сессии
   */
  public async closeSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.status = 'closed';
    this.sessions.delete(sessionId);

    try {
      await session.page.close().catch(() => {});
      await session.context.close().catch(() => {});
      await session.browser.close().catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Принудительное закрытие всех активных сессий (Graceful Shutdown)
   */
  public async closeAllSessions(): Promise<void> {
    const ids = Array.from(this.sessions.keys());
    await Promise.all(ids.map((id) => this.closeSession(id)));
  }

  /**
   * Список всех активных сессий для UI монитора и API
   */
  public async listSessions(): Promise<BrowserSessionSummary[]> {
    const list: BrowserSessionSummary[] = [];

    for (const [id, s] of this.sessions.entries()) {
      let currentUrl = '';
      let title = '';
      try {
        currentUrl = s.page.url();
        title = await s.page.title().catch(() => '');
      } catch {}

      list.push({
        id,
        name: s.name,
        status: s.status,
        currentUrl,
        title,
        createdAt: s.createdAt.toISOString(),
        lastActivityAt: s.lastActivityAt.toISOString(),
        actionCount: s.actionLogs.length,
        latestScreenshotBase64: s.latestScreenshotBase64,
      });
    }

    return list;
  }

  /**
   * Очистка сессий, превысивших таймаут бездействия
   */
  private async cleanupIdleSessions(): Promise<void> {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActivityAt.getTime() > this.idleTimeoutMs) {
        session.status = 'idle';
        await this.closeSession(id);
      }
    }
  }

  /**
   * Вытеснение самой старой сессии при достижении лимита
   */
  private async evictOldestIdleSession(): Promise<void> {
    let oldestSession: ActiveBrowserSession | null = null;

    for (const session of this.sessions.values()) {
      if (!oldestSession || session.lastActivityAt < oldestSession.lastActivityAt) {
        oldestSession = session;
      }
    }

    if (oldestSession) {
      await this.closeSession(oldestSession.id);
    }
  }

  public getSessionCount(): number {
    return this.sessions.size;
  }
}
