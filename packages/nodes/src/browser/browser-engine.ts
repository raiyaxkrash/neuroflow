import { BrowserSessionManager, ActiveBrowserSession } from './browser-session-manager.js';
import { BrowserSecurity } from './browser-security.js';
import path from 'node:path';
import fs from 'node:fs/promises';

export interface NavigateOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  timeoutMs?: number;
  allowLocalhost?: boolean;
}

export interface ClickOptions {
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  timeoutMs?: number;
}

export interface TypeOptions {
  clearBefore?: boolean;
  pressEnter?: boolean;
  delayMs?: number;
  timeoutMs?: number;
}

export interface ExtractOptions {
  extractType?: 'text' | 'html' | 'attribute' | 'table' | 'all_elements';
  attributeName?: string;
  timeoutMs?: number;
}

export interface ScreenshotOptions {
  selector?: string;
  fullPage?: boolean;
  format?: 'png' | 'jpeg';
  quality?: number;
  saveToPath?: string;
}

export interface WaitOptions {
  state?: 'visible' | 'hidden' | 'attached' | 'detached';
  timeoutMs?: number;
}

export interface ScrollOptions {
  direction?: 'up' | 'down' | 'top' | 'bottom';
  amount?: number;
}

export interface DownloadOptions {
  clickSelector?: string;
  downloadUrl?: string;
  targetDirectory?: string;
  filename?: string;
  timeoutMs?: number;
}

export class BrowserEngine {
  private sessionManager: BrowserSessionManager;

  constructor() {
    this.sessionManager = BrowserSessionManager.getInstance();
  }

