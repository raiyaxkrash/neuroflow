import { ThemeMode, getTokens } from '../design-tokens';
import { createAutoLayoutFrame, createText, createButton, createBadge, createDivider } from '../components/helpers';
import { createScreenShell } from '../components/LayoutComponents';

export function createActivityScreen(theme: ThemeMode): FrameNode {
  const tokens = getTokens(theme);
  const themeLabel = theme === 'dark' ? 'Dark' : 'Light';
  const { frame, contentArea } = createScreenShell(`NeuroFlow / Activity (${themeLabel})`, 'activity', tokens);

  // Hero
  const hero = createAutoLayoutFrame({
    name: 'Hero Section',
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    layoutAlign: 'STRETCH',
    counterAxisAlignItems: 'MAX'
  });
  const heroTextCol = createAutoLayoutFrame({ name: 'Hero Text', layoutMode: 'VERTICAL', spacing: 4 });
  heroTextCol.appendChild(createText({ text: 'НАБЛЮДАЕМОСТЬ / АУДИТ И РАСХОДЫ', size: 10, weight: 'Bold', color: tokens.statusSuccess }));
  heroTextCol.appendChild(createText({ text: 'Журнал и активность', size: 28, weight: 'Bold', color: tokens.textPrimary }));
  heroTextCol.appendChild(createText({ text: 'Полный хронологический лог выполнения, ошибки и учёт расхода токенов моделей.', size: 13, color: tokens.textSecondary }));
  hero.appendChild(heroTextCol);

  const heroActions = createAutoLayoutFrame({ name: 'Actions', layoutMode: 'HORIZONTAL', spacing: 8 });
  heroActions.appendChild(createButton('Экспорт логов', 'secondary', tokens));
  heroActions.appendChild(createButton('Очистить', 'secondary', tokens));
  hero.appendChild(heroActions);
  contentArea.appendChild(hero);

  // Token Metrics Strip
  const tokenStrip = createAutoLayoutFrame({
    name: 'Token Strip',
    layoutMode: 'HORIZONTAL',
    spacing: 16,
    padding: 20,
    cornerRadius: 10,
    fill: tokens.bgSurface,
    stroke: tokens.borderDefault,
    layoutAlign: 'STRETCH'
  });

  const tokenBoxes = [
    { label: 'Токены промптов', val: '248,190' },
    { label: 'Токены генерации', val: '91,420' },
    { label: 'Экономия на кэше', val: '84.2%' },
    { label: 'Оценка затрат (API)', val: '$0.42' }
  ];

  tokenBoxes.forEach(b => {
    const box = createAutoLayoutFrame({
      name: `Token / ${b.label}`,
      layoutMode: 'VERTICAL',
      spacing: 4,
      layoutGrow: 1
    });
    box.appendChild(createText({ text: b.label, size: 11, weight: 'Semi Bold', color: tokens.textSecondary }));
    box.appendChild(createText({ text: b.val, size: 22, weight: 'Bold', color: tokens.textPrimary }));
    tokenStrip.appendChild(box);
  });
  contentArea.appendChild(tokenStrip);

  // Log Table Panel
  const tablePanel = createAutoLayoutFrame({
    name: 'Log Table Panel',
    layoutMode: 'VERTICAL',
    cornerRadius: 10,
    fill: tokens.bgSurface,
    stroke: tokens.borderDefault,
    layoutAlign: 'STRETCH'
  });

  const tableHead = createAutoLayoutFrame({
    name: 'Table Head',
    layoutMode: 'HORIZONTAL',
    padding: [16, 20],
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    layoutAlign: 'STRETCH',
    counterAxisAlignItems: 'CENTER'
  });
  tableHead.appendChild(createText({ text: 'Хронология выполнения операций', size: 14, weight: 'Bold', color: tokens.textPrimary }));
  tableHead.appendChild(createBadge('Все уровни (6)', 'neutral', tokens));
  tablePanel.appendChild(tableHead);
  tablePanel.appendChild(createDivider(tokens));

  const logs = [
    { time: '14:42:10', level: 'SUCCESS', agent: 'Operator', action: 'Маршрутизация задачи «Проверить состояние сервисов»', dur: '120ms' },
    { time: '14:38:05', level: 'SUCCESS', agent: 'Architect', action: 'Векторизация документа «Архитектура NeuroFlow»', dur: '340ms' },
    { time: '14:20:41', level: 'WARN', agent: 'Developer', action: 'Шлюз подтверждения: запрос на изменение git branches', dur: 'Waiting' },
    { time: '14:15:02', level: 'SUCCESS', agent: 'Developer', action: 'Успешная сборка TypeScript дизайн-токенов', dur: '1.2s' },
    { time: '13:58:30', level: 'INFO', agent: 'Operator', action: 'Плановый опрос серверов MCP (Filesystem, GitHub)', dur: '85ms' },
    { time: '12:10:14', level: 'ERROR', agent: 'Research', action: 'Таймаут внешнего поискового шлюза Brave API (HTTP 504)', dur: '5.0s' }
  ];

  logs.forEach(l => {
    const row = createAutoLayoutFrame({
      name: `Log Row / ${l.time}`,
      layoutMode: 'HORIZONTAL',
      spacing: 16,
      padding: [12, 20],
      layoutAlign: 'STRETCH',
      counterAxisAlignItems: 'CENTER'
    });
    row.appendChild(createText({ text: l.time, size: 11, color: tokens.textMuted, width: 90 }));
    row.appendChild(createBadge(l.level, l.level === 'SUCCESS' ? 'success' : l.level === 'WARN' ? 'warning' : l.level === 'ERROR' ? 'error' : 'neutral', tokens));
    row.appendChild(createText({ text: l.agent, size: 12, weight: 'Semi Bold', color: tokens.textPrimary, width: 110 }));
    row.appendChild(createText({ text: l.action, size: 12, color: tokens.textPrimary, layoutGrow: 1 }));
    row.appendChild(createText({ text: l.dur, size: 11, color: tokens.textMuted, width: 60 }));
    tablePanel.appendChild(row);
  });

  contentArea.appendChild(tablePanel);

  return frame;
}
