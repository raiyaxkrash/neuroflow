import { ThemeMode, lightTokens, darkTokens, hexToRgb } from './design-tokens';
import { createDashboardScreen } from './screens/dashboard';
import { createAgentsScreen } from './screens/agents';
import { createWorkflowsScreen } from './screens/workflows';
import { createSecondBrainScreen } from './screens/secondBrain';
import { createMcpHubScreen } from './screens/mcpHub';
import { createActivityScreen } from './screens/activity';

figma.showUI(__html__, { width: 340, height: 500, title: 'NeuroFlow Designer' });

async function loadRequiredFonts() {
  const styles = ['Regular', 'Medium', 'Semi Bold', 'Bold'];
  for (const style of styles) {
    try {
      await figma.loadFontAsync({ family: 'Inter', style });
    } catch (e) {
      console.warn(`Font Inter ${style} load failed, fallback will be used`);
    }
  }
}

function createOrUpdateColorStyles() {
  const themes: { name: string; tokens: typeof lightTokens }[] = [
    { name: 'Light', tokens: lightTokens },
    { name: 'Dark', tokens: darkTokens }
  ];

  const existingStyles = figma.getLocalPaintStyles();

  for (const { name, tokens } of themes) {
    const keys: (keyof typeof lightTokens)[] = [
      'bgCanvas', 'bgSurface', 'bgSurfaceSubtle', 'bgSidebar',
      'textPrimary', 'textSecondary', 'textMuted',
      'borderDefault', 'accentPrimary', 'accentHighlight',
      'statusSuccess', 'statusWarning', 'statusError'
    ];

    for (const key of keys) {
      const styleName = `NeuroFlow/${name}/${key}`;
      let style = existingStyles.find(s => s.name === styleName);
      if (!style) {
        style = figma.createPaintStyle();
        style.name = styleName;
      }
      style.paints = [{
        type: 'SOLID',
        color: hexToRgb(tokens[key])
      }];
    }
  }
}

type ScreenType = 'dashboard' | 'agents' | 'workflows' | 'secondBrain' | 'mcpHub' | 'activity' | 'all';

async function generateScreen(type: ScreenType, theme: ThemeMode) {
  await loadRequiredFonts();
  createOrUpdateColorStyles();

  const generators: { id: ScreenType; name: string; fn: (t: ThemeMode) => FrameNode }[] = [
    { id: 'dashboard', name: 'Dashboard', fn: createDashboardScreen },
    { id: 'agents', name: 'Agents', fn: createAgentsScreen },
    { id: 'workflows', name: 'Workflows', fn: createWorkflowsScreen },
    { id: 'secondBrain', name: 'Second Brain', fn: createSecondBrainScreen },
    { id: 'mcpHub', name: 'MCP Hub', fn: createMcpHubScreen },
    { id: 'activity', name: 'Activity', fn: createActivityScreen }
  ];

  const themeLabel = theme === 'dark' ? 'Dark' : 'Light';
  const createdFrames: FrameNode[] = [];

  const targets = type === 'all' ? generators : generators.filter(g => g.id === type);

  targets.forEach((gen, idx) => {
    const expectedName = `NeuroFlow / ${gen.name} (${themeLabel})`;

    // Check if screen already exists on the current page to prevent uncontrolled duplication
    const existing = figma.currentPage.findOne(n => n.name === expectedName && n.type === 'FRAME') as FrameNode | null;

    let posX = idx * 1520;
    let posY = 0;

    if (existing) {
      posX = existing.x;
      posY = existing.y;
      existing.remove(); // Remove old version cleanly to refresh with new content
    } else {
      // Find rightmost element if generating in an existing workspace
      let maxX = 0;
      figma.currentPage.children.forEach(c => {
        if (c.x + c.width > maxX) maxX = c.x + c.width;
      });
      if (maxX > 0) posX = maxX + 100 + (idx * 1520);
    }

    const newFrame = gen.fn(theme);
    newFrame.x = posX;
    newFrame.y = posY;
    figma.currentPage.appendChild(newFrame);
    createdFrames.push(newFrame);
  });

  if (createdFrames.length > 0) {
    figma.viewport.scrollAndZoomIntoView(createdFrames);
    figma.ui.postMessage({
      type: 'done',
      message: `Создано экранов: ${createdFrames.length} (${themeLabel} тема)`
    });
  }
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'generate') {
    try {
      await generateScreen(msg.screen as ScreenType, msg.theme as ThemeMode);
    } catch (err: any) {
      console.error(err);
      figma.ui.postMessage({
        type: 'error',
        message: `Ошибка генерации: ${err.message || String(err)}`
      });
    }
  } else if (msg.type === 'create-tokens') {
    try {
      createOrUpdateColorStyles();
      figma.ui.postMessage({
        type: 'done',
        message: 'Цветовые стили NeuroFlow успешно созданы в файле!'
      });
    } catch (err: any) {
      figma.ui.postMessage({
        type: 'error',
        message: `Ошибка создания стилей: ${err.message}`
      });
    }
  }
};
