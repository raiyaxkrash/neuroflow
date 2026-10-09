import crypto from 'node:crypto';

/**
 * Получение 32-байтного ключа шифрования для AES-256-GCM
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'neuroflow-default-encryption-salt-2026';
  // Деривация строго 32-байтного ключа
  return crypto.scryptSync(secret, 'neuroflow_vault_salt', 32);
}

/**
 * Симметричное шифрование AES-256-GCM для безопасного хранения API-ключей и учетных данных
 */
export function encryptData(plainText: string): string {
  if (!plainText) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-битный IV для GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  // Формат: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Дешифрование данных AES-256-GCM
 */
export function decryptData(cipherText: string): string {
  if (!cipherText) return '';
  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    // Попытка обратной совместимости или открытый текст
    return cipherText;
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Маскирование чувствительных ключей (например sk-proj-1234567890 -> sk-proj-••••••••7890)
 */
export function maskSecret(secret: string): string {
  if (!secret) return '';
  const str = secret.trim();
  if (str.length <= 8) {
    return '••••••••';
  }
  const prefix = str.slice(0, Math.min(6, Math.floor(str.length / 3)));
  const suffix = str.slice(-4);
  return `${prefix}••••••••${suffix}`;
}

/**
 * Безопасное хеширование пароля с уникальной солью
 */
export function hashPasswordSecure(password: string, customSalt?: string): string {
  const salt = customSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Проверка пароля (поддерживает как новый формат salt:hash, так и легаси хэш)
 */
export function verifyPasswordSecure(password: string, storedHash: string): boolean {
  if (!storedHash) return false;

  if (storedHash.includes(':')) {
    const [salt, originalHash] = storedHash.split(':');
    const newHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(newHash, 'hex'), Buffer.from(originalHash, 'hex'));
  }

  // Легаси проверка для совместимости с Phase 1
  const legacySalt = 'neuroflow_salt_2026';
  const legacyHash = crypto.pbkdf2Sync(password, legacySalt, 1000, 64, 'sha512').toString('hex');
  return legacyHash === storedHash;
}
