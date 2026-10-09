import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BrowserTestServer } from './fixtures/browser-test-server.js';
import { BrowserSessionManager, BrowserEngine } from '@neuroflow/nodes';
import fs from 'node:fs/promises';

describe('BrowserEngine with Real Playwright (Chromium/Edge)', () => {
  const testServer = new BrowserTestServer();
  let baseUrl = '';
  const sessionManager = BrowserSessionManager.getInstance();
  const engine = new BrowserEngine();
  let sessionId = '';

  beforeAll(async () => {
    baseUrl = await testServer.start();
  }, 15000);

  afterAll(async () => {
    if (sessionId) {
      await sessionManager.closeSession(sessionId).catch(() => {});
    }
    await testServer.stop();
  });

  it('должен успешно запускать браузерную сессию Playwright', async () => {
    const session = await sessionManager.createSession({
      allowLocalhost: true,
      headless: true,
      sessionName: 'Test-Session',
    });

    expect(session).toBeDefined();
    expect(session.id).toBeTruthy();
    expect(session.status).toBe('active');
    sessionId = session.id;
  }, 20000);

  it('должен выполнять навигацию по веб-странице', async () => {
    const navResult = await engine.navigate(sessionId, baseUrl, {
      allowLocalhost: true,
    });

    expect(navResult.success).toBe(true);
    expect(navResult.title).toContain('NeuroFlow Browser Test App');
    expect(navResult.httpStatus).toBe(200);
    expect(navResult.screenshotBase64).toBeTruthy();
  }, 15000);

  it('должен выполнять клик по элементу и изменять состояние DOM', async () => {
    // Начальное значение счетчика
    const initVal = await engine.extract(sessionId, '#counter', { extractType: 'text' });
    expect(initVal.data).toBe('0');

    // Клик по кнопке
    const clickResult = await engine.click(sessionId, '#counter-btn');
    expect(clickResult.success).toBe(true);

    // Конечное значение счетчика
    const updatedVal = await engine.extract(sessionId, '#counter', { extractType: 'text' });
    expect(updatedVal.data).toBe('1');
  }, 15000);

  it('должен вводить текст в поле формы и отправлять запрос', async () => {
    const typeResult = await engine.type(sessionId, '#query-input', 'Тестовый запрос 42', {
      clearBefore: true,
    });
    expect(typeResult.success).toBe(true);

    // Клик по кнопке отправки формы
    await engine.click(sessionId, '#search-submit');

    // Проверка результата поиска
    const searchRes = await engine.extract(sessionId, '#search-result', { extractType: 'text' });
    expect(searchRes.data).toContain('Найдено: Тестовый запрос 42');
  }, 15000);

  it('должен структурированно извлекать HTML таблицу в JSON', async () => {
    const tableResult = await engine.extract(sessionId, '#products-table', {
      extractType: 'table',
    });

    expect(tableResult.success).toBe(true);
    expect(Array.isArray(tableResult.data)).toBe(true);
    expect(tableResult.data.length).toBe(2);

    const firstRow = tableResult.data[0];
    expect(firstRow['ID']).toBe('1');
    expect(firstRow['Название']).toBe('Ноутбук');
    expect(firstRow['Цена']).toBe('85000');
  }, 15000);

  it('должен создавать скриншот страницы в формате base64', async () => {
    const shot = await engine.screenshot(sessionId, { format: 'jpeg', quality: 50 });
    expect(shot.success).toBe(true);
    expect(shot.base64).toBeTruthy();
    expect(shot.mimeType).toBe('image/jpeg');
    expect(shot.sizeBytes).toBeGreaterThan(100);
  }, 15000);

  it('должен корректно ожидать динамического появления элемента', async () => {
    // Нажимаем кнопку, которая отобразит блок через 100мс
    await engine.click(sessionId, '#show-delayed-btn');

    const waitRes = await engine.waitFor(sessionId, '#delayed-container', {
      state: 'visible',
      timeoutMs: 5000,
    });
    expect(waitRes.success).toBe(true);

    const text = await engine.extract(sessionId, '#delayed-container', { extractType: 'text' });
    expect(text.data).toBe('Появившийся блок');
  }, 15000);

  it('должен скачивать файл по клику в локальную директорию', async () => {
    const targetDir = './downloads-test';
    const dlResult = await engine.download(sessionId, {
      clickSelector: '#download-link',
      targetDirectory: targetDir,
      filename: 'downloaded-report.txt',
    });

    expect(dlResult.success).toBe(true);
    expect(dlResult.savedPath).toBeTruthy();

    const fileContent = await fs.readFile(dlResult.savedPath, 'utf-8');
    expect(fileContent).toContain('NeuroFlow Automated Browser Report: Success');

    // Очистка тестового файла
    await fs.unlink(dlResult.savedPath).catch(() => {});
    await fs.rmdir(targetDir).catch(() => {});
  }, 20000);

  it('должен закрывать браузерную сессию и освобождать память', async () => {
    const closed = await sessionManager.closeSession(sessionId);
    expect(closed).toBe(true);
    expect(sessionManager.getSession(sessionId)).toBeUndefined();
  });
});
