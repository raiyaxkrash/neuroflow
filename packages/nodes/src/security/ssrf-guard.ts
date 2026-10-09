import dns from 'node:dns/promises';
import net from 'node:net';

export class SSRFError extends Error {
  constructor(message: string) {
    super(`[SSRF Protection] ${message}`);
    this.name = 'SSRFError';
  }
}

/**
 * Проверяет, является ли IP адрес частным, локальным, loopback или служебным (metadata).
 */
export function isPrivateOrReservedIP(ip: string): boolean {
  if (!net.isIP(ip)) {
    return true; // Невалидный IP считается небезопасным
  }

  // IPv4 проверки
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
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
    // 169.254.0.0/16 (Link-local / Cloud metadata AWS/GCP/Azure: 169.254.169.254)
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
  const normalized = ip.toLowerCase();
  // ::1 (Loopback)
  if (normalized === '::1' || normalized === '::') return true;
  // Unique local addresses (fc00::/7)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  // Link-local addresses (fe80::/10)
  if (normalized.startsWith('fe80:')) return true;
  // IPv4-mapped IPv6 (::ffff:127.0.0.1 и т.д.)
  if (normalized.includes('::ffff:')) {
    const v4Part = normalized.split('::ffff:')[1];
    if (v4Part && net.isIPv4(v4Part)) {
      return isPrivateOrReservedIP(v4Part);
    }
  }

  return false;
}

/**
 * Валидация URL на SSRF перед сетевым запросом
 */
export async function validateUrlForSSRF(urlString: string): Promise<URL> {
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

  // Запрещенные служебные хосты
  const forbiddenHostnames = [
    'localhost',
    'metadata.google.internal',
    'metadata',
    'instance-data',
    '169.254.169.254',
  ];

  if (forbiddenHostnames.includes(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new SSRFError(`Обращение к хосту "${hostname}" заблокировано из соображений безопасности.`);
  }

  // Если в качестве hostname напрямую передан IP
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
