import { ThemeMode, getTokens } from '../design-tokens';
import { createAutoLayoutFrame, createText, createButton, createBadge, createDivider } from '../components/helpers';
import { createScreenShell } from '../components/LayoutComponents';

export function createSecondBrainScreen(theme: ThemeMode): FrameNode {
  const tokens = getTokens(theme);
  const themeLabel = theme === 'dark' ? 'Dark' : 'Light';
  const { frame, contentArea } = createScreenShell(`NeuroFlow / Second Brain (${themeLabel})`, 'brain', tokens);

  // Hero
  const hero = createAutoLayoutFrame({
    name: 'Hero Section',
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    layoutAlign: 'STRETCH',
    counterAxisAlignItems: 'MAX'
  });
  const heroTextCol = createAutoLayoutFrame({ name: 'Hero Text', layoutMode: 'VERTICAL', spacing: 4 });
  heroTextCol.appendChild(createText({ text: 'ЛОКАЛЬНАЯ ПАМЯТЬ / БИБЛИОТЕКА', size: 10, weight: 'Bold', color: tokens.statusSuccess }));
  heroTextCol.appendChild(createText({ text: 'Second Brain', size: 28, weight: 'Bold', color: tokens.textPrimary }));
  heroTextCol.appendChild(createText({ text: 'База знаний, технические документы и контекст, на которые опираются агенты.', size: 13, color: tokens.textSecondary }));
  hero.appendChild(heroTextCol);
  hero.appendChild(createButton('+ Новая заметка', 'primary', tokens));
  contentArea.appendChild(hero);

  // 3 Column Knowledge Layout
  const columns = createAutoLayoutFrame({
    name: 'Knowledge Columns',
    layoutMode: 'HORIZONTAL',
    spacing: 16,
    layoutAlign: 'STRETCH',
    layoutGrow: 1
  });

  // Col 1: Folders & Tags (210px)
  const colFolders = createAutoLayoutFrame({
    name: 'Folders Column',
    layoutMode: 'VERTICAL',
    spacing: 16,
    padding: 16,
    cornerRadius: 10,
    fill: tokens.bgSurface,
    stroke: tokens.borderDefault,
    width: 210
  });
  colFolders.appendChild(createText({ text: 'БИБЛИОТЕКА', size: 10, weight: 'Bold', color: tokens.textMuted }));

  const folders = [
    { name: 'Все документы', count: '5', selected: true },
    { name: 'Проекты', count: '2', selected: false },
    { name: 'Агенты', count: '1', selected: false },
    { name: 'Интеграции', count: '1', selected: false },
    { name: 'Сценарии', count: '1', selected: false }
  ];

  folders.forEach(f => {
    const item = createAutoLayoutFrame({
      name: `Folder / ${f.name}`,
      layoutMode: 'HORIZONTAL',
      padding: [8, 10],
      cornerRadius: 6,
      fill: f.selected ? tokens.bgSurfaceSubtle : undefined,
      primaryAxisAlignItems: 'SPACE_BETWEEN',
      layoutAlign: 'STRETCH',
      counterAxisAlignItems: 'CENTER'
    });
    item.appendChild(createText({ text: f.name, size: 12, weight: f.selected ? 'Semi Bold' : 'Regular', color: tokens.textPrimary }));
    item.appendChild(createText({ text: f.count, size: 10, color: tokens.textMuted }));
    colFolders.appendChild(item);
  });

  colFolders.appendChild(createDivider(tokens));
  colFolders.appendChild(createText({ text: 'МЕТКИ', size: 10, weight: 'Bold', color: tokens.textMuted }));

  const tagsRow = createAutoLayoutFrame({ name: 'Tags Row', layoutMode: 'HORIZONTAL', spacing: 6 });
  ['#architecture', '#agents', '#mcp'].forEach(t => {
    const pill = createAutoLayoutFrame({
      name: `Tag / ${t}`,
      padding: [4, 8],
      cornerRadius: 4,
      fill: tokens.bgSurfaceSubtle,
      stroke: tokens.borderDefault
    });
    pill.appendChild(createText({ text: t, size: 10, color: tokens.textSecondary }));
    tagsRow.appendChild(pill);
  });
  colFolders.appendChild(tagsRow);
  columns.appendChild(colFolders);

  // Col 2: Documents List (320px)
  const colDocs = createAutoLayoutFrame({
    name: 'Documents List Column',
    layoutMode: 'VERTICAL',
    spacing: 12,
    padding: 16,
    cornerRadius: 10,
    fill: tokens.bgSurface,
    stroke: tokens.borderDefault,
    width: 320
  });
  colDocs.appendChild(createText({ text: 'ДОКУМЕНТЫ · 5', size: 10, weight: 'Bold', color: tokens.textMuted }));

  const docItems = [
    { title: 'Архитектура NeuroFlow', sub: 'Компоненты, границы и зависимости личной AI-системы.', selected: true },
    { title: 'Роли и ограничения агентов', sub: 'Маршрутизация, делегирование и разрешения.', selected: false },
    { title: 'Подключения MCP Hub', sub: 'Инструменты, серверы и политика разрешений.', selected: false },
    { title: 'Организация памяти', sub: 'Индексация, связи, фильтры и поиск.', selected: false }
  ];

  docItems.forEach(d => {
    const docCard = createAutoLayoutFrame({
      name: `Doc / ${d.title}`,
      layoutMode: 'VERTICAL',
      spacing: 4,
      padding: [12, 14],
      cornerRadius: 8,
      fill: d.selected ? tokens.bgSurfaceSubtle : undefined,
      stroke: d.selected ? tokens.borderStrong : tokens.borderSubtle,
      layoutAlign: 'STRETCH'
    });
    docCard.appendChild(createText({ text: d.title, size: 12.5, weight: 'Semi Bold', color: tokens.textPrimary }));
    docCard.appendChild(createText({ text: d.sub, size: 11, color: tokens.textSecondary }));
    colDocs.appendChild(docCard);
  });
  columns.appendChild(colDocs);

  // Col 3: Document Preview Reader (flex 1)
  const colReader = createAutoLayoutFrame({
    name: 'Preview Reader Column',
    layoutMode: 'VERTICAL',
    spacing: 16,
    padding: 24,
    cornerRadius: 10,
    fill: tokens.bgSurface,
    stroke: tokens.borderDefault,
    layoutGrow: 1
  });
  colReader.appendChild(createText({ text: 'ПРЕДПРОСМОТР', size: 10, weight: 'Bold', color: tokens.statusSuccess }));
  colReader.appendChild(createText({ text: 'Архитектура NeuroFlow', size: 24, weight: 'Bold', color: tokens.textPrimary }));
  colReader.appendChild(createText({ text: 'Проекты · Сегодня 14:10 · Локальный markdown', size: 11, color: tokens.textMuted }));
  colReader.appendChild(createDivider(tokens));

  colReader.appendChild(createText({
    text: 'NeuroFlow — локальное рабочее пространство для управления агентами, задачами, инструментами и собственными знаниями. Главные принципы: суверенитет данных, контроль прав доступа через MCP, наблюдаемость процессов и независимость от облачных вендоров.',
    size: 13,
    color: tokens.textSecondary,
    lineHeight: 20
  }));

  colReader.appendChild(createDivider(tokens));
  colReader.appendChild(createText({ text: 'СВЯЗАННЫЕ ЗНАНИЯ (KNOWLEDGE GRAPH)', size: 10, weight: 'Bold', color: tokens.textMuted }));

  ['Роли и ограничения агентов', 'Подключения MCP Hub', 'Организация векторной памяти'].forEach(rel => {
    const relBox = createAutoLayoutFrame({
      name: `Rel / ${rel}`,
      layoutMode: 'HORIZONTAL',
      padding: [8, 12],
      cornerRadius: 6,
      fill: tokens.bgSurfaceSubtle,
      stroke: tokens.borderDefault,
      primaryAxisAlignItems: 'SPACE_BETWEEN',
      layoutAlign: 'STRETCH'
    });
    relBox.appendChild(createText({ text: rel, size: 12, color: tokens.textPrimary }));
    relBox.appendChild(createText({ text: '↗', size: 12, color: tokens.statusSuccess }));
    colReader.appendChild(relBox);
  });

  columns.appendChild(colReader);
  contentArea.appendChild(columns);

  return frame;
}
