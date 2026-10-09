import { describe, it, expect } from 'vitest';
import {
  encryptData,
  decryptData,
  maskSecret,
  hashPasswordSecure,
  verifyPasswordSecure,
} from '../packages/database/src/crypto.js';

describe('Security & Cryptography (AES-256-GCM & PBKDF2)', () => {
  it('должен корректно шифровать и расшифровывать данные через AES-256-GCM', () => {
    const secret = 'sk-proj-super-secret-key-1234567890';
    const encrypted = encryptData(secret);

    expect(encrypted).not.toBe(secret);
    expect(encrypted).toContain(':'); // формат iv:authTag:ciphertext

    const decrypted = decryptData(encrypted);
    expect(decrypted).toBe(secret);
  });

  it('каждое шифрование должно использовать уникальный IV', () => {
    const text = 'identical-plain-text';
    const enc1 = encryptData(text);
    const enc2 = encryptData(text);

    expect(enc1).not.toBe(enc2);
    expect(decryptData(enc1)).toBe(text);
    expect(decryptData(enc2)).toBe(text);
  });

  it('должен выбрасывать исключение при повреждении ciphertext или auth tag', () => {
    const encrypted = encryptData('valid-data');
    const parts = encrypted.split(':');
    // портим шифротекст
    const corrupted = `${parts[0]}:${parts[1]}:badciphertext`;

    expect(() => decryptData(corrupted)).toThrow();
  });

  it('должен корректно маскировать API-ключи и секреты', () => {
    const masked = maskSecret('sk-proj-1234567890abcdef');
    expect(masked).toContain('••••');
    expect(masked).toContain('cdef');
    expect(masked).not.toContain('1234567890');
    expect(maskSecret('short')).toBe('••••••••');
    expect(maskSecret('')).toBe('');
  });

  it('должен безопасно хешировать и валидировать пароли с динамической солью', () => {
    const password = 'SuperSecurePassword2026!';
    const hash1 = hashPasswordSecure(password);
    const hash2 = hashPasswordSecure(password);

    // Разные соли -> разные итоговые хеши
    expect(hash1).not.toBe(hash2);
    expect(verifyPasswordSecure(password, hash1)).toBe(true);
    expect(verifyPasswordSecure(password, hash2)).toBe(true);
    expect(verifyPasswordSecure('WrongPassword', hash1)).toBe(false);
  });
});
