import crypto from 'node:crypto';

/**
 * Рекурсивная каноническая сериализация JSON с детерминированной сортировкой ключей.
 * Гарантирует абсолютную идентичность строкового представления для одинаковых данных.
 */
export function canonicalJson(data: any): string {
  if (data === null || data === undefined) {
    return 'null';
  }
  if (typeof data !== 'object') {
    return JSON.stringify(data);
  }
  if (Array.isArray(data)) {
    return `[${data.map((item) => canonicalJson(item)).join(',')}]`;
  }
  const keys = Object.keys(data).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(data[key])}`);
  return `{${entries.join(',')}}`;
}

/**
 * Вычисление криптографического отпечатка действия (Action Fingerprint) по SHA-256.
 */
export function calculateActionFingerprint(params: {
  executionId?: string;
  nodeId: string;
  toolName: string;
  payload: any;
}): string {
  const { executionId = '', nodeId, toolName, payload } = params;
  const canonicalPayload = canonicalJson(payload);
  const rawString = `${executionId}:${nodeId}:${toolName}:${canonicalPayload}`;
  return crypto.createHash('sha256').update(rawString).digest('hex');
}
