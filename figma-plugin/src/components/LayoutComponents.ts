import { ThemeColors, solidPaint } from '../design-tokens';
import { createAutoLayoutFrame, createText, createStatusDot } from './helpers';

export function createSidebar(tokens: ThemeColors, activeScreen: string): FrameNode {
  const sidebar = createAutoLayoutFrame({
    name: 'Sidebar',
    layoutMode: 'VERTICAL',
    spacing: 4,
    padding: [24, 12, 20, 12],
    fill: tokens.bgSidebar,
    width: 248,
    layoutAlign: 'STRETCH'
  });
  sidebar.strokes = [solidPaint(tokens.bgSidebarHover)];
  sidebar.strokeWeight = 1;

  // Brand header
  const brand = createAutoLayoutFrame({
    name: 'Brand',
    layoutMode: 'HORIZONTAL',
    spacing: 12,
    padding: [0, 8, 24, 8],
    counterAxisAlignItems: 'CENTER'
  });

  const logo = createAutoLayoutFrame({
    name: 'Logomark',
    layoutMode: 'VERTICAL',
    padding: 6,
    cornerRadius: 8,
    fill: tokens.accentHighlight,
    width: 32,
    height: 32,
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'CENTER'
  });
  const logoText = createText({
    text: 'N',
    size: 16,
    weight: 'Bold',
    color: tokens.accentHighlightText
  });
  logo.appendChild(logoText);
  brand.appendChild(logo);

  const brandTextCol = createAutoLayoutFrame({
    name: 'Wordmark Col',
    layoutMode: 'VERTICAL',
    spacing: 2
  });
  const wordmark = createText({
    text: 'neuroflow',
    size: 16,
    weight: 'Bold',
    color: '#FFFFFF'
  });
  const wordmarkSub = createText({
    text: 'PERSONAL WORKSPACE',
    size: 9,
    weight: 'Semi Bold',
    color: tokens.textSidebarMuted
  });
  brandTextCol.appendChild(wordmark);
  brandTextCol.appendChild(wordmarkSub);
  brand.appendChild(brandTextCol);
  sidebar.appendChild(brand);

  // Nav section label
  const navLabel = createText({
    text: 'РАБОЧАЯ СРЕДА',
    size: 10,
    weight: 'Bold',
    color: tokens.textSidebarMuted
  });
  sidebar.appendChild(navLabel);

  // Navigation Items
  const navItems = [
    { id: 'overview', title: 'Обзор', count: '' },
    { id: 'agents', title: 'Агенты', count: '4' },
    { id: 'workflows', title: 'Сценарии', count: '' },
    { id: 'brain', title: 'Second Brain', count: '' },
    { id: 'mcp', title: 'MCP Hub', count: '5' },
    { id: 'activity', title: 'История и логи', count: '' }
  ];

  for (const item of navItems) {
    const isActive = item.id === activeScreen;
    const btn = createAutoLayoutFrame({
      name: `Nav Item / ${item.title}`,
      layoutMode: 'HORIZONTAL',
      spacing: 10,
      padding: [8, 12],
      cornerRadius: 6,
      fill: isActive ? tokens.bgSidebarActive : undefined,
      layoutAlign: 'STRETCH',
      primaryAxisAlignItems: 'SPACE_BETWEEN',
      counterAxisAlignItems: 'CENTER'
    });

    const leftBox = createAutoLayoutFrame({
      name: 'Left',
      layoutMode: 'HORIZONTAL',
      spacing: 8,
      counterAxisAlignItems: 'CENTER'
    });

    const titleText = createText({
      text: item.title,
      size: 13,
      weight: isActive ? 'Semi Bold' : 'Medium',
      color: isActive ? '#FFFFFF' : tokens.textSidebar
    });
    leftBox.appendChild(titleText);
    btn.appendChild(leftBox);

    if (item.count) {
      const countBox = createAutoLayoutFrame({
        name: 'Count',
        padding: [2, 6],
        cornerRadius: 4,
        fill: 'rgba(255, 255, 255, 0.08)'
      });
      const countText = createText({
        text: item.count,
        size: 10,
        weight: 'Medium',
        color: tokens.textSidebarMuted
      });
      countBox.appendChild(countText);
      btn.appendChild(countBox);
    }

    sidebar.appendChild(btn);
  }

  // System divider
  const sep = figma.createRectangle();
  sep.name = 'Separator';
  sep.resize(220, 1);
  sep.fills = [solidPaint(tokens.bgSidebarHover)];
  sep.layoutAlign = 'STRETCH';
  sidebar.appendChild(sep);

  // System Section
  const sysLabel = createText({
    text: 'СИСТЕМА',
    size: 10,
    weight: 'Bold',
    color: tokens.textSidebarMuted
  });
  sidebar.appendChild(sysLabel);

  const themeBtn = createAutoLayoutFrame({
    name: 'Theme Nav Item',
    layoutMode: 'HORIZONTAL',
    padding: [8, 12],
    cornerRadius: 6,
    layoutAlign: 'STRETCH',
    counterAxisAlignItems: 'CENTER'
  });
  const themeText = createText({
    text: 'Тема оформления',
    size: 12,
    weight: 'Medium',
    color: tokens.textSidebar
  });
  themeBtn.appendChild(themeText);
  sidebar.appendChild(themeBtn);

  // Bottom Node Status Card
  const spacer = figma.createFrame();
  spacer.name = 'Spacer';
  spacer.fills = [];
  spacer.layoutGrow = 1;
  sidebar.appendChild(spacer);

  const bottomCard = createAutoLayoutFrame({
    name: 'Node Status Bottom',
    layoutMode: 'VERTICAL',
    spacing: 4,
    padding: [12, 12, 4, 12],
    layoutAlign: 'STRETCH'
  });
  const nodeHead = createAutoLayoutFrame({
    name: 'Node Head',
    layoutMode: 'HORIZONTAL',
    spacing: 8,
    counterAxisAlignItems: 'CENTER'
  });
  const dot = createStatusDot(tokens.accentHighlight, 7);
  const nodeTitle = createText({
    text: 'Локальный узел',
    size: 12,
    weight: 'Semi Bold',
    color: '#FFFFFF'
  });
  nodeHead.appendChild(dot);
  nodeHead.appendChild(nodeTitle);

  const nodeMeta = createText({
    text: 'Готов · v2.4 self-hosted',
    size: 11,
    weight: 'Regular',
    color: tokens.textSidebarMuted
  });

  bottomCard.appendChild(nodeHead);
  bottomCard.appendChild(nodeMeta);
  sidebar.appendChild(bottomCard);

  return sidebar;
}

