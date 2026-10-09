import { describe, it, expect } from 'vitest';
import { DesktopCompanionService } from '@neuroflow/nodes';

describe('DesktopCompanionService (Windows Host Security)', () => {
  const companion = DesktopCompanionService.getInstance({
    apiKey: 'test-secret-token-2026',
    allowedProcesses: ['notepad', 'calc', 'chrome'],
  });

  it('должен корректно проверять Bearer токен авторизации', () => {
    expect(companion.verifyToken('Bearer test-secret-token-2026')).toBe(true);
    expect(companion.verifyToken('test-secret-token-2026')).toBe(true);
    expect(companion.verifyToken('Bearer invalid-token')).toBe(false);
    expect(companion.verifyToken('')).toBe(false);
    expect(companion.verifyToken(undefined)).toBe(false);
  });

  it('должен разрешать процессы из белого списка (whitelist)', () => {
    expect(companion.isProcessAllowed('notepad')).toBe(true);
    expect(companion.isProcessAllowed('notepad.exe')).toBe(true);
    expect(companion.isProcessAllowed('calc')).toBe(true);
    expect(companion.isProcessAllowed('chrome')).toBe(true);
  });

  it('должен блокировать процессы командных оболочек и недоверенных программ', () => {
    expect(companion.isProcessAllowed('powershell')).toBe(false);
    expect(companion.isProcessAllowed('powershell.exe')).toBe(false);
    expect(companion.isProcessAllowed('cmd')).toBe(false);
    expect(companion.isProcessAllowed('cmd.exe')).toBe(false);
    expect(companion.isProcessAllowed('bash')).toBe(false);
    expect(companion.isProcessAllowed('regedit')).toBe(false);
  });

  it('должен выбрасывать ошибку безопасности при попытке фокусировки запрещенного процесса', async () => {
    await expect(companion.focusWindow('powershell')).rejects.toThrow('не входит в белый список');
    await expect(companion.focusWindow('cmd.exe')).rejects.toThrow('не входит в белый список');
  });

  it('должен выбрасывать ошибку безопасности при попытке отправки клавиш в запрещенный процесс', async () => {
    await expect(companion.sendKeys('cmd', 'echo hacked')).rejects.toThrow('не входит в белый список');
  });

  it('должен возвращать статус службы с метаданными и списком разрешенных приложений', () => {
    const status = companion.getStatus();
    expect(status.name).toContain('Desktop Companion');
    expect(status.isConfigured).toBe(true);
    expect(status.allowedProcesses).toContain('notepad');
    expect(status.allowedProcesses).toContain('calc');
    expect(status.allowedProcesses).not.toContain('powershell');
  });

  it('должен возвращать список окон только для разрешенных процессов', async () => {
    const windows = await companion.listWindows();
    expect(Array.isArray(windows)).toBe(true);
    for (const win of windows) {
      expect(companion.isProcessAllowed(win.processName)).toBe(true);
    }
  });
});
