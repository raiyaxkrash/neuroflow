import { ThemeMode, getTokens } from '../design-tokens';
import { createAutoLayoutFrame, createText, createButton } from '../components/helpers';
import { createScreenShell } from '../components/LayoutComponents';
import { createMcpCard } from '../components/Cards';

export function createMcpHubScreen(theme: ThemeMode): FrameNode {
  const tokens = getTokens(theme);
  const themeLabel = theme === 'dark' ? 'Dark' : 'Light';
  const { frame, contentArea } = createScreenShell(`NeuroFlow / MCP Hub (${themeLabel})`, 'mcp', tokens);

  // Hero
  const hero = createAutoLayoutFrame({
    name: 'Hero Section',
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    layoutAlign: 'STRETCH',
    counterAxisAlignItems: 'MAX'
  });
  const heroTextCol = createAutoLayoutFrame({ name: 'Hero Text', layoutMode: 'VERTICAL', spacing: 4 });
  heroTextCol.appendChild(createText({ text: 'MODEL CONTEXT PROTOCOL / РАСШИРЕНИЯ', size: 10, weight: 'Bold', color: tokens.statusSuccess }));
  heroTextCol.appendChild(createText({ text: 'MCP Hub', size: 28, weight: 'Bold', color: tokens.textPrimary }));
  heroTextCol.appendChild(createText({ text: 'Локальные серверы инструментов, проверка работоспособности и контроль доступов.', size: 13, color: tokens.textSecondary }));
  hero.appendChild(heroTextCol);

  const heroActions = createAutoLayoutFrame({ name: 'Actions', layoutMode: 'HORIZONTAL', spacing: 8 });
  heroActions.appendChild(createButton('Проверить все (Health Check)', 'secondary', tokens));
  heroActions.appendChild(createButton('+ Добавить сервер', 'primary', tokens));
  hero.appendChild(heroActions);
  contentArea.appendChild(hero);

  // MCP Grid (2 rows of 3 columns)
  const gridRow1 = createAutoLayoutFrame({
    name: 'Grid Row 1',
    layoutMode: 'HORIZONTAL',
    spacing: 16,
    layoutAlign: 'STRETCH'
  });
  gridRow1.appendChild(createMcpCard(
    'Filesystem MCP',
    'stdio (server-filesystem)',
    'c:\\Users\\Professional\\Documents\\antigravity\\beautiful-bardeen',
    'Онлайн',
    '2.4ms',
    ['read_file', 'write_file', 'list_directory'],
    tokens
  ));
  gridRow1.appendChild(createMcpCard(
    'GitHub MCP',
    'stdio (server-github)',
    'repo: personal-neuroflow',
    'Онлайн',
    '82.1ms',
    ['create_pull_request', 'list_commits', 'get_file_contents'],
    tokens
  ));
  gridRow1.appendChild(createMcpCard(
    'PostgreSQL Local',
    'stdio (server-postgres)',
    'postgresql://localhost:5432/neuroflow_db',
    'Онлайн',
    '4.8ms',
    ['query', 'list_tables', 'describe_table'],
    tokens
  ));
  contentArea.appendChild(gridRow1);

  const gridRow2 = createAutoLayoutFrame({
    name: 'Grid Row 2',
    layoutMode: 'HORIZONTAL',
    spacing: 16,
    layoutAlign: 'STRETCH'
  });
  gridRow2.appendChild(createMcpCard(
    'Brave Search MCP',
    'stdio (server-brave-search)',
    'api.search.brave.com',
    'Онлайн',
    '140ms',
    ['brave_web_search', 'brave_local_search'],
    tokens
  ));
  gridRow2.appendChild(createMcpCard(
    'Docker Engine MCP',
    'pipe //./pipe/docker_engine',
    'daemon: v27.3.1 (Desktop Linux)',
    'Онлайн',
    '6.1ms',
    ['list_containers', 'container_logs'],
    tokens
  ));
  // Empty placeholder frame for 3rd spot
  const placeholder = figma.createFrame();
  placeholder.name = 'Placeholder';
  placeholder.fills = [];
  placeholder.layoutGrow = 1;
  gridRow2.appendChild(placeholder);

  contentArea.appendChild(gridRow2);

  return frame;
}
