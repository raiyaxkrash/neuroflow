import { describe, it, expect } from 'vitest';
import { isPrivateOrReservedIP, validateUrlForSSRF, SSRFError } from '../packages/nodes/src/security/ssrf-guard.js';

describe('SSRF Protection Guard', () => {
  it('должен определять зарезервированные и приватные IP адреса', () => {
    expect(isPrivateOrReservedIP('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIP('10.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIP('172.16.0.1')).toBe(true);
    expect(isPrivateOrReservedIP('192.168.1.1')).toBe(true);
    expect(isPrivateOrReservedIP('169.254.169.254')).toBe(true);
    expect(isPrivateOrReservedIP('::1')).toBe(true);
    expect(isPrivateOrReservedIP('0.0.0.0')).toBe(true);

    // Публичные валидные IP
    expect(isPrivateOrReservedIP('8.8.8.8')).toBe(false);
    expect(isPrivateOrReservedIP('1.1.1.1')).toBe(false);
  });

  it('должен блокировать обращения к localhost, metadata и внутренним хостам', async () => {
    await expect(validateUrlForSSRF('http://localhost:3000')).rejects.toThrow(SSRFError);
    await expect(validateUrlForSSRF('http://127.0.0.1/admin')).rejects.toThrow(SSRFError);
    await expect(validateUrlForSSRF('http://169.254.169.254/latest/meta-data')).rejects.toThrow(SSRFError);
    await expect(validateUrlForSSRF('http://metadata.google.internal')).rejects.toThrow(SSRFError);
    await expect(validateUrlForSSRF('http://192.168.0.100:8080')).rejects.toThrow(SSRFError);
  });

  it('должен запрещать не-HTTP протоколы (file, ftp, gopher)', async () => {
    await expect(validateUrlForSSRF('file:///etc/passwd')).rejects.toThrow(SSRFError);
    await expect(validateUrlForSSRF('ftp://example.com')).rejects.toThrow(SSRFError);
  });

  it('должен успешно пропускать валидные публичные URL', async () => {
    const url = await validateUrlForSSRF('https://example.com/api/test');
    expect(url.hostname).toBe('example.com');
  });

  it('должен блокировать альтернативные числовые/hex/octal представления IP', async () => {
    // 2130706433 = 127.0.0.1
    await expect(validateUrlForSSRF('http://2130706433/')).rejects.toThrow(SSRFError);
    // 0x7f000001 = 127.0.0.1
    await expect(validateUrlForSSRF('http://0x7f000001/')).rejects.toThrow(SSRFError);
    // 0177.0.0.1 = 127.0.0.1 (octal)
    await expect(validateUrlForSSRF('http://0177.0.0.1/')).rejects.toThrow(SSRFError);
  });

  it('должен разрешать обращение к локальному Ollama только при флаге allowLocalOllama', async () => {
    await expect(validateUrlForSSRF('http://127.0.0.1:11434/api/generate')).rejects.toThrow(SSRFError);
    const ollamaUrl = await validateUrlForSSRF('http://127.0.0.1:11434/api/generate', { allowLocalOllama: true });
    expect(ollamaUrl.port).toBe('11434');
  });
});
