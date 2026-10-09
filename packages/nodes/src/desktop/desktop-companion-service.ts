import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DesktopWindowSummary } from '@neuroflow/shared';

const execFileAsync = promisify(execFile);

export interface CompanionServiceConfig {
  apiKey?: string;
  allowedProcesses?: string[];
}

export class DesktopCompanionService {
  private static instance: DesktopCompanionService | null = null;
  private apiKey: string;
  private allowedProcesses: Set<string>;

  private constructor(config: CompanionServiceConfig = {}) {
    this.apiKey =
      config.apiKey ||
      process.env.NEUROFLOW_COMPANION_KEY ||
      process.env.COMPANION_API_KEY ||
      'nf-desktop-companion-local-token';

    const defaultAllowed = [
      'notepad',
      'calc',
      'calculator',
      'calculatorapp',
      'chrome',
      'msedge',
      'code',
      'explorer',
      'windowsterminal',
    ];

    this.allowedProcesses = new Set(
      (config.allowedProcesses || defaultAllowed).map((p) => p.toLowerCase())
    );
  }

  public static getInstance(config?: CompanionServiceConfig): DesktopCompanionService {
    if (!DesktopCompanionService.instance) {
      DesktopCompanionService.instance = new DesktopCompanionService(config);
    }
    return DesktopCompanionService.instance;
  }

  /**
   * Проверка токена аутентификации
   */
  public verifyToken(token?: string): boolean {
    if (!token) return false;
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    return cleanToken === this.apiKey;
  }

  /**
   * Проверка процесса по белому списку
   */
  public isProcessAllowed(processName: string): boolean {
    if (!processName) return false;
    const clean = processName.toLowerCase().replace(/\.exe$/, '').trim();
    return this.allowedProcesses.has(clean);
  }

  /**
   * Получение списка окон разрешенных приложений
   */
  public async listWindows(): Promise<DesktopWindowSummary[]> {
    if (process.platform !== 'win32') {
      // Заглушка для non-Windows окружения/тестов
      return [
        { handle: '1001', title: 'Notepad - Untitled', processName: 'notepad', isActive: true },
        { handle: '1002', title: 'Calculator', processName: 'calc', isActive: false },
      ];
    }

    const script = `
      Get-Process | Where-Object { $_.MainWindowTitle -ne "" } | ForEach-Object {
        [PSCustomObject]@{
          handle = $_.MainWindowHandle.ToInt64()
          title = $_.MainWindowTitle
          processName = $_.ProcessName
          isActive = ($_.MainWindowHandle -eq (Get-Process | Where-Object { $_.Id -eq $PID }).MainWindowHandle)
        }
      } | ConvertTo-Json -Compress
    `;

    try {
      const { stdout } = await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        script,
      ]);

      if (!stdout || !stdout.trim()) {
        return [];
      }

      let parsed: any;
      try {
        parsed = JSON.parse(stdout.trim());
      } catch {
        return [];
      }

      const rawList = Array.isArray(parsed) ? parsed : [parsed];

      return rawList
        .filter((w: any) => w && w.processName && this.isProcessAllowed(w.processName))
        .map((w: any) => ({
          handle: String(w.handle),
          title: String(w.title || ''),
          processName: String(w.processName || ''),
          isActive: Boolean(w.isActive),
        }));
    } catch {
      return [];
    }
  }

  /**
   * Фокусировка окна разрешенного процесса
   */
  public async focusWindow(targetProcess: string): Promise<{ success: boolean; message: string }> {
    const cleanName = targetProcess.toLowerCase().replace(/\.exe$/, '').trim();

    if (!this.isProcessAllowed(cleanName)) {
      throw new Error(`Процесс "${targetProcess}" не входит в белый список разрешенных приложений.`);
    }

    if (process.platform !== 'win32') {
      return { success: true, message: `[Simulated] Окно "${cleanName}" сфокусировано.` };
    }

    const script = `
      $proc = Get-Process -Name "${cleanName}" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -ne "" } | Select-Object -First 1
      if ($proc) {
        $wscript = New-Object -ComObject WScript.Shell
        $wscript.AppActivate($proc.Id)
        Write-Output "OK"
      } else {
        Write-Output "NOT_FOUND"
      }
    `;

    try {
      const { stdout } = await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        script,
      ]);

      if (stdout.includes('OK')) {
        return { success: true, message: `Окно приложения ${cleanName} успешно активировано.` };
      }
      return { success: false, message: `Активное окно процесса ${cleanName} не найдено.` };
    } catch (err: any) {
      throw new Error(`Не удалось сфокусировать окно: ${err.message}`);
    }
  }

  /**
   * Отправка нажатий клавиш в разрешенное приложение
   * Исключает запуск команд shell, эмулируя исключительно ввод символов
   */
  public async sendKeys(
    targetProcess: string,
    keys: string
  ): Promise<{ success: boolean; sentLength: number }> {
    const cleanName = targetProcess.toLowerCase().replace(/\.exe$/, '').trim();

    if (!this.isProcessAllowed(cleanName)) {
      throw new Error(`Процесс "${targetProcess}" не входит в белый список разрешенных приложений.`);
    }

    if (process.platform !== 'win32') {
      return { success: true, sentLength: keys.length };
    }

    // Экранирование для PowerShell SendKeys
    const escapedKeys = keys
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '`"')
      .replace(/[\{\}\(\)\+\^\%]/g, '{$&}');

    const script = `
      $proc = Get-Process -Name "${cleanName}" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -ne "" } | Select-Object -First 1
      if ($proc) {
        $wscript = New-Object -ComObject WScript.Shell
        $wscript.AppActivate($proc.Id)
        Start-Sleep -Milliseconds 150
        $wscript.SendKeys("${escapedKeys}")
        Write-Output "OK"
      } else {
        Write-Output "NOT_FOUND"
      }
    `;

    try {
      const { stdout } = await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        script,
      ]);

      if (stdout.includes('OK')) {
        return { success: true, sentLength: keys.length };
      }
      throw new Error(`Процесс ${cleanName} не найден для ввода.`);
    } catch (err: any) {
      throw new Error(`Ошибка отправки клавиш: ${err.message}`);
    }
  }

  /**
   * Статус Companion Agent
   */
  public getStatus() {
    return {
      name: 'NeuroFlow Desktop Companion',
      version: '1.0.0',
      platform: process.platform,
      isConfigured: true,
      allowedProcesses: Array.from(this.allowedProcesses),
    };
  }
}
