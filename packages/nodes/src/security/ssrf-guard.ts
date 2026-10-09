import dns from 'node:dns/promises';
import net from 'node:net';

export class SSRFError extends Error {
  constructor(message: string) {
    super(`[SSRF Protection] ${message}`);
    this.name = 'SSRFError';
  }
}

export interface SSRFValidationOptions {
  allowLocalOllama?: boolean;
  allowedHosts?: string[];
}

/**
 * Преобразует альтернативные форматы IPv4 (целое число, hex, octal) в стандартную точечно-десятичную нотацию.
 * Возвращает нормализованную строку IP или null, если входные данные не являются числовым представлением IP.
 */
export function normalizeIpAddress(input: string): string | null {
  const trimmed = input.trim().toLowerCase();

  // 1. Стандартный IPv4 или IPv6
  if (net.isIP(trimmed)) {
    return trimmed;
  }

  // 2. Целое число (DWORD decimal): например 2130706433 -> 127.0.0.1
  if (/^\d+$/.test(trimmed)) {
    try {
      const num = BigInt(trimmed);
      if (num >= 0n && num <= 0xffffffffn) {
        const b0 = Number((num >> 24n) & 0xffn);
        const b1 = Number((num >> 16n) & 0xffn);
        const b2 = Number((num >> 8n) & 0xffn);
        const b3 = Number(num & 0xffn);
        return `${b0}.${b1}.${b2}.${b3}`;
      }
    } catch {
      // Игнорируем ошибку парсинга BigInt
    }
  }

  // 3. Hexadecimal формат: например 0x7f000001
  if (/^0x[0-9a-f]+$/i.test(trimmed)) {
    try {
      const num = BigInt(trimmed);
      if (num >= 0n && num <= 0xffffffffn) {
        const b0 = Number((num >> 24n) & 0xffn);
        const b1 = Number((num >> 16n) & 0xffn);
        const b2 = Number((num >> 8n) & 0xffn);
        const b3 = Number(num & 0xffn);
        return `${b0}.${b1}.${b2}.${b3}`;
      }
    } catch {
      // Игнорируем
    }
  }

  // 4. Частичные октальные/hex октеты в точечной нотации (например 0177.0.0.1 или 0x7f.0.0.1)
  if (trimmed.includes('.')) {
    const parts = trimmed.split('.');
    if (parts.length >= 2 && parts.length <= 4) {
      const parsedParts: number[] = [];
      let valid = true;

      for (const part of parts) {
        if (/^0x[0-9a-f]+$/i.test(part)) {
          parsedParts.push(parseInt(part, 16));
        } else if (/^0[0-7]+$/.test(part)) {
          parsedParts.push(parseInt(part, 8));
        } else if (/^\d+$/.test(part)) {
          parsedParts.push(parseInt(part, 10));
        } else {
          valid = false;
          break;
        }
      }

      if (valid && parsedParts.every((p) => p >= 0 && p <= 255)) {
        // Дополняем до 4 октетов если указана сокращенная запись (например 127.1 -> 127.0.0.1)
        if (parsedParts.length === 2) {
          return `${parsedParts[0]}.0.0.${parsedParts[1]}`;
        }
        if (parsedParts.length === 3) {
          return `${parsedParts[0]}.${parsedParts[1]}.0.${parsedParts[2]}`;
        }
        if (parsedParts.length === 4) {
          return `${parsedParts[0]}.${parsedParts[1]}.${parsedParts[2]}.${parsedParts[3]}`;
        }
      }
    }
  }

  return null;
}

/**
 * Проверяет, является ли IP адрес частным, локальным, loopback или служебным (metadata).
 */
