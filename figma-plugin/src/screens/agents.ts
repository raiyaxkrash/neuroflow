import { ThemeMode, getTokens } from '../design-tokens';
import { createAutoLayoutFrame, createText, createButton, createBadge, createDivider } from '../components/helpers';
import { createScreenShell } from '../components/LayoutComponents';

export function createAgentsScreen(theme: ThemeMode): FrameNode {
  const tokens = getTokens(theme);
  const themeLabel = theme === 'dark' ? 'Dark' : 'Light';
  const { frame, contentArea } = createScreenShell(`NeuroFlow / Agents (${themeLabel})`, 'agents', tokens);

  // Hero
  const hero = createAutoLayoutFrame({
    name: 'Hero Section',
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    layoutAlign: 'STRETCH',
    counterAxisAlignItems: 'MAX'
  });
  const heroTextCol = createAutoLayoutFrame({ name: 'Hero Text', layoutMode: 'VERTICAL', spacing: 4 });
  heroTextCol.appendChild(createText({ text: 'ИСПОЛНИТЕЛИ / 04 АГЕНТА', size: 10, weight: 'Bold', color: tokens.statusSuccess }));
  heroTextCol.appendChild(createText({ text: 'Агенты', size: 28, weight: 'Bold', color: tokens.textPrimary }));
  heroTextCol.appendChild(createText({ text: 'Роли, специализации, модели и гранулярные политики полномочий.', size: 13, color: tokens.textSecondary }));
  hero.appendChild(heroTextCol);
  hero.appendChild(createButton('+ Добавить агента', 'primary', tokens));
  contentArea.appendChild(hero);

  // Master-Detail Layout
  const columns = createAutoLayoutFrame({
    name: 'Columns Layout',
    layoutMode: 'HORIZONTAL',
    spacing: 20,
    layoutAlign: 'STRETCH',
    layoutGrow: 1
  });

  // Directory (Left, 300px)
  const dir = createAutoLayoutFrame({
    name: 'Agent Directory',
    layoutMode: 'VERTICAL',
    spacing: 6,
    padding: 12,
    cornerRadius: 10,
    fill: tokens.bgSurface,
    stroke: tokens.borderDefault,
    width: 300
  });
  dir.appendChild(createText({ text: 'КОМАНДА · 04 АГЕНТА', size: 10, weight: 'Bold', color: tokens.textMuted }));

  const roster = [
    { name: 'Operator', role: 'Оркестрация · Готов', selected: true },
    { name: 'Research', role: 'Поиск и анализ · Ожидает', selected: false },
    { name: 'Developer', role: 'Код и Git · Готов', selected: false },
    { name: 'Architect', role: 'Системный дизайн · Готов', selected: false }
  ];

  roster.forEach(r => {
    const item = createAutoLayoutFrame({
      name: `Roster / ${r.name}`,
      layoutMode: 'HORIZONTAL',
      spacing: 10,
      padding: [10, 12],
      cornerRadius: 8,
      fill: r.selected ? tokens.bgSurfaceSubtle : undefined,
      stroke: r.selected ? tokens.borderStrong : undefined,
      layoutAlign: 'STRETCH',
      counterAxisAlignItems: 'CENTER'
    });
    const ava = createAutoLayoutFrame({
      name: 'Ava',
      width: 32,
      height: 32,
      cornerRadius: 6,
      fill: r.selected ? tokens.accentHighlight : tokens.bgSurfaceSubtle,
      stroke: tokens.borderDefault,
      primaryAxisAlignItems: 'CENTER',
      counterAxisAlignItems: 'CENTER'
    });
    ava.appendChild(createText({ text: r.name[0], size: 12, weight: 'Bold', color: r.selected ? tokens.accentHighlightText : tokens.textPrimary }));
    item.appendChild(ava);

    const info = createAutoLayoutFrame({ name: 'Info', layoutMode: 'VERTICAL', spacing: 2 });
    info.appendChild(createText({ text: r.name, size: 13, weight: 'Semi Bold', color: tokens.textPrimary }));
    info.appendChild(createText({ text: r.role, size: 11, color: tokens.textSecondary }));
    item.appendChild(info);

    dir.appendChild(item);
  });
  columns.appendChild(dir);

  // Inspector Details (Right)
  const details = createAutoLayoutFrame({
    name: 'Agent Details',
    layoutMode: 'VERTICAL',
    spacing: 18,
    padding: 26,
    cornerRadius: 10,
    fill: tokens.bgSurface,
    stroke: tokens.borderDefault,
    layoutGrow: 1
  });

  const detailHead = createAutoLayoutFrame({
    name: 'Detail Head',
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    layoutAlign: 'STRETCH',
    counterAxisAlignItems: 'MAX'
  });
  const detailHeadLeft = createAutoLayoutFrame({ name: 'Head Left', layoutMode: 'VERTICAL', spacing: 4 });
  detailHeadLeft.appendChild(createText({ text: 'АГЕНТ / 01', size: 10, weight: 'Bold', color: tokens.statusSuccess }));
  detailHeadLeft.appendChild(createText({ text: 'Operator', size: 24, weight: 'Bold', color: tokens.textPrimary }));
  detailHeadLeft.appendChild(createText({ text: 'Главный координатор задач. Маршрутизирует запросы и проверяет политики безопасности.', size: 12, color: tokens.textSecondary }));
  detailHead.appendChild(detailHeadLeft);
  detailHead.appendChild(createButton('Настроить', 'secondary', tokens));
  details.appendChild(detailHead);

  details.appendChild(createDivider(tokens));

  // Settings Rows
  const confLabel = createText({ text: 'КОНФИГУРАЦИЯ', size: 10, weight: 'Bold', color: tokens.textMuted });
  details.appendChild(confLabel);

  const settings = [
    { label: 'Модель ИИ', val: 'Claude 3.5 Sonnet (Local / API)', badge: 'API' },
    { label: 'Память', val: 'Контекст задачи + Second Brain RAG', badge: 'Active' },
    { label: 'Режим доступа', val: 'Требует подтверждения опасных операций', badge: 'Strict' }
  ];

  settings.forEach(s => {
    const row = createAutoLayoutFrame({
      name: `Row / ${s.label}`,
      layoutMode: 'HORIZONTAL',
      padding: [10, 0],
      primaryAxisAlignItems: 'SPACE_BETWEEN',
      layoutAlign: 'STRETCH',
      counterAxisAlignItems: 'CENTER'
    });
    row.appendChild(createText({ text: s.label, size: 12, color: tokens.textSecondary, width: 140 }));
    row.appendChild(createText({ text: s.val, size: 12, weight: 'Semi Bold', color: tokens.textPrimary, layoutGrow: 1 }));
    row.appendChild(createBadge(s.badge, 'neutral', tokens));
    details.appendChild(row);
  });

  details.appendChild(createDivider(tokens));

  // Tools Grid
  const toolLabel = createText({ text: 'РАЗРЕШЁННЫЕ ИНСТРУМЕНТЫ', size: 10, weight: 'Bold', color: tokens.textMuted });
  details.appendChild(toolLabel);

  const toolGrid = createAutoLayoutFrame({
    name: 'Tool Grid',
    layoutMode: 'HORIZONTAL',
    spacing: 12,
    layoutAlign: 'STRETCH'
  });
  const tools = [
    { name: 'Filesystem MCP', desc: 'Чтение структуры директорий' },
    { name: 'GitHub MCP', desc: 'Аудит и ревью pull requests' },
    { name: 'Second Brain', desc: 'Семантический поиск по базе' }
  ];
  tools.forEach(t => {
    const box = createAutoLayoutFrame({
      name: `Tool / ${t.name}`,
      layoutMode: 'VERTICAL',
      spacing: 6,
      padding: 14,
      cornerRadius: 8,
      fill: tokens.bgSurfaceSubtle,
      stroke: tokens.borderDefault,
      layoutGrow: 1
    });
    box.appendChild(createText({ text: t.name, size: 12, weight: 'Bold', color: tokens.textPrimary }));
    box.appendChild(createText({ text: t.desc, size: 11, color: tokens.textSecondary }));
    toolGrid.appendChild(box);
  });
  details.appendChild(toolGrid);

  columns.appendChild(details);
  contentArea.appendChild(columns);

  return frame;
}
