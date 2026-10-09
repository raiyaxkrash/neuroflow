import { URL } from 'node:url';
import net from 'node:net';

export interface BrowserSecurityOptions {
  allowLocalhost?: boolean;
  allowedDomains?: string[];
  blockedDomains?: string[];
}

export class BrowserSecurity {
  /**
   * Список запрещенных приватных и служебных IP-диапазонов (SSRF)
   */
  private static readonly BLOCKED_IP_PREFIXES = [
    '0.',          // Текущая сеть
    '10.',         // Приватная Class A
    '127.',        // Loopback
    '169.254.',    // Link-local / AWS & Cloud Metadata
    '172.16.', '172.17.', '172.18.', '172.19.',
    '172.20.', '172.21.', '172.22.', '172.23.',
    '172.24.', '172.25.', '172.26.', '172.27.',
    '172.28.', '172.29.', '172.30.', '172.31.', // Приватная Class B
    '192.168.',    // Приватная Class C
    '192.0.2.',    // Test-Net-1
    '198.51.100.', // Test-Net-2
    '203.0.113.',  // Test-Net-3
    '224.', '240.',// Multicast & Reserved
  ];

  private static readonly BLOCKED_PROTOCOLS = [
    'file:',
    'javascript:',
    'vbscript:',
    'data:',
    'chrome:',
    'chrome-extension:',
    'edge:',
    'about:',
  ];

  /**
   * Проверка и валидация URL перед навигацией
   */
  public static validateUrl(
    targetUrl: string,
    options: BrowserSecurityOptions = {}
  ): { valid: boolean; error?: string; normalizedUrl?: string } {
    if (!targetUrl || typeof targetUrl !== 'string') {
      return { valid: false, error: 'URL не указан или имеет некорректный тип' };
    }

    const trimmed = targetUrl.trim();

    // Проверка специальных разрешенных внутренних URL Playwright
    if (trimmed === 'about:blank') {
      return { valid: true, normalizedUrl: 'about:blank' };
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return { valid: false, error: `Некорректный синтаксис URL: ${trimmed}` };
    }

    const protocol = parsed.protocol.toLowerCase();

    // Разрешены строго http и https
    if (protocol !== 'http:' && protocol !== 'https:') {
      return {
        valid: false,
        error: `Протокол "${protocol}" запрещен в целях безопасности. Разрешены только http: и https:`,
      };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Проверка localhost / loopback
    const isLoopback =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname.endsWith('.localhost');

    if (isLoopback) {
      if (options.allowLocalhost) {
        return { valid: true, normalizedUrl: parsed.toString() };
      }
      return {
        valid: false,
        error: 'Доступ к localhost / 127.0.0.1 заблокирован политикой SSRF безопасности (требуется флаг allowLocalhost)',
      };
    }

    // Проверка IP адресов
    if (net.isIP(hostname)) {
      for (const prefix of this.BLOCKED_IP_PREFIXES) {
        if (hostname.startsWith(prefix)) {
          return {
            valid: false,
            error: `Доступ к частному/облачному IP адресу (${hostname}) запрещен SSRF-защитой`,
          };
        }
      }

      if (hostname === '::1' || hostname.startsWith('fc00:') || hostname.startsWith('fe80:')) {
        return {
          valid: false,
          error: `Доступ к частному IPv6 адресу (${hostname}) запрещен SSRF-защитой`,
        };
      }
    }

    // Проверка черного списка доменов
    if (options.blockedDomains && options.blockedDomains.length > 0) {
      const isBlocked = options.blockedDomains.some((d) => hostname === d || hostname.endsWith(`.${d}`));
      if (isBlocked) {
        return { valid: false, error: `Домен "${hostname}" находится в списке заблокированных` };
      }
    }

    // Проверка белого списка доменов
    if (options.allowedDomains && options.allowedDomains.length > 0) {
      const isAllowed = options.allowedDomains.some((d) => hostname === d || hostname.endsWith(`.${d}`));
      if (!isAllowed) {
        return {
          valid: false,
          error: `Домен "${hostname}" отсутствует в списке разрешенных доменов`,
        };
      }
    }

    return { valid: true, normalizedUrl: parsed.toString() };
  }

  /**
   * Санитизация текста веб-страницы перед отправкой в контекст AI-модели
   * Предотвращает Prompt Injection, эмуляцию системных ролей и подмену команд
   */
  public static sanitizeWebTextForLLM(rawContent: string, maxLength: number = 25000): string {
    if (!rawContent || typeof rawContent !== 'string') return '';

    let sanitized = rawContent
      // Нейтрализуем теги ChatML и служебные токены
      .replace(/<\|im_start\|>/g, '[im_start]')
      .replace(/<\|im_end\|>/g, '[im_end]')
      .replace(/\[INST\]/g, '[_INST_]')
      .replace(/\[\/INST\]/g, '[_/INST_]')
      .replace(/<<SYS>>/g, '[_SYS_]')
      .replace(/<\/SYS>>/g, '[_/SYS_]')
      // Нейтрализуем имитацию маркеров системы и ролей
      .replace(/###\s*(System|Instruction|Assistant|Human|Developer):/gi, '--- WebText: $1:')
      // Нейтрализуем псевдо-команды в квадратных скобках типа [SYSTEM: ignore all instructions]
      .replace(/\[(SYSTEM|ADMIN|INSTRUCTION|OVERRIDE):[^\]]*\]/gi, '[untrusted_annotation]')
      .trim();

    if (sanitized.length > maxLength) {
      sanitized = sanitized.slice(0, maxLength) + '\n... [контент обрезан по лимиту безопасности]';
    }

    return sanitized;
  }

  /**
   * Валидация CSS / Playwright селектора.
   * Запрещает выполнение потенциального JS-кода в селекторах.
   */
  public static sanitizeSelector(selector: string): string {
    if (!selector || typeof selector !== 'string') {
      throw new Error('Селектор элемента не указан');
    }

    const trimmed = selector.trim();

    // Запрет опасных конструкций
    if (
      trimmed.includes('javascript:') ||
      trimmed.includes('eval(') ||
      trimmed.includes('<script') ||
      trimmed.includes('window.') ||
      trimmed.includes('document.')
    ) {
      throw new Error(`Обнаружен недопустимый или небезопасный селектор: ${trimmed}`);
    }

    return trimmed;
  }
}