  private getSessionOrThrow(sessionId: string): ActiveBrowserSession {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Браузерная сессия "${sessionId}" не найдена или была закрыта по таймауту.`);
    }
    return session;
  }

  /**
   * 1. Навигация по URL
   */
  public async navigate(
    sessionId: string,
    targetUrl: string,
    options: NavigateOptions = {}
  ): Promise<{ success: boolean; url: string; title: string; httpStatus?: number; screenshotBase64?: string }> {
    const session = this.getSessionOrThrow(sessionId);
    const startTime = Date.now();

    // Проверка SSRF и валидация схемы
    const validation = BrowserSecurity.validateUrl(targetUrl, {
      allowLocalhost: options.allowLocalhost ?? session.allowLocalhost,
    });

    if (!validation.valid || !validation.normalizedUrl) {
      const err = validation.error || 'Недопустимый URL';
      this.sessionManager.logAction(sessionId, 'navigate', {
        target: targetUrl,
        durationMs: Date.now() - startTime,
        success: false,
        error: err,
      });
      throw new Error(`Ошибка навигации: ${err}`);
    }

    try {
      const response = await session.page.goto(validation.normalizedUrl, {
        waitUntil: options.waitUntil || 'domcontentloaded',
        timeout: options.timeoutMs || 30000,
      });

      const finalUrl = session.page.url();
      const title = await session.page.title().catch(() => '');
      const httpStatus = response?.status();

      // Снятие миниатюры для монитора
      let screenshotBase64: string | undefined;
      try {
        const shot = await session.page.screenshot({ type: 'jpeg', quality: 50 });
        screenshotBase64 = shot.toString('base64');
        this.sessionManager.setLatestScreenshot(sessionId, screenshotBase64);
      } catch {}

      this.sessionManager.logAction(sessionId, 'navigate', {
        target: finalUrl,
        parameters: { waitUntil: options.waitUntil, httpStatus },
        durationMs: Date.now() - startTime,
        success: true,
      });

      return {
        success: true,
        url: finalUrl,
        title,
        httpStatus,
        screenshotBase64,
      };
    } catch (err: any) {
      this.sessionManager.logAction(sessionId, 'navigate', {
        target: targetUrl,
        durationMs: Date.now() - startTime,
        success: false,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * 2. Клик по элементу
   */
  public async click(
    sessionId: string,
    selector: string,
    options: ClickOptions = {}
  ): Promise<{ success: boolean; selector: string; currentUrl: string }> {
    const session = this.getSessionOrThrow(sessionId);
    const startTime = Date.now();
    const cleanSelector = BrowserSecurity.sanitizeSelector(selector);

    try {
      const locator = session.page.locator(cleanSelector).first();
      await locator.waitFor({
        state: 'visible',
        timeout: options.timeoutMs || 15000,
      });

      await locator.scrollIntoViewIfNeeded().catch(() => {});
      await locator.click({
        button: options.button || 'left',
        clickCount: options.clickCount || 1,
        timeout: options.timeoutMs || 15000,
      });

      // Обновление скриншота после клика
      try {
        const shot = await session.page.screenshot({ type: 'jpeg', quality: 50 });
        this.sessionManager.setLatestScreenshot(sessionId, shot.toString('base64'));
      } catch {}

      this.sessionManager.logAction(sessionId, 'click', {
        target: cleanSelector,
        parameters: options,
        durationMs: Date.now() - startTime,
        success: true,
      });

      return {
        success: true,
        selector: cleanSelector,
        currentUrl: session.page.url(),
      };
    } catch (err: any) {
      this.sessionManager.logAction(sessionId, 'click', {
        target: cleanSelector,
        durationMs: Date.now() - startTime,
        success: false,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * 3. Ввод текста в форму
   */
  public async type(
    sessionId: string,
    selector: string,
    text: string,
    options: TypeOptions = {}
  ): Promise<{ success: boolean; selector: string; typedLength: number }> {
    const session = this.getSessionOrThrow(sessionId);
    const startTime = Date.now();
    const cleanSelector = BrowserSecurity.sanitizeSelector(selector);

    try {
      const locator = session.page.locator(cleanSelector).first();
      await locator.waitFor({
        state: 'visible',
        timeout: options.timeoutMs || 15000,
      });

      if (options.clearBefore !== false) {
        await locator.fill('');
      }

      if (options.delayMs && options.delayMs > 0) {
        await locator.pressSequentially(text, { delay: options.delayMs });
      } else {
        await locator.fill(text);
      }

      if (options.pressEnter) {
        await locator.press('Enter');
      }

      // Обновление скриншота после ввода
      try {
        const shot = await session.page.screenshot({ type: 'jpeg', quality: 50 });
        this.sessionManager.setLatestScreenshot(sessionId, shot.toString('base64'));
      } catch {}

      this.sessionManager.logAction(sessionId, 'type', {
        target: cleanSelector,
        parameters: { textLength: text.length, pressEnter: options.pressEnter },
        durationMs: Date.now() - startTime,
        success: true,
      });

      return {
        success: true,
        selector: cleanSelector,
        typedLength: text.length,
      };
    } catch (err: any) {
      this.sessionManager.logAction(sessionId, 'type', {
        target: cleanSelector,
        durationMs: Date.now() - startTime,
        success: false,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * 4. Извлечение данных со страницы (текст, таблицы, атрибуты)
   */
  public async extract(
    sessionId: string,
    selector: string = 'body',
    options: ExtractOptions = {}
  ): Promise<{ success: boolean; selector: string; extractType: string; data: any }> {
    const session = this.getSessionOrThrow(sessionId);
    const startTime = Date.now();
    const cleanSelector = BrowserSecurity.sanitizeSelector(selector);
    const extractType = options.extractType || 'text';

    try {
      const locator = session.page.locator(cleanSelector).first();
      await locator.waitFor({
        state: 'attached',
        timeout: options.timeoutMs || 15000,
      });

      let extractedData: any;

      if (extractType === 'text') {
        const rawText = await locator.innerText();
        extractedData = BrowserSecurity.sanitizeWebTextForLLM(rawText);
      } else if (extractType === 'html') {
        extractedData = await locator.innerHTML();
      } else if (extractType === 'attribute') {
        if (!options.attributeName) {
          throw new Error('Для извлечения атрибута необходимо указать parameter "attributeName"');
        }
        extractedData = await locator.getAttribute(options.attributeName);
      } else if (extractType === 'all_elements') {
        const allLocators = session.page.locator(cleanSelector);
        const count = await allLocators.count();
        const results: string[] = [];
        for (let i = 0; i < Math.min(count, 100); i++) {
          results.push(await allLocators.nth(i).innerText());
        }
        extractedData = results;
      } else if (extractType === 'table') {
        // Структурированный парсинг HTML таблицы
        const rows = session.page.locator(`${cleanSelector} tr`);
        const rowCount = await rows.count();
        const tableJson: Record<string, string>[] = [];
        let headers: string[] = [];

        for (let r = 0; r < Math.min(rowCount, 100); r++) {
          const row = rows.nth(r);
          const ths = row.locator('th');
          const thCount = await ths.count();

          if (thCount > 0 && headers.length === 0) {
            for (let h = 0; h < thCount; h++) {
              headers.push((await ths.nth(h).innerText()).trim() || `col_${h}`);
            }
            continue;
          }

          const tds = row.locator('td');
          const tdCount = await tds.count();
          if (tdCount === 0) continue;

          const rowObj: Record<string, string> = {};
          for (let d = 0; d < tdCount; d++) {
            const key = headers[d] || `col_${d}`;
            rowObj[key] = (await tds.nth(d).innerText()).trim();
          }
          tableJson.push(rowObj);
        }
        extractedData = tableJson;
      }

      this.sessionManager.logAction(sessionId, 'extract', {
        target: cleanSelector,
        parameters: { extractType },
        durationMs: Date.now() - startTime,
        success: true,
      });

      return {
        success: true,
        selector: cleanSelector,
        extractType,
        data: extractedData,
      };
    } catch (err: any) {
      this.sessionManager.logAction(sessionId, 'extract', {
        target: cleanSelector,
        durationMs: Date.now() - startTime,
        success: false,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * 5. Снятие скриншота
   */
  public async screenshot(
    sessionId: string,
    options: ScreenshotOptions = {}
  ): Promise<{ success: boolean; base64: string; mimeType: string; sizeBytes: number; savedPath?: string }> {
    const session = this.getSessionOrThrow(sessionId);
    const startTime = Date.now();

    try {
      const format = options.format || 'png';
      const screenshotOptions: any = {
        type: format,
        fullPage: options.fullPage || false,
      };

      if (format === 'jpeg' && options.quality) {
        screenshotOptions.quality = options.quality;
      }

      let buffer: Buffer;
      if (options.selector) {
        const cleanSelector = BrowserSecurity.sanitizeSelector(options.selector);
        const locator = session.page.locator(cleanSelector).first();
        await locator.waitFor({ state: 'visible', timeout: 10000 });
        buffer = await locator.screenshot(screenshotOptions);
      } else {
        buffer = await session.page.screenshot(screenshotOptions);
      }

      const base64 = buffer.toString('base64');
      this.sessionManager.setLatestScreenshot(sessionId, base64);

      let savedPath: string | undefined;
      if (options.saveToPath) {
        const resolvedPath = path.resolve(options.saveToPath);
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
        await fs.writeFile(resolvedPath, buffer);
        savedPath = resolvedPath;
      }

      this.sessionManager.logAction(sessionId, 'screenshot', {
        target: options.selector || 'viewport',
        parameters: { fullPage: options.fullPage, format },
        durationMs: Date.now() - startTime,
        success: true,
      });

      return {
        success: true,
        base64,
        mimeType: format === 'jpeg' ? 'image/jpeg' : 'image/png',
        sizeBytes: buffer.length,
        savedPath,
      };
    } catch (err: any) {
      this.sessionManager.logAction(sessionId, 'screenshot', {
        target: options.selector || 'viewport',
        durationMs: Date.now() - startTime,
        success: false,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * 6. Ожидание состояния элемента
   */
  public async waitFor(
    sessionId: string,
    selector: string,
    options: WaitOptions = {}
  ): Promise<{ success: boolean; selector: string; state: string }> {
    const session = this.getSessionOrThrow(sessionId);
    const startTime = Date.now();
    const cleanSelector = BrowserSecurity.sanitizeSelector(selector);
    const state = options.state || 'visible';

    try {
      await session.page.waitForSelector(cleanSelector, {
        state,
        timeout: options.timeoutMs || 15000,
      });

      this.sessionManager.logAction(sessionId, 'wait', {
        target: cleanSelector,
        parameters: { state },
        durationMs: Date.now() - startTime,
        success: true,
      });

      return {
        success: true,
        selector: cleanSelector,
        state,
      };
    } catch (err: any) {
      this.sessionManager.logAction(sessionId, 'wait', {
        target: cleanSelector,
        durationMs: Date.now() - startTime,
        success: false,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * 7. Прокрутка страницы
   */
  public async scroll(
    sessionId: string,
    options: ScrollOptions = {}
  ): Promise<{ success: boolean; direction: string }> {
    const session = this.getSessionOrThrow(sessionId);
    const startTime = Date.now();
    const direction = options.direction || 'down';
    const amount = options.amount || 600;

    try {
      if (direction === 'down') {
        await session.page.mouse.wheel(0, amount);
      } else if (direction === 'up') {
        await session.page.mouse.wheel(0, -amount);
      } else if (direction === 'top') {
        await session.page.evaluate(() => window.scrollTo(0, 0));
      } else if (direction === 'bottom') {
        await session.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      }

      this.sessionManager.logAction(sessionId, 'scroll', {
        parameters: { direction, amount },
        durationMs: Date.now() - startTime,
        success: true,
      });

      return { success: true, direction };
    } catch (err: any) {
      this.sessionManager.logAction(sessionId, 'scroll', {
        durationMs: Date.now() - startTime,
        success: false,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * 8. Скачивание файла
   */
  public async download(
    sessionId: string,
    options: DownloadOptions = {}
  ): Promise<{ success: boolean; filename: string; savedPath: string }> {
    const session = this.getSessionOrThrow(sessionId);
    const startTime = Date.now();

    try {
      let downloadPromise: Promise<any>;

      if (options.clickSelector) {
        const cleanSelector = BrowserSecurity.sanitizeSelector(options.clickSelector);
        downloadPromise = session.page.waitForEvent('download', {
          timeout: options.timeoutMs || 30000,
        });
        await session.page.locator(cleanSelector).first().click();
      } else {
        throw new Error('Для скачивания необходимо указать clickSelector');
      }

      const download = await downloadPromise;
      const suggestedFilename = options.filename || download.suggestedFilename() || 'downloaded-file';

      const targetDir = options.targetDirectory
        ? path.resolve(options.targetDirectory)
        : path.resolve(process.cwd(), 'downloads');

      await fs.mkdir(targetDir, { recursive: true });
      const finalPath = path.join(targetDir, suggestedFilename);
      await download.saveAs(finalPath);

      this.sessionManager.logAction(sessionId, 'download', {
        target: options.clickSelector,
        parameters: { filename: suggestedFilename, path: finalPath },
        durationMs: Date.now() - startTime,
        success: true,
      });

      return {
        success: true,
        filename: suggestedFilename,
        savedPath: finalPath,
      };
    } catch (err: any) {
      this.sessionManager.logAction(sessionId, 'download', {
        durationMs: Date.now() - startTime,
        success: false,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * 9. Извлечение семантической карты интерактивных элементов для AI Browser Agent
   */
  public async getInteractiveElementsMap(sessionId: string): Promise<{
    url: string;
    title: string;
    elements: Array<{
      tag: string;
      role?: string;
      text?: string;
      selector: string;
      type?: string;
      placeholder?: string;
      value?: string;
    }>;
  }> {
    const session = this.getSessionOrThrow(sessionId);
    const url = session.page.url();
    const title = await session.page.title().catch(() => '');

    // Безопасное извлечение списка элементов через locator evaluate
    const rawElements = await session.page.locator('button, a, input, select, textarea, [role="button"]').evaluateAll(
      (nodes) => {
        return nodes.slice(0, 50).map((el, index) => {
          const tag = el.tagName.toLowerCase();
          const role = el.getAttribute('role') || undefined;
          const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
          const type = el.getAttribute('type') || undefined;
          const placeholder = el.getAttribute('placeholder') || undefined;
          const id = el.getAttribute('id');
          const name = el.getAttribute('name');
          const testId = el.getAttribute('data-testid');

          // Формируем надежный селектор
          let selector = '';
          if (id) {
            selector = `#${id}`;
          } else if (testId) {
            selector = `[data-testid="${testId}"]`;
          } else if (name) {
            selector = `${tag}[name="${name}"]`;
          } else if (text && (tag === 'button' || tag === 'a')) {
            selector = `${tag}:has-text("${text.slice(0, 30)}")`;
          } else {
            selector = `${tag}:nth-of-type(${index + 1})`;
          }

          return {
            tag,
            role,
            text: text || undefined,
            selector,
            type,
            placeholder,
            value: (el as HTMLInputElement).value || undefined,
          };
        });
      }
    );

    return {
      url,
      title,
      elements: rawElements,
    };
  }
}
