import { describe, it, expect } from 'vitest';
import { BrowserSecurity } from '@neuroflow/nodes';

describe('Browser Network & Subresource Security (Phase 7 Hardening)', () => {
  it('должен блокировать прямые обращения к приватным IP и облачным метаданным', () => {
    const dangerousUrls = [
      'http://127.0.0.1:8080/admin',
      'http://localhost:3000/api',
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.1/router',
      'http://192.168.1.1/gateway',
      'http://[::1]:80/status',
    ];

    for (const url of dangerousUrls) {
      const res = BrowserSecurity.validateUrl(url);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBeDefined();
    }
  });

  it('должен разрешать безопасные внешние URL и безопасные inline Data URI', () => {
    const safeUrls = [
      'https://example.com/index.html',
      'https://google.com/search?q=neuroflow',
      'https://github.com/microsoft/playwright',
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'data:font/woff2;base64,d09GMgABAAAAAA',
    ];

    for (const url of safeUrls) {
      const res = BrowserSecurity.validateUrl(url);
      expect(res.allowed).toBe(true);
    }
  });

  it('должен блокировать опасные data/javascript URI со скриптами', () => {
    const maliciousUrls = [
      'data:text/html,<script>alert(1)</script>',
      'javascript:alert(document.cookie)',
      'file:///C:/Windows/System32/drivers/etc/hosts',
    ];

    for (const url of maliciousUrls) {
      const res = BrowserSecurity.validateUrl(url);
      expect(res.allowed).toBe(false);
    }
  });
});
