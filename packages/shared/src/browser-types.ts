import { z } from 'zod';

export const BrowserStartParametersSchema = z.object({
  browserType: z.enum(['chromium', 'firefox', 'webkit']).default('chromium'),
  headless: z.boolean().default(true),
  viewport: z.object({
    width: z.number().int().positive().default(1280),
    height: z.number().int().positive().default(800),
  }).default({ width: 1280, height: 800 }),
  timeoutMs: z.number().int().positive().default(30000),
  sessionName: z.string().optional(),
  saveCookies: z.boolean().default(false),
  profileId: z.string().optional(),
  allowLocalhost: z.boolean().default(false),
});

export type BrowserStartParameters = z.infer<typeof BrowserStartParametersSchema>;

export const BrowserNavigateParametersSchema = z.object({
  sessionId: z.string().optional(),
  url: z.string().min(1),
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle', 'commit']).default('domcontentloaded'),
  timeoutMs: z.number().int().positive().default(30000),
  allowLocalhost: z.boolean().default(false),
});

export type BrowserNavigateParameters = z.infer<typeof BrowserNavigateParametersSchema>;

export const BrowserClickParametersSchema = z.object({
  sessionId: z.string().optional(),
  selector: z.string().min(1),
  button: z.enum(['left', 'right', 'middle']).default('left'),
  clickCount: z.number().int().positive().default(1),
  timeoutMs: z.number().int().positive().default(15000),
});

export type BrowserClickParameters = z.infer<typeof BrowserClickParametersSchema>;

export const BrowserTypeParametersSchema = z.object({
  sessionId: z.string().optional(),
  selector: z.string().min(1),
  text: z.string(),
  clearBefore: z.boolean().default(true),
  pressEnter: z.boolean().default(false),
  delayMs: z.number().int().nonnegative().default(10),
  timeoutMs: z.number().int().positive().default(15000),
});

export type BrowserTypeParameters = z.infer<typeof BrowserTypeParametersSchema>;

export const BrowserExtractParametersSchema = z.object({
  sessionId: z.string().optional(),
  selector: z.string().default('body'),
  extractType: z.enum(['text', 'html', 'attribute', 'table', 'all_elements']).default('text'),
  attributeName: z.string().optional(),
  timeoutMs: z.number().int().positive().default(15000),
});

export type BrowserExtractParameters = z.infer<typeof BrowserExtractParametersSchema>;

export const BrowserScreenshotParametersSchema = z.object({
  sessionId: z.string().optional(),
  selector: z.string().optional(),
  fullPage: z.boolean().default(false),
  format: z.enum(['png', 'jpeg']).default('png'),
  quality: z.number().int().min(1).max(100).optional(),
  saveToPath: z.string().optional(),
});

export type BrowserScreenshotParameters = z.infer<typeof BrowserScreenshotParametersSchema>;

export const BrowserWaitParametersSchema = z.object({
  sessionId: z.string().optional(),
  selector: z.string().min(1),
  state: z.enum(['visible', 'hidden', 'attached', 'detached']).default('visible'),
  timeoutMs: z.number().int().positive().default(15000),
});

export type BrowserWaitParameters = z.infer<typeof BrowserWaitParametersSchema>;

export const BrowserDownloadParametersSchema = z.object({
  sessionId: z.string().optional(),
  clickSelector: z.string().optional(),
  downloadUrl: z.string().optional(),
  targetDirectory: z.string().optional(),
  filename: z.string().optional(),
  timeoutMs: z.number().int().positive().default(30000),
});

export type BrowserDownloadParameters = z.infer<typeof BrowserDownloadParametersSchema>;

export const BrowserCloseParametersSchema = z.object({
  sessionId: z.string().optional(),
  saveStorageState: z.boolean().default(false),
});

export type BrowserCloseParameters = z.infer<typeof BrowserCloseParametersSchema>;

export const AIBrowserAgentParametersSchema = z.object({
  task: z.string().min(1),
  startUrl: z.string().min(1),
  maxSteps: z.number().int().min(1).max(30).default(12),
  providerId: z.string().optional(),
  model: z.string().optional(),
  allowLocalhost: z.boolean().default(false),
  requireApprovalForActions: z.boolean().default(false),
  timeoutMs: z.number().int().positive().default(60000),
});

export type AIBrowserAgentParameters = z.infer<typeof AIBrowserAgentParametersSchema>;

export interface BrowserActionLog {
  action: string;
  target?: string;
  parameters?: Record<string, any>;
  timestamp: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface BrowserSessionSummary {
  id: string;
  name?: string;
  status: 'active' | 'idle' | 'closed' | 'error';
  currentUrl?: string;
  title?: string;
  createdAt: string;
  lastActivityAt: string;
  actionCount: number;
  latestScreenshotBase64?: string;
}

export interface DesktopWindowSummary {
  handle: string | number;
  title: string;
  processName: string;
  isActive: boolean;
  bounds?: { x: number; y: number; width: number; height: number };
}
