import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE_URL = 'http://localhost:3000';
const HTML_REFERENCE = 'file:///' + path.resolve(__dirname, '../DESIGN/NeuroFlow_Studio_v2(1).html').replace(/\\/g, '/');
const OUTPUT_DIR = 'C:/Users/Professional/.gemini/antigravity/brain/cf4de89b-bc1d-4aa0-8859-9ca810a5f41a/screenshots';

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      channel: 'msedge',
      args: ['--disable-gpu', '--no-sandbox'],
    });
  } catch {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-gpu', '--no-sandbox'],
    });
  }

  console.log('Браузер запущен, приступаем к снятию скриншотов...');

  // 1. Скриншот оригинального эталона HTML v2
  try {
    const refContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const refPage = await refContext.newPage();
    await refPage.goto(HTML_REFERENCE, { waitUntil: 'load' });
    await refPage.waitForTimeout(1000);
    await refPage.screenshot({ path: path.join(OUTPUT_DIR, '00-reference-html-1440.png'), fullPage: true });
    console.log('✓ Сохранен 00-reference-html-1440.png');
    await refContext.close();
  } catch (err) {
    console.error('Ошибка референса HTML:', err);
  }

  // Вспомогательная функция для съемки страниц
  const captureRoute = async (route: string, name: string, theme: 'dark' | 'light' = 'dark') => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
    
    // Установка темы
    await page.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t);
      localStorage.setItem('neuroflow-ui-theme', t);
    }, theme);
    await page.waitForTimeout(600);

    await page.screenshot({ path: path.join(OUTPUT_DIR, `${name}-${theme}-1440.png`) });
    console.log(`✓ Сохранен ${name}-${theme}-1440.png`);
    await context.close();
  };

  // Маршруты
  await captureRoute('/overview', '01-overview', 'dark');
  await captureRoute('/overview', '01-overview', 'light');

  await captureRoute('/missions', '02-missions', 'dark');
  await captureRoute('/missions', '02-missions', 'light');

  await captureRoute('/workflows', '03-workflows', 'dark');
  await captureRoute('/workflows/sample-id', '04-workflow-editor', 'dark');

  await captureRoute('/knowledge', '05-knowledge', 'dark');
  await captureRoute('/integrations', '06-integrations', 'dark');
  await captureRoute('/credentials', '07-credentials', 'dark');
  await captureRoute('/settings', '08-settings', 'dark');
  await captureRoute('/browser-sessions', '09-browser-sessions', 'dark');

  // Адаптивные разрешения для Главного экрана Overview (1920, 1280, 768, 390px)
  const viewports = [
    { width: 1920, height: 1080, label: '1920' },
    { width: 1280, height: 800, label: '1280' },
    { width: 768, height: 1024, label: '768' },
    { width: 390, height: 844, label: '390' },
  ];

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/overview`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `01-overview-dark-${vp.label}.png`) });
    console.log(`✓ Сохранен 01-overview-dark-${vp.label}.png`);
    await context.close();
  }

  // Скриншот Command Palette (Ctrl+K)
  try {
    const cmdContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const cmdPage = await cmdContext.newPage();
    await cmdPage.goto(`${BASE_URL}/overview`, { waitUntil: 'networkidle' });
    await cmdPage.waitForTimeout(500);
    // Клик по кнопке поиска ⌘K или хоткей
    await cmdPage.keyboard.press('Control+KeyK');
    await cmdPage.waitForTimeout(400);
    await cmdPage.screenshot({ path: path.join(OUTPUT_DIR, '10-command-palette-dark.png') });
    console.log('✓ Сохранен 10-command-palette-dark.png');
    await cmdContext.close();
  } catch (err) {
    console.error('Ошибка Command Palette screenshot:', err);
  }

  await browser.close();
  console.log('Снятие всех скриншотов успешно завершено!');
}

main().catch((err) => {
  console.error('Ошибка выполнения скрипта Playwright:', err);
  process.exit(1);
});
