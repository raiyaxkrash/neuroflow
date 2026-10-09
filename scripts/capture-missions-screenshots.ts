import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { runMigrations, getDatabase, users, missions, missionTasks } from '@neuroflow/database';
import { MissionOrchestrator } from '@neuroflow/mission-engine';

const TARGET_URL = 'http://localhost:3000/missions';
const OUTPUT_DIR = 'C:/Users/Professional/.gemini/antigravity/brain/f4bed90d-6d05-406b-bb02-39717ca4eb0e/screenshots';

async function main() {
  process.env.NODE_ENV = 'test';
  await runMigrations();
  const db = getDatabase();

  let [admin] = await db.select().from(users).limit(1);
  if (!admin) {
    [admin] = await db.insert(users).values({
      name: 'Admin Owner',
      email: 'admin@neuroflow.local',
      passwordHash: 'hash',
      role: 'owner',
    }).returning();
  }

  // Создаем показательную миссию
  const m1 = await MissionOrchestrator.createMission(admin.id, {
    goal: 'Провести автономное исследование архитектурных паттернов AI-агентов, извлечь benchmarks и сохранить сводный отчет в базу знаний',
    title: 'Автономный аудит и исследование AI-агентов 2026',
    tokenBudget: 50000,
  });

  // Запускаем миссию для прохождения этапов и генерации чекпоинтов
  await MissionOrchestrator.startMission(m1.id);

  // Создаем вторую миссию в статусе ready
  await MissionOrchestrator.createMission(admin.id, {
    goal: 'Мониторинг обновлений MCP спецификаций и автогенерация TypeScript адаптеров',
    title: 'Синхронизация протокола Model Context Protocol',
    tokenBudget: 35000,
  });

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

  // Клик по первой карточке миссии
  const firstCard = pageDesktop.locator('aside h4').first();
  if (await firstCard.isVisible()) {
    await firstCard.click();
    await pageDesktop.waitForTimeout(800);
  }

  await pageDesktop.screenshot({ path: path.join(OUTPUT_DIR, 'missions-desktop-1440.png') });
  console.log('Сохранен missions-desktop-1440.png');

  // Вкладка Checkpoints
  const cpBtn = pageDesktop.locator('button:has-text("Точки сохранения")');
  if (await cpBtn.isVisible()) {
    await cpBtn.click();
    await pageDesktop.waitForTimeout(600);
    await pageDesktop.screenshot({ path: path.join(OUTPUT_DIR, 'missions-desktop-checkpoints.png') });
    console.log('Сохранен missions-desktop-checkpoints.png');
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
