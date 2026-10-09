import { ThemeMode, getTokens } from '../design-tokens';
import { createAutoLayoutFrame, createText, createButton, createBadge, createDivider } from '../components/helpers';
import { createScreenShell } from '../components/LayoutComponents';

export function createWorkflowsScreen(theme: ThemeMode): FrameNode {
  const tokens = getTokens(theme);
  const themeLabel = theme === 'dark' ? 'Dark' : 'Light';
  const { frame, contentArea } = createScreenShell(`NeuroFlow / Workflows (${themeLabel})`, 'workflows', tokens);

  // Hero
  const hero = createAutoLayoutFrame({
    name: 'Hero Section',
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    layoutAlign: 'STRETCH',
    counterAxisAlignItems: 'MAX'
  });
  const heroTextCol = createAutoLayoutFrame({ name: 'Hero Text', layoutMode: 'VERTICAL', spacing: 4 });
  heroTextCol.appendChild(createText({ text: 'АВТОМАТИЗАЦИИ / РЕДАКТОР СЦЕНАРИЕВ', size: 10, weight: 'Bold', color: tokens.statusSuccess }));
  heroTextCol.appendChild(createText({ text: 'Сценарии', size: 28, weight: 'Bold', color: tokens.textPrimary }));
  heroTextCol.appendChild(createText({ text: 'Визуальное построение цепочек агентов, условий и шлюзов подтверждения.', size: 13, color: tokens.textSecondary }));
  hero.appendChild(heroTextCol);

  const heroActions = createAutoLayoutFrame({ name: 'Actions', layoutMode: 'HORIZONTAL', spacing: 8 });
  heroActions.appendChild(createButton('Тестовый прогон', 'secondary', tokens));
  heroActions.appendChild(createButton('Сохранить', 'primary', tokens));
  hero.appendChild(heroActions);
  contentArea.appendChild(hero);

  // Work Area
  const workArea = createAutoLayoutFrame({
    name: 'Work Area',
    layoutMode: 'HORIZONTAL',
    spacing: 20,
    layoutAlign: 'STRETCH',
    layoutGrow: 1
  });

  // Canvas Pane (Left)
  const canvasPane = createAutoLayoutFrame({
    name: 'Canvas Pane',
    layoutMode: 'VERTICAL',
    cornerRadius: 10,
    fill: tokens.bgSurface,
    stroke: tokens.borderDefault,
    layoutGrow: 1
  });

  const canvasNav = createAutoLayoutFrame({
    name: 'Canvas Top Bar',
    layoutMode: 'HORIZONTAL',
    padding: [14, 20],
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    layoutAlign: 'STRETCH',
    counterAxisAlignItems: 'CENTER'
  });
  canvasNav.appendChild(createText({ text: 'Обработка задачи с поиском в базе · 4 узла', size: 13, weight: 'Semi Bold', color: tokens.textPrimary }));
  canvasNav.appendChild(createBadge('Черновик v1.4', 'neutral', tokens));
  canvasPane.appendChild(canvasNav);
  canvasPane.appendChild(createDivider(tokens));

  // Canvas container with nodes
  const canvasHolder = figma.createFrame();
  canvasHolder.name = 'Canvas Nodes Field';
  canvasHolder.resize(760, 480);
  canvasHolder.fills = [];
  canvasHolder.layoutGrow = 1;
  canvasHolder.layoutAlign = 'STRETCH';

  const nodes = [
    { title: 'Новая задача', sub: 'Входной триггер (Webhook / CLI)', x: 40, y: 180, selected: false },
    { title: 'Operator', sub: 'AI Router (Claude 3.5 Sonnet)', x: 280, y: 80, selected: true },
    { title: 'Second Brain', sub: 'Векторный поиск по памяти', x: 280, y: 280, selected: false },
    { title: 'Шлюз проверки', sub: 'Approval Gate (Human-in-the-loop)', x: 530, y: 180, selected: false }
  ];

  nodes.forEach(n => {
    const nodeFrame = createAutoLayoutFrame({
      name: `Node / ${n.title}`,
      layoutMode: 'VERTICAL',
      spacing: 6,
      padding: 14,
      cornerRadius: 10,
      fill: tokens.bgSurface,
      stroke: n.selected ? tokens.accentHighlight : tokens.borderDefault,
      strokeWeight: n.selected ? 2 : 1,
      width: 190
    });
    nodeFrame.x = n.x;
    nodeFrame.y = n.y;

    const titleRow = createAutoLayoutFrame({
      name: 'Title Row',
      layoutMode: 'HORIZONTAL',
      spacing: 6,
      counterAxisAlignItems: 'CENTER'
    });
    titleRow.appendChild(createBadge(n.selected ? 'Active' : 'Ready', n.selected ? 'success' : 'neutral', tokens));
    titleRow.appendChild(createText({ text: n.title, size: 12, weight: 'Bold', color: tokens.textPrimary }));
    nodeFrame.appendChild(titleRow);

    nodeFrame.appendChild(createText({ text: n.sub, size: 10, color: tokens.textSecondary }));
    canvasHolder.appendChild(nodeFrame);
  });

  canvasPane.appendChild(canvasHolder);
  workArea.appendChild(canvasPane);

  // Inspector Panel (Right, 310px)
  const inspector = createAutoLayoutFrame({
    name: 'Inspector Panel',
    layoutMode: 'VERTICAL',
    spacing: 16,
    padding: 22,
    cornerRadius: 10,
    fill: tokens.bgSurface,
    stroke: tokens.borderDefault,
    width: 310
  });

  const inspectHead = createAutoLayoutFrame({ name: 'Inspect Head', layoutMode: 'VERTICAL', spacing: 4 });
  inspectHead.appendChild(createText({ text: 'ВЫБРАННЫЙ УЗЕЛ', size: 10, weight: 'Bold', color: tokens.statusSuccess }));
  inspectHead.appendChild(createText({ text: 'Operator', size: 18, weight: 'Bold', color: tokens.textPrimary }));
  inspectHead.appendChild(createText({ text: 'Анализирует задачу, оценивает сложность и проверяет права доступа.', size: 11, color: tokens.textSecondary }));
  inspector.appendChild(inspectHead);

  inspector.appendChild(createDivider(tokens));

  const propsLabel = createText({ text: 'СВОЙСТВА УЗЛА', size: 10, weight: 'Bold', color: tokens.textMuted });
  inspector.appendChild(propsLabel);

  const props = [
    { label: 'Тип узла', val: 'AI Router' },
    { label: 'Входы / Выходы', val: '1 вход / 2 выхода' },
    { label: 'Таймаут', val: '30 сек' },
    { label: 'Статус', val: 'Готов к работе' }
  ];

  props.forEach(p => {
    const r = createAutoLayoutFrame({
      name: `Prop / ${p.label}`,
      layoutMode: 'HORIZONTAL',
      primaryAxisAlignItems: 'SPACE_BETWEEN',
      layoutAlign: 'STRETCH'
    });
    r.appendChild(createText({ text: p.label, size: 11, color: tokens.textSecondary }));
    r.appendChild(createText({ text: p.val, size: 11, weight: 'Semi Bold', color: tokens.textPrimary }));
    inspector.appendChild(r);
  });

  workArea.appendChild(inspector);
  contentArea.appendChild(workArea);

  return frame;
}
