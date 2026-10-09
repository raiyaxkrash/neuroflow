/**
 * NeuroFlow Design System Tokens for Figma
 * Official Figma Plugin API compatible
 */

export type ThemeMode = 'light' | 'dark';

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export interface RGBAColor extends RGBColor {
  a: number;
}

export function hexToRgb(hex: string): RGBColor {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  const r = ((bigint >> 16) & 255) / 255;
  const g = ((bigint >> 8) & 255) / 255;
  const b = (bigint & 255) / 255;
  return { r, g, b };
}

export function solidPaint(hex: string, opacity: number = 1): SolidPaint {
  return {
    type: 'SOLID',
    color: hexToRgb(hex),
    opacity
  };
}

export interface ThemeColors {
  bgCanvas: string;
  bgSurface: string;
  bgSurfaceSubtle: string;
  bgSurfaceElevated: string;
  bgSidebar: string;
  bgSidebarHover: string;
  bgSidebarActive: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textSidebar: string;
  textSidebarMuted: string;

  borderDefault: string;
  borderSubtle: string;
  borderStrong: string;

  accentPrimary: string;
  accentPrimaryText: string;
  accentHighlight: string;
  accentHighlightText: string;

  statusSuccess: string;
  statusSuccessBg: string;
  statusWarning: string;
  statusWarningBg: string;
  statusError: string;
  statusErrorBg: string;
  statusInfo: string;
  statusInfoBg: string;
}

export const lightTokens: ThemeColors = {
  bgCanvas: '#F6F7F4',
  bgSurface: '#FFFFFF',
  bgSurfaceSubtle: '#F0F4EE',
  bgSurfaceElevated: '#FFFFFF',
  bgSidebar: '#17241D',
  bgSidebarHover: '#23352A',
  bgSidebarActive: '#2F4336',

  textPrimary: '#1E2A22',
  textSecondary: '#586A5E',
  textMuted: '#84968B',
  textSidebar: '#D4DFD4',
  textSidebarMuted: '#81998B',

  borderDefault: '#E0E6DD',
  borderSubtle: '#EBF0E9',
  borderStrong: '#CCD6C8',

  accentPrimary: '#243A2B',
  accentPrimaryText: '#FFFFFF',
  accentHighlight: '#C9ED84',
  accentHighlightText: '#17241D',

  statusSuccess: '#2E6844',
  statusSuccessBg: '#EBF5EE',
  statusWarning: '#9E6720',
  statusWarningBg: '#FAF1E3',
  statusError: '#B43434',
  statusErrorBg: '#FDF0F0',
  statusInfo: '#2563EB',
  statusInfoBg: '#EFF6FF'
};

export const darkTokens: ThemeColors = {
  bgCanvas: '#0E1512',
  bgSurface: '#141E19',
  bgSurfaceSubtle: '#192720',
  bgSurfaceElevated: '#1E2E25',
  bgSidebar: '#0A110D',
  bgSidebarHover: '#15221B',
  bgSidebarActive: '#1D2F25',

  textPrimary: '#ECF3ED',
  textSecondary: '#9CB3A3',
  textMuted: '#657C6C',
  textSidebar: '#D4DFD4',
  textSidebarMuted: '#748C7C',

  borderDefault: '#23352B',
  borderSubtle: '#1A2921',
  borderStrong: '#334C3E',

  accentPrimary: '#C9ED84',
  accentPrimaryText: '#0D1610',
  accentHighlight: '#C9ED84',
  accentHighlightText: '#17241D',

  statusSuccess: '#4ADE80',
  statusSuccessBg: '#132A1C',
  statusWarning: '#FBBF24',
  statusWarningBg: '#2D240E',
  statusError: '#F87171',
  statusErrorBg: '#2F1414',
  statusInfo: '#60A5FA',
  statusInfoBg: '#132035'
};

export function getTokens(mode: ThemeMode): ThemeColors {
  return mode === 'dark' ? darkTokens : lightTokens;
}

export const typography = {
  labelCaps: { family: 'Inter', style: 'Bold', size: 10, lineHeight: 14, letterSpacing: 1.2 },
  text2xs: { family: 'Inter', style: 'Medium', size: 11, lineHeight: 15 },
  textXs: { family: 'Inter', style: 'Medium', size: 12, lineHeight: 16 },
  textSm: { family: 'Inter', style: 'Regular', size: 13, lineHeight: 18 },
  textSmSemibold: { family: 'Inter', style: 'Semi Bold', size: 13, lineHeight: 18 },
  textBase: { family: 'Inter', style: 'Semi Bold', size: 14, lineHeight: 20 },
  textMd: { family: 'Inter', style: 'Semi Bold', size: 15, lineHeight: 22 },
  textLg: { family: 'Inter', style: 'Semi Bold', size: 17, lineHeight: 24 },
  textXl: { family: 'Inter', style: 'Bold', size: 22, lineHeight: 28 },
  text2xl: { family: 'Inter', style: 'Bold', size: 26, lineHeight: 32 },
  text3xl: { family: 'Inter', style: 'Bold', size: 30, lineHeight: 38 }
};