export function createTopbar(tokens: ThemeColors, breadcrumbTitle: string): FrameNode {
  const topbar = createAutoLayoutFrame({
    name: 'Topbar',
    layoutMode: 'HORIZONTAL',
    padding: [0, 40],
    fill: tokens.bgSurface,
    stroke: tokens.borderDefault,
    strokeWeight: 1,
    height: 64,
    layoutAlign: 'STRETCH',
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    counterAxisAlignItems: 'CENTER'
  });

  // Breadcrumbs
  const breadcrumbs = createAutoLayoutFrame({
    name: 'Breadcrumbs',
    layoutMode: 'HORIZONTAL',
    spacing: 8,
    counterAxisAlignItems: 'CENTER'
  });
  breadcrumbs.appendChild(createText({ text: 'NeuroFlow', size: 12, color: tokens.textMuted }));
  breadcrumbs.appendChild(createText({ text: '/', size: 12, color: tokens.textMuted }));
  breadcrumbs.appendChild(createText({ text: breadcrumbTitle, size: 12, weight: 'Semi Bold', color: tokens.textPrimary }));
  topbar.appendChild(breadcrumbs);

  // Right Actions
  const rightBox = createAutoLayoutFrame({
    name: 'Right Box',
    layoutMode: 'HORIZONTAL',
    spacing: 12,
    counterAxisAlignItems: 'CENTER'
  });

  // Search Field
  const search = createAutoLayoutFrame({
    name: 'Search Button',
    layoutMode: 'HORIZONTAL',
    spacing: 12,
    padding: [6, 12],
    cornerRadius: 8,
    fill: tokens.bgSurfaceSubtle,
    stroke: tokens.borderDefault,
    width: 200,
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    counterAxisAlignItems: 'CENTER'
  });
  search.appendChild(createText({ text: 'Поиск и команды', size: 12, color: tokens.textSecondary }));
  const kbd = createAutoLayoutFrame({
    name: 'Kbd',
    padding: [2, 5],
    cornerRadius: 4,
    fill: tokens.bgSurface,
    stroke: tokens.borderDefault
  });
  kbd.appendChild(createText({ text: '⌘K', size: 10, weight: 'Semi Bold', color: tokens.textMuted }));
  search.appendChild(kbd);
  rightBox.appendChild(search);

  // Avatar
  const avatar = createAutoLayoutFrame({
    name: 'Avatar',
    width: 32,
    height: 32,
    cornerRadius: 16,
    fill: tokens.statusSuccessBg,
    stroke: tokens.borderDefault,
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'CENTER'
  });
  avatar.appendChild(createText({ text: 'P', size: 12, weight: 'Bold', color: tokens.statusSuccess }));
  rightBox.appendChild(avatar);

  topbar.appendChild(rightBox);
  return topbar;
}

export function createScreenShell(screenName: string, activeId: string, tokens: ThemeColors): { frame: FrameNode, contentArea: FrameNode } {
  const root = createAutoLayoutFrame({
    name: screenName,
    layoutMode: 'HORIZONTAL',
    width: 1440,
    height: 900,
    fill: tokens.bgCanvas
  });

  const sidebar = createSidebar(tokens, activeId);
  root.appendChild(sidebar);

  const mainArea = createAutoLayoutFrame({
    name: 'Main Area',
    layoutMode: 'VERTICAL',
    layoutGrow: 1,
    layoutAlign: 'STRETCH',
    fill: tokens.bgCanvas
  });

  const topbar = createTopbar(tokens, screenName.split('/')[1]?.trim() || 'Обзор');
  mainArea.appendChild(topbar);

  const contentArea = createAutoLayoutFrame({
    name: 'Stage Content',
    layoutMode: 'VERTICAL',
    spacing: 24,
    padding: [36, 40, 48, 40],
    layoutGrow: 1,
    layoutAlign: 'STRETCH'
  });
  mainArea.appendChild(contentArea);

  root.appendChild(mainArea);
  return { frame: root, contentArea };
}
