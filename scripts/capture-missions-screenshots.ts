import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const TARGET_URL = 'http://localhost:3000/missions';
const OUTPUT_DIR = 'C:/Users/Professional/.gemini/antigravity/brain/f4bed90d-6d05-406b-bb02-39717ca4eb0e/screenshots';

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

  // 1. Десктоп 1440
  const contextDesktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageDesktop = await contextDesktop.newPage();
  await pageDesktop.goto(TARGET_URL, { waitUntil: 'networkidle' });
  await pageDesktop.waitForSelector('h1', { timeout: 10000 });
  await pageDesktop.waitForTimeout(1500);

  await pageDesktop.screenshot({ path: path.join(OUTPUT_DIR, 'missions-desktop-1440.png') });
  console.log('Сохранен missions-desktop-1440.png');

  // Вкладка Checkpoints
  const cpBtn = pageDesktop.locator('button:has-text("Точки сохранения")');
  if (await cpBtn.isVisible()) {
    await cpBtn.click();
    await pageDesktop.waitForTimeout(800);
    await pageDesktop.screenshot({ path: path.join(OUTPUT_DIR, 'missions-desktop-checkpoints.png') });
    console.log('Сохранен missions-desktop-checkpoints.png');
  }

  // Вкладка Logs
  const logsBtn = pageDesktop.locator('button:has-text("Журнал логов")');
  if (await logsBtn.isVisible()) {
    await logsBtn.click();
    await pageDesktop.waitForTimeout(800);
    await pageDesktop.screenshot({ path: path.join(OUTPUT_DIR, 'missions-desktop-logs.png') });
    console.log('Сохранен missions-desktop-logs.png');
  }

  await contextDesktop.close();

  // 2. Планшет 768
  const contextTablet = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const pageTablet = await contextTablet.newPage();
  await pageTablet.goto(TARGET_URL, { waitUntil: 'networkidle' });
  await pageTablet.waitForTimeout(1500);
  await pageTablet.screenshot({ path: path.join(OUTPUT_DIR, 'missions-tablet-768.png') });
  console.log('Сохранен missions-tablet-768.png');
  await contextTablet.close();

  // 3. Мобильный 375
  const contextMobile = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const pageMobile = await contextMobile.newPage();
  await pageMobile.goto(TARGET_URL, { waitUntil: 'networkidle' });
  await pageMobile.waitForTimeout(1500);
  await pageMobile.screenshot({ path: path.join(OUTPUT_DIR, 'missions-mobile-375.png') });
  console.log('Сохранен missions-mobile-375.png');
  await contextMobile.close();

  await browser.close();
  console.log('Все скриншоты успешно сгенерированы.');
}

main().catch((err) => {
  console.error('Ошибка создания скриншотов:', err);
  process.exit(1);
});
