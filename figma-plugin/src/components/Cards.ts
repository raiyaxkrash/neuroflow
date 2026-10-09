import { ThemeColors } from '../design-tokens';
import { createAutoLayoutFrame, createText, createBadge, createStatusDot, createDivider } from './helpers';

export function createMetricStrip(tokens: ThemeColors): FrameNode {
  const strip = createAutoLayoutFrame({
    name: 'Metric Strip',
    layoutMode: 'HORIZONTAL',
    cornerRadius: 10,
    fill: tokens.bgSurface,
    stroke: tokens.borderDefault,
    layoutAlign: 'STRETCH'
  });

  const metrics = [
    { label: 'В очереди', val: '03', unit: 'задачи', sub: '1 выполняется сейчас' },
    { label: 'Агенты активны', val: '03', unit: 'из 04', sub: 'Operator, Developer, Architect' },
    { label: 'MCP Серверы', val: '05', unit: 'подключено', sub: '20 инструментов готово' },
    { label: 'Second Brain', val: '32', unit: 'заметки', sub: 'Локальный векторный индекс' }
  ];

  metrics.forEach((m, idx) => {
    const box = createAutoLayoutFrame({
      name: `Metric / ${m.label}`,
      layoutMode: 'VERTICAL',
      spacing: 6,
      padding: [18, 22],
      layoutGrow: 1
    });

    const labelRow = createAutoLayoutFrame({
      name: 'Label Row',
      layoutMode: 'HORIZONTAL',
      primaryAxisAlignItems: 'SPACE_BETWEEN',
      layoutAlign: 'STRETCH'
    });
    labelRow.appendChild(createText({ text: m.label, size: 11, weight: 'Semi Bold', color: tokens.textSecondary }));
    labelRow.appendChild(createText({ text: '↗', size: 11, color: tokens.textMuted }));
    box.appendChild(labelRow);

    const valRow = createAutoLayoutFrame({
      name: 'Value Row',
      layoutMode: 'HORIZONTAL',
      spacing: 6,
      counterAxisAlignItems: 'BASELINE'
    });
    valRow.appendChild(createText({ text: m.val, size: 26, weight: 'Bold', color: tokens.textPrimary }));
    valRow.appendChild(createText({ text: m.unit, size: 11, color: tokens.textMuted }));
    box.appendChild(valRow);

    const subRow = createAutoLayoutFrame({
      name: 'Sub Row',
      layoutMode: 'HORIZONTAL',
      spacing: 6,
      counterAxisAlignItems: 'CENTER'
    });
    subRow.appendChild(createStatusDot(tokens.statusSuccess, 6));
    subRow.appendChild(createText({ text: m.sub, size: 11, color: tokens.textMuted }));
    box.appendChild(subRow);

    strip.appendChild(box);

    if (idx < metrics.length - 1) {
      strip.appendChild(createDivider(tokens, false));
    }
  });

  return strip;
}

export function createTaskRow(index: string, title: string, agent: string, state: 'В работе' | 'Ожидает' | 'Готово', meta: string, tokens: ThemeColors): FrameNode {
  const row = createAutoLayoutFrame({
    name: `Task Row / ${index}`,
    layoutMode: 'HORIZONTAL',
    spacing: 12,
    padding: [14, 22],
    fill: tokens.bgSurface,
    layoutAlign: 'STRETCH',
    counterAxisAlignItems: 'CENTER'
  });

  const idxText = createText({ text: index, size: 11, color: tokens.textMuted });
  row.appendChild(idxText);

  const mainCol = createAutoLayoutFrame({
    name: 'Task Info',
    layoutMode: 'VERTICAL',
    spacing: 3,
    layoutGrow: 1
  });
  mainCol.appendChild(createText({ text: title, size: 13, weight: 'Semi Bold', color: tokens.textPrimary }));
  mainCol.appendChild(createText({ text: meta, size: 11, color: tokens.textMuted }));
  row.appendChild(mainCol);

  const agentCol = createAutoLayoutFrame({
    name: 'Agent Ref',
    layoutMode: 'HORIZONTAL',
    spacing: 6,
    width: 120,
    counterAxisAlignItems: 'CENTER'
  });
  const tinyBadge = createAutoLayoutFrame({
    name: 'Initial',
    width: 20,
    height: 20,
    cornerRadius: 4,
    fill: tokens.bgSurfaceSubtle,
    stroke: tokens.borderDefault,
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'CENTER'
  });
  tinyBadge.appendChild(createText({ text: agent[0], size: 10, weight: 'Bold', color: tokens.textPrimary }));
  agentCol.appendChild(tinyBadge);
  agentCol.appendChild(createText({ text: agent, size: 11, color: tokens.textSecondary }));
  row.appendChild(agentCol);

  const badgeType = state === 'В работе' ? 'success' : state === 'Ожидает' ? 'warning' : 'neutral';
  const badge = createBadge(state, badgeType, tokens);
  row.appendChild(badge);

  return row;
}

