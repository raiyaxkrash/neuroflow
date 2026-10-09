import { ThemeColors, solidPaint } from '../design-tokens';

export interface FrameOptions {
  name: string;
  layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
  spacing?: number;
  padding?: number | [number, number] | [number, number, number, number];
  cornerRadius?: number;
  fill?: string;
  stroke?: string;
  strokeWeight?: number;
  width?: number;
  height?: number;
  primaryAxisAlignItems?: 'MIN' | 'MAX' | 'CENTER' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'MIN' | 'MAX' | 'CENTER' | 'BASELINE';
  layoutGrow?: number;
  layoutAlign?: 'INHERIT' | 'STRETCH';
}

export function createAutoLayoutFrame(options: FrameOptions): FrameNode {
  const frame = figma.createFrame();
  frame.name = options.name;

  if (options.layoutMode && options.layoutMode !== 'NONE') {
    frame.layoutMode = options.layoutMode;
    frame.itemSpacing = options.spacing || 0;

    if (typeof options.padding === 'number') {
      frame.paddingTop = options.padding;
      frame.paddingBottom = options.padding;
      frame.paddingLeft = options.padding;
      frame.paddingRight = options.padding;
    } else if (Array.isArray(options.padding)) {
      if (options.padding.length === 2) {
        frame.paddingTop = options.padding[0];
        frame.paddingBottom = options.padding[0];
        frame.paddingLeft = options.padding[1];
        frame.paddingRight = options.padding[1];
      } else if (options.padding.length === 4) {
        frame.paddingTop = options.padding[0];
        frame.paddingRight = options.padding[1];
        frame.paddingBottom = options.padding[2];
        frame.paddingLeft = options.padding[3];
      }
    }

    if (options.primaryAxisAlignItems) {
      frame.primaryAxisAlignItems = options.primaryAxisAlignItems;
    }
    if (options.counterAxisAlignItems) {
      frame.counterAxisAlignItems = options.counterAxisAlignItems;
    }
  }

  if (options.cornerRadius !== undefined) {
    frame.cornerRadius = options.cornerRadius;
  }

  if (options.fill) {
    frame.fills = [solidPaint(options.fill)];
  } else {
    frame.fills = [];
  }

  if (options.stroke) {
    frame.strokes = [solidPaint(options.stroke)];
    frame.strokeWeight = options.strokeWeight || 1;
  } else {
    frame.strokes = [];
  }

  if (options.width !== undefined && options.height !== undefined) {
    frame.resize(options.width, options.height);
  } else if (options.width !== undefined) {
    frame.resize(options.width, frame.height);
  } else if (options.height !== undefined) {
    frame.resize(frame.width, options.height);
  }

  if (options.layoutGrow !== undefined) {
    frame.layoutGrow = options.layoutGrow;
  }
  if (options.layoutAlign) {
    frame.layoutAlign = options.layoutAlign;
  }

  return frame;
}

export interface TextOptions {
  text: string;
  size?: number;
  weight?: 'Regular' | 'Medium' | 'Semi Bold' | 'Bold';
  color: string;
  name?: string;
  width?: number;
  lineHeight?: number;
  letterSpacing?: number;
  layoutAlign?: 'INHERIT' | 'STRETCH';
  layoutGrow?: number;
}

export function createText(options: TextOptions): TextNode {
  const node = figma.createText();
  node.name = options.name || options.text.slice(0, 20);

  const styleName = options.weight || 'Regular';
  node.fontName = { family: 'Inter', style: styleName };
  node.fontSize = options.size || 13;
  node.characters = options.text;
  node.fills = [solidPaint(options.color)];

  if (options.width !== undefined) {
    node.textAutoResize = 'HEIGHT';
    node.resize(options.width, node.height);
  }
  if (options.lineHeight) {
    node.lineHeight = { value: options.lineHeight, unit: 'PIXELS' };
  }
  if (options.letterSpacing) {
    node.letterSpacing = { value: options.letterSpacing, unit: 'PERCENT' };
  }
  if (options.layoutAlign) {
    node.layoutAlign = options.layoutAlign;
  }
  if (options.layoutGrow !== undefined) {
    node.layoutGrow = options.layoutGrow;
  }

  return node;
}

export function createStatusDot(color: string, size: number = 6): EllipseNode {
  const dot = figma.createEllipse();
  dot.name = 'Status Dot';
  dot.resize(size, size);
  dot.fills = [solidPaint(color)];
  return dot;
}

export function createBadge(text: string, type: 'success' | 'warning' | 'error' | 'neutral', tokens: ThemeColors): FrameNode {
  let bg = tokens.statusSuccessBg;
  let fg = tokens.statusSuccess;

  if (type === 'warning') {
    bg = tokens.statusWarningBg;
    fg = tokens.statusWarning;
  } else if (type === 'error') {
    bg = tokens.statusErrorBg;
    fg = tokens.statusError;
  } else if (type === 'neutral') {
    bg = tokens.bgSurfaceSubtle;
    fg = tokens.textSecondary;
  }

  const badge = createAutoLayoutFrame({
    name: `Badge / ${text}`,
    layoutMode: 'HORIZONTAL',
    spacing: 5,
    padding: [4, 8],
    cornerRadius: 5,
    fill: bg,
    stroke: fg,
    strokeWeight: 1,
    counterAxisAlignItems: 'CENTER'
  });

  const dot = createStatusDot(fg, 5);
  const label = createText({
    text,
    size: 10,
    weight: 'Semi Bold',
    color: fg
  });

  badge.appendChild(dot);
  badge.appendChild(label);
  return badge;
}

export function createButton(text: string, variant: 'primary' | 'secondary' | 'dark', tokens: ThemeColors): FrameNode {
  let fill = tokens.bgSurface;
  let color = tokens.textPrimary;
  let stroke = tokens.borderDefault;

  if (variant === 'primary' || variant === 'dark') {
    fill = tokens.accentPrimary;
    color = tokens.accentPrimaryText;
    stroke = tokens.accentPrimary;
  }

  const btn = createAutoLayoutFrame({
    name: `Button / ${text}`,
    layoutMode: 'HORIZONTAL',
    spacing: 8,
    padding: [8, 14],
    cornerRadius: 7,
    fill,
    stroke,
    counterAxisAlignItems: 'CENTER'
  });

  const label = createText({
    text,
    size: 12,
    weight: 'Semi Bold',
    color
  });

  btn.appendChild(label);
  return btn;
}

export function createDivider(tokens: ThemeColors, isHorizontal: boolean = true): RectangleNode {
  const rect = figma.createRectangle();
  rect.name = 'Divider';
  if (isHorizontal) {
    rect.resize(100, 1);
    rect.layoutAlign = 'STRETCH';
  } else {
    rect.resize(1, 100);
    rect.layoutAlign = 'STRETCH';
  }
  rect.fills = [solidPaint(tokens.borderSubtle)];
  return rect;
}
