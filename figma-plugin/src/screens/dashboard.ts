import { ThemeMode, getTokens } from '../design-tokens';
import { createAutoLayoutFrame, createText, createButton } from '../components/helpers';
import { createScreenShell } from '../components/LayoutComponents';
import { createMetricStrip, createTaskRow, createAgentCard } from '../components/Cards';

export function createDashboardScreen(theme: ThemeMode): FrameNode {
  const tokens = getTokens(theme);
  const themeLabel = theme === 'dark' ? 'Dark' : 'Light';
  const { frame, contentArea } = createScreenShell(`NeuroFlow / Dashboard (${themeLabel})`, 'overview', tokens);

  // Hero section
  const hero = createAutoLayoutFrame({
    name: 'Hero Section',
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    layoutAlign: 'STRETCH',
    counterAxisAlignItems: 'MAX'
  });
  const heroTextCol = createAutoLayoutFrame({
    name: 'Hero Text',
    layoutMode: 'VERTICAL',
    spacing: 4
  });
  heroTextCol.appendChild(createText({ text: 'ПЕРСОНАЛЬНАЯ СИСТЕМА / WORKSPACE', size: 10, weight: 'Bold', color: tokens.statusSuccess }));
  heroTextCol.appendChild(createText({ text: 'Обзор системы', size: 28, weight: 'Bold', color: tokens.textPrimary }));
  heroTextCol.appendChild(createText({ text: 'Управление локальными агентами, задачами и инфраструктурой.', size: 13, color: tokens.textSecondary }));
  hero.appendChild(heroTextCol);

  const heroActions = createAutoLayoutFrame({
    name: 'Hero Actions',
    layoutMode: 'HORIZONTAL',
    spacing: 8
  });
  heroActions.appendChild(createButton('Сценарии', 'secondary', tokens));
  heroActions.appendChild(createButton('+ Новая задача', 'primary', tokens));
  hero.appendChild(heroActions);
  contentArea.appendChild(hero);

  // Metric Strip
  const metrics = createMetricStrip(tokens);
  contentArea.appendChild(metrics);

  // 2 Column Layout
  const grid = createAutoLayoutFrame({
    name: 'Main Grid',
    layoutMode: 'HORIZONTAL',
    spacing: 20,
    layoutAlign: 'STRETCH',
    layoutGrow: 1
  });

  // Left Column (Tasks + Agents)
  const leftCol = createAutoLayoutFrame({
    name: 'Left Column',
    layoutMode: 'VERTICAL',
    spacing: 20,
    layoutGrow: 2
  });

  // Task Panel
  const taskPanel = createAutoLayoutFrame({
    name: 'Task Panel',
    layoutMode: 'VERTICAL',
    cornerRadius: 10,
    fill: tokens.bgSurface,
    stroke: tokens.borderDefault,
    layoutAlign: 'STRETCH'
  });
  const taskHead = createAutoLayoutFrame({
    name: 'Task Head',
    layoutMode: 'HORIZONTAL',
    padding: [18, 22],
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    layoutAlign: 'STRETCH',
    counterAxisAlignItems: 'CENTER'
  });
  const taskHeadText = createAutoLayoutFrame({ name: 'Head Text', layoutMode: 'VERTICAL', spacing: 2 });
  taskHeadText.appendChild(createText({ text: 'Очередь задач', size: 15, weight: 'Bold', color: tokens.textPrimary }));
  taskHeadText.appendChild(createText({ text: 'Текущий пул автоматизаций личного агента', size: 11, color: tokens.textSecondary }));
  taskHead.appendChild(taskHeadText);
  taskHead.appendChild(createText({ text: 'Создать задачу ↗', size: 12, weight: 'Semi Bold', color: tokens.statusSuccess }));
  taskPanel.appendChild(taskHead);

  // Task Rows
  taskPanel.appendChild(createTaskRow('01', 'Проверить состояние сервисов и пинг MCP', 'Operator', 'В работе', 'Сегодня · 14:42', tokens));
  taskPanel.appendChild(createTaskRow('02', 'Собрать изменения в репозитории и обновить типы', 'Developer', 'Ожидает', 'Сегодня · 14:37', tokens));
  taskPanel.appendChild(createTaskRow('03', 'Индексировать новые заметки в Second Brain', 'Architect', 'Готово', 'Сегодня · 13:58', tokens));
  leftCol.appendChild(taskPanel);

  // Agent mini cards row
  const agentsSection = createAutoLayoutFrame({
    name: 'Agents Section',
    layoutMode: 'VERTICAL',
    spacing: 12,
    layoutAlign: 'STRETCH'
  });
  const agentHead = createAutoLayoutFrame({
    name: 'Agents Head',
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    layoutAlign: 'STRETCH'
  });
  agentHead.appendChild(createText({ text: 'Агенты системы', size: 15, weight: 'Bold', color: tokens.textPrimary }));
  agentHead.appendChild(createText({ text: 'Управление агентами →', size: 12, weight: 'Semi Bold', color: tokens.statusSuccess }));
  agentsSection.appendChild(agentHead);

  const agentsRow = createAutoLayoutFrame({
    name: 'Agents Row',
    layoutMode: 'HORIZONTAL',
    spacing: 12,
    layoutAlign: 'STRETCH'
  });
  agentsRow.appendChild(createAgentCard('O', 'Operator', 'Оркестрация', 'Готов', tokens));
  agentsRow.appendChild(createAgentCard('R', 'Research', 'Поиск и анализ', 'Ожидает', tokens));
  agentsRow.appendChild(createAgentCard('D', 'Developer', 'Код и Git', 'Готов', tokens));
  agentsSection.appendChild(agentsRow);
  leftCol.appendChild(agentsSection);

  grid.appendChild(leftCol);

  // Right Column (Knowledge Card + Activity Feed)
  const rightCol = createAutoLayoutFrame({
    name: 'Right Column',
    layoutMode: 'VERTICAL',
    spacing: 16,
    width: 330
  });

  const knowledgeCard = createAutoLayoutFrame({
    name: 'Knowledge Card',
    layoutMode: 'VERTICAL',
    spacing: 10,
    padding: 22,
    cornerRadius: 10,
    fill: tokens.bgSidebar,
    stroke: tokens.bgSidebarHover,
    layoutAlign: 'STRETCH'
  });
  knowledgeCard.appendChild(createText({ text: 'НЕЙРОФЛОУ / ЗНАНИЯ', size: 10, weight: 'Bold', color: tokens.textSidebarMuted }));
  knowledgeCard.appendChild(createText({ text: 'Контекст всегда под рукой.', size: 17, weight: 'Bold', color: '#FFFFFF' }));
  knowledgeCard.appendChild(createText({ text: 'Заметки, архитектурные решения и спецификации MCP подключены к единому индексу.', size: 11, color: '#B1C6B4' }));
  knowledgeCard.appendChild(createText({ text: 'Открыть Second Brain →', size: 12, weight: 'Semi Bold', color: tokens.accentHighlight }));
  rightCol.appendChild(knowledgeCard);

  const activityPanel = createAutoLayoutFrame({
    name: 'Activity Mini Panel',
    layoutMode: 'VERTICAL',
    spacing: 12,
    padding: 18,
    cornerRadius: 10,
    fill: tokens.bgSurface,
    stroke: tokens.borderDefault,
    layoutAlign: 'STRETCH'
  });
  activityPanel.appendChild(createText({ text: 'Последние события', size: 14, weight: 'Bold', color: tokens.textPrimary }));
  activityPanel.appendChild(createText({ text: '14:42 Operator выполнил маршрутизацию', size: 11, color: tokens.textSecondary }));
  activityPanel.appendChild(createText({ text: '14:38 Second Brain обновил векторный индекс', size: 11, color: tokens.textSecondary }));
  activityPanel.appendChild(createText({ text: '13:50 Пинг MCP: все 5 серверов активны', size: 11, color: tokens.textSecondary }));
  rightCol.appendChild(activityPanel);

  grid.appendChild(rightCol);
  contentArea.appendChild(grid);

  return frame;
}
