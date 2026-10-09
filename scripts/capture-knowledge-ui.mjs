import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:/Users/Professional/.gemini/antigravity/brain/f4bed90d-6d05-406b-bb02-39717ca4eb0e/screenshots';
const API_URL = 'http://127.0.0.1:4000/api/auth/login';
const WEB_URL = 'http://localhost:3005';

async function getAdminToken() {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@neuroflow.local',
      password: 'adminneuroflow',
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to authenticate: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.token;
}

async function main() {
  await fs.mkdir(ARTIFACTS_DIR, { recursive: true });

  console.log('Authenticating as admin@neuroflow.local...');
  const token = await getAdminToken();
  console.log('Obtained JWT token successfully.');

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const viewports = [
    { name: 'desktop-1440', width: 1440, height: 900 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'mobile-375', width: 375, height: 812 },
  ];

  const consoleErrors = [];

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });

    // Устанавливаем токен в localStorage перед загрузкой страницы
    await context.addInitScript((authToken) => {
      window.localStorage.setItem('neuroflow_token', authToken);
      window.localStorage.setItem('token', authToken);
    }, token);

    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[${vp.name}] ${msg.text()}`);
      }
    });

    page.on('pageerror', (err) => {
      consoleErrors.push(`[${vp.name} PageError] ${err.message}`);
    });

    console.log(`Navigating to ${WEB_URL}/knowledge (${vp.name})...`);
    await page.goto(`${WEB_URL}/knowledge`, { waitUntil: 'networkidle' });

    // Ожидание рендеринга данных
    await page.waitForTimeout(1500);

    const screenshotPath = path.join(ARTIFACTS_DIR, `knowledge-${vp.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Saved screenshot: ${screenshotPath}`);

    // Интерактивное тестирование вкладок на desktop
    if (vp.name === 'desktop-1440') {
      // 1. Вкладка "Источники"
      const sourcesTab = page.locator('button', { hasText: 'Источники' });
      if (await sourcesTab.isVisible()) {
        await sourcesTab.click();
        await page.waitForTimeout(600);
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, 'knowledge-desktop-sources-tab.png'),
          fullPage: true,
        });
        console.log('Saved sources tab screenshot');
      }

      // 2. Вкладка "Граф знаний"
      const graphTab = page.locator('button', { hasText: 'Граф знаний' });
      if (await graphTab.isVisible()) {
        await graphTab.click();
        await page.waitForTimeout(600);
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, 'knowledge-desktop-graph-tab.png'),
          fullPage: true,
        });
        console.log('Saved graph tab screenshot');
      }

      // 3. Вкладка "Поиск & RAG"
      const ragTab = page.locator('button', { hasText: 'Поиск & RAG' });
      if (await ragTab.isVisible()) {
        await ragTab.click();
        await page.waitForTimeout(600);
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, 'knowledge-desktop-rag-tab.png'),
          fullPage: true,
        });
        console.log('Saved RAG tab screenshot');
      }

      // 4. Вкладка "Память агентов"
      const memoryTab = page.locator('button', { hasText: 'Память агентов' });
      if (await memoryTab.isVisible()) {
        await memoryTab.click();
        await page.waitForTimeout(600);
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, 'knowledge-desktop-memory-tab.png'),
          fullPage: true,
        });
        console.log('Saved memory tab screenshot');
      }

      // 5. Вкладка "Расход токенов"
      const tokensTab = page.locator('button', { hasText: 'Расход токенов' });
      if (await tokensTab.isVisible()) {
        await tokensTab.click();
        await page.waitForTimeout(600);
        await page.screenshot({
          path: path.join(ARTIFACTS_DIR, 'knowledge-desktop-tokens-tab.png'),
          fullPage: true,
        });
        console.log('Saved tokens tab screenshot');
      }
    }

    await context.close();
  }

  await browser.close();

  console.log('\n--- Console Errors Check ---');
  if (consoleErrors.length === 0) {
    console.log('SUCCESS: Zero console errors detected across all viewports!');
  } else {
    console.log(`Detected ${consoleErrors.length} console errors:`);
    consoleErrors.forEach((e) => console.log(' -', e));
  }
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