export function createAgentCard(initial: string, name: string, role: string, state: string, tokens: ThemeColors): FrameNode {
  const card = createAutoLayoutFrame({
    name: `Agent Card / ${name}`,
    layoutMode: 'VERTICAL',
    spacing: 14,
    padding: 16,
    cornerRadius: 10,
    fill: tokens.bgSurface,
    stroke: tokens.borderDefault,
    layoutGrow: 1
  });

  const top = createAutoLayoutFrame({
    name: 'Top Info',
    layoutMode: 'HORIZONTAL',
    spacing: 10,
    counterAxisAlignItems: 'CENTER'
  });
  const avatar = createAutoLayoutFrame({
    name: 'Monogram',
    width: 32,
    height: 32,
    cornerRadius: 6,
    fill: tokens.bgSurfaceSubtle,
    stroke: tokens.borderDefault,
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'CENTER'
  });
  avatar.appendChild(createText({ text: initial, size: 12, weight: 'Bold', color: tokens.textPrimary }));
  top.appendChild(avatar);

  const textCol = createAutoLayoutFrame({
    name: 'Text Col',
    layoutMode: 'VERTICAL',
    spacing: 2
  });
  textCol.appendChild(createText({ text: name, size: 13, weight: 'Semi Bold', color: tokens.textPrimary }));
  textCol.appendChild(createText({ text: role, size: 11, color: tokens.textMuted }));
  top.appendChild(textCol);
  card.appendChild(top);

  const bottom = createAutoLayoutFrame({
    name: 'Bottom Row',
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    layoutAlign: 'STRETCH',
    counterAxisAlignItems: 'CENTER'
  });
  const statusBox = createAutoLayoutFrame({
    name: 'Status Box',
    layoutMode: 'HORIZONTAL',
    spacing: 6,
    counterAxisAlignItems: 'CENTER'
  });
  statusBox.appendChild(createStatusDot(state === 'Ожидает' ? tokens.statusWarning : tokens.statusSuccess, 6));
  statusBox.appendChild(createText({ text: state, size: 11, color: tokens.textSecondary }));
  bottom.appendChild(statusBox);
  bottom.appendChild(createText({ text: '↗', size: 12, color: tokens.textMuted }));

  card.appendChild(bottom);
  return card;
}

export function createMcpCard(name: string, transport: string, pathStr: string, status: string, latency: string, tools: string[], tokens: ThemeColors): FrameNode {
  const card = createAutoLayoutFrame({
    name: `MCP Card / ${name}`,
    layoutMode: 'VERTICAL',
    spacing: 12,
    padding: 20,
    cornerRadius: 10,
    fill: tokens.bgSurface,
    stroke: tokens.borderDefault,
    layoutGrow: 1
  });

  const head = createAutoLayoutFrame({
    name: 'Header',
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    layoutAlign: 'STRETCH',
    counterAxisAlignItems: 'CENTER'
  });
  const titleBox = createAutoLayoutFrame({
    name: 'Title Box',
    layoutMode: 'VERTICAL',
    spacing: 2
  });
  titleBox.appendChild(createText({ text: name, size: 14, weight: 'Bold', color: tokens.textPrimary }));
  titleBox.appendChild(createText({ text: transport, size: 11, color: tokens.textMuted }));
  head.appendChild(titleBox);

  head.appendChild(createBadge(status, status === 'Онлайн' ? 'success' : 'warning', tokens));
  card.appendChild(head);

  const metaBox = createAutoLayoutFrame({
    name: 'Meta Box',
    layoutMode: 'VERTICAL',
    spacing: 6,
    padding: 10,
    cornerRadius: 6,
    fill: tokens.bgSurfaceSubtle,
    layoutAlign: 'STRETCH'
  });
  metaBox.appendChild(createText({ text: `Target: ${pathStr}`, size: 11, color: tokens.textSecondary }));
  metaBox.appendChild(createText({ text: `IPC Latency: ${latency}`, size: 11, weight: 'Semi Bold', color: tokens.textPrimary }));
  card.appendChild(metaBox);

  const toolLabel = createText({ text: `ДОСТУПНЫЕ ИНСТРУМЕНТЫ (${tools.length})`, size: 10, weight: 'Bold', color: tokens.textMuted });
  card.appendChild(toolLabel);

  const toolRow = createAutoLayoutFrame({
    name: 'Tools Row',
    layoutMode: 'HORIZONTAL',
    spacing: 6
  });
  tools.slice(0, 3).forEach(t => {
    const pill = createAutoLayoutFrame({
      name: `Tool / ${t}`,
      padding: [4, 8],
      cornerRadius: 4,
      fill: tokens.bgSurface,
      stroke: tokens.borderDefault
    });
    pill.appendChild(createText({ text: t, size: 10, color: tokens.textSecondary }));
    toolRow.appendChild(pill);
  });
  card.appendChild(toolRow);

  return card;
}