export function isPrivateOrReservedIP(ip: string): boolean {
  const normalized = normalizeIpAddress(ip) || ip;

  if (!net.isIP(normalized)) {
    return true; // Невалидный IP считается небезопасным
  }

  // IPv4 проверки
  if (net.isIPv4(normalized)) {
    const parts = normalized.split('.').map(Number);
    const [b0, b1, b2, b3] = parts;

    // 0.0.0.0/8
    if (b0 === 0) return true;
    // 127.0.0.0/8 (Loopback)
    if (b0 === 127) return true;
    // 10.0.0.0/8 (Private)
    if (b0 === 10) return true;
    // 172.16.0.0/12 (Private)
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (b0 === 192 && b1 === 168) return true;
    // 169.254.0.0/16 (Link-local / Cloud metadata: 169.254.169.254)
    if (b0 === 169 && b1 === 254) return true;
    // 100.64.0.0/10 (Carrier-grade NAT)
    if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;
    // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (TEST-NET)
    if (b0 === 192 && b1 === 0 && b2 === 2) return true;
    if (b0 === 198 && b1 === 51 && b2 === 100) return true;
    if (b0 === 203 && b1 === 0 && b2 === 113) return true;
    // 224.0.0.0/4 (Multicast)
    if (b0 >= 224) return true;

    return false;
  }

  // IPv6 проверки
  const normV6 = normalized.toLowerCase();
  // ::1 (Loopback)
  if (normV6 === '::1' || normV6 === '::') return true;
  // Unique local addresses (fc00::/7)
  if (normV6.startsWith('fc') || normV6.startsWith('fd')) return true;
  // Link-local addresses (fe80::/10)
  if (normV6.startsWith('fe80:')) return true;
  // IPv4-mapped IPv6 (::ffff:127.0.0.1 и т.д.)
  if (normV6.includes('::ffff:')) {
    const v4Part = normV6.split('::ffff:')[1];
    if (v4Part) {
      return isPrivateOrReservedIP(v4Part);
    }
  }

  return false;
}

/**
 * Валидация URL на SSRF перед сетевым запросом
 */
export async function validateUrlForSSRF(
  urlString: string,
  options: SSRFValidationOptions = {}
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new SSRFError(`Некорректный URL: "${urlString}"`);
  }

  // Разрешены только протоколы http и https
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SSRFError(`Запрещенный протокол "${url.protocol}". Разрешены только HTTP и HTTPS.`);
  }

  const hostname = url.hostname.toLowerCase();
  const port = url.port || (url.protocol === 'https:' ? '443' : '80');

  // Проверка доверенных адресов для локального Ollama или белого списка
  const allowedHosts = [
    ...(options.allowedHosts || []),
    ...(process.env.ALLOWED_INTERNAL_HOSTS?.split(',').map((h) => h.trim().toLowerCase()) || []),
  ];

  if (options.allowLocalOllama) {
    allowedHosts.push('localhost', '127.0.0.1', '::1', 'host.docker.internal');
  }

  const isExplicitlyAllowed = allowedHosts.some(
    (h) => hostname === h || (options.allowLocalOllama && (hostname === 'localhost' || hostname === '127.0.0.1'))
  );

  if (isExplicitlyAllowed) {
    return url;
  }

  // Запрещенные служебные хосты
  const forbiddenHostnames = [
    'localhost',
    'metadata.google.internal',
    'metadata',
    'instance-data',
    '169.254.169.254',
    'host.docker.internal',
  ];

  if (forbiddenHostnames.includes(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new SSRFError(`Обращение к хосту "${hostname}" заблокировано из соображений безопасности.`);
  }

  // Проверка альтернативных представлений IP (числовые, hex, octal)
  const normalizedFromHost = normalizeIpAddress(hostname);
  if (normalizedFromHost) {
    if (isPrivateOrReservedIP(normalizedFromHost)) {
      throw new SSRFError(`Обращение к зарезервированному/приватному IP "${hostname}" (${normalizedFromHost}) запрещено.`);
    }
    return url;
  }

  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIP(hostname)) {
      throw new SSRFError(`Обращение к зарезервированному/приватному IP "${hostname}" запрещено.`);
    }
    return url;
  }

  // Разрешение DNS для предотвращения DNS Rebinding и скрытых приватных IP
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    for (const addr of addresses) {
      if (isPrivateOrReservedIP(addr.address)) {
        throw new SSRFError(`Хост "${hostname}" резолвится в приватный IP адрес ${addr.address}. Запрос заблокирован.`);
      }
    }
  } catch (err: any) {
    if (err instanceof SSRFError) throw err;
    throw new SSRFError(`Не удалось разрешить хост "${hostname}": ${err.message}`);
  }

  return url;
}
