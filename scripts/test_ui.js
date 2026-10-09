const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PORT = 3456;
const DESIGN_DIR = path.join(__dirname, '..', 'DESIGN');
const SCREENSHOTS_DIR = path.join(DESIGN_DIR, 'screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const server = http.createServer((req, res) => {
  let filePath = path.join(DESIGN_DIR, req.url === '/' ? 'NeuroFlow_Studio_v2.html' : req.url);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DESIGN_DIR, 'NeuroFlow_Studio_v2.html');
  }
  const ext = path.extname(filePath);
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.png': 'image/png'
  };
  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, async () => {
  console.log(`Server running at http://localhost:${PORT}`);
  try {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    const screens = ['overview', 'agents', 'workflows', 'brain', 'mcp', 'activity'];

    // 1. Desktop 1440px - Light Theme
    console.log('Generating Desktop 1440px - Light Theme screenshots...');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`http://localhost:${PORT}#overview`);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await page.waitForTimeout(300);

    for (const s of screens) {
      await page.evaluate((id) => window.navigate(id), s);
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `1440_light_${s}.png`) });
    }

    // 2. Desktop 1440px - Dark Theme
    console.log('Generating Desktop 1440px - Dark Theme screenshots...');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await page.waitForTimeout(200);

    for (const s of screens) {
      await page.evaluate((id) => window.navigate(id), s);
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `1440_dark_${s}.png`) });
    }

    // 3. Compact 1280px - Dark Theme
    console.log('Generating Compact 1280px screenshots...');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(200);
    await page.evaluate((id) => window.navigate(id), 'overview');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '1280_dark_overview.png') });
    await page.evaluate((id) => window.navigate(id), 'workflows');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '1280_dark_workflows.png') });

    // 4. Tablet 768px - Dark Theme
    console.log('Generating Tablet 768px screenshots...');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(200);
    await page.evaluate((id) => window.navigate(id), 'overview');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '768_dark_overview.png') });
    await page.evaluate((id) => window.navigate(id), 'agents');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '768_dark_agents.png') });

    // 5. Workflows Simulation & Dialogs
    console.log('Testing interactive features and capturing modals...');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate((id) => window.navigate(id), 'workflows');
    await page.waitForTimeout(200);
    await page.evaluate(() => window.runWorkflowSimulation());
    await page.waitForTimeout(2800);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '1440_dark_workflows_active_simulation.png') });

    await page.evaluate(() => window.openPalette());
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '1440_dark_command_palette.png') });

    await page.evaluate(() => window.closeOverlay());
    await page.evaluate(() => window.openTaskModal());
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '1440_dark_new_task_modal.png') });

    console.log('\n--- VERIFICATION FINISHED ---');
    console.log(`Console Errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.error('Errors found:', consoleErrors);
    } else {
      console.log('✓ All checks passed with 0 console errors!');
    }

    await browser.close();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    server.close(() => {
      console.log('Test server closed.');
      process.exit(0);
    });
  }
});
