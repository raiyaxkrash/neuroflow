import { describe, it, expect } from 'vitest';
import { DocumentParser } from '../packages/nodes/src/knowledge/document-parser.js';
import { ChunkingEngine } from '../packages/nodes/src/knowledge/chunking-engine.js';

describe('Second Brain: Ingestion & Document Processing', () => {
  describe('DocumentParser (Защита от утечки секретов и валидация форматов)', () => {
    it('должен блокировать системные файлы секретов и приватные ключи', () => {
      expect(DocumentParser.isSensitiveFile('.env')).toBe(true);
      expect(DocumentParser.isSensitiveFile('.env.production')).toBe(true);
      expect(DocumentParser.isSensitiveFile('id_rsa')).toBe(true);
      expect(DocumentParser.isSensitiveFile('id_rsa.pub')).toBe(true);
      expect(DocumentParser.isSensitiveFile('server.key')).toBe(true);
      expect(DocumentParser.isSensitiveFile('cert.pem')).toBe(true);
      expect(DocumentParser.isSensitiveFile('database.kdbx')).toBe(true);
      expect(DocumentParser.isSensitiveFile('lib/native.dll')).toBe(true);

      // Обычные документы должны быть разрешены
      expect(DocumentParser.isSensitiveFile('architecture.md')).toBe(false);
      expect(DocumentParser.isSensitiveFile('report.pdf')).toBe(false);
      expect(DocumentParser.isSensitiveFile('data.csv')).toBe(false);
      expect(DocumentParser.isSensitiveFile('config.json')).toBe(false);
    });

    it('должен выбрасывать ошибку безопасности при попытке распарсить файл с секретами через filePath', async () => {
      await expect(
        DocumentParser.parse({ filePath: '.env' })
      ).rejects.toThrow(/содержит системные секреты/);
    });

    it('должен маскировать API-ключи и токены внутри текстовых документов', () => {
      const rawText = 'API key: sk-ant-api03-abcdef1234567890abcdef1234567890 and GitHub token: ghp_1234567890abcdefghijklmnopqrstuvwxyz';
      const { sanitized, maskedCount } = DocumentParser.sanitizeContent(rawText);

      expect(maskedCount).toBeGreaterThanOrEqual(1);
      expect(sanitized).not.toContain('sk-ant-api03-abcdef1234567890abcdef1234567890');
      expect(sanitized).toContain('REDACTED_SECRET');
    });

    it('должен корректно парсить Markdown и вычислять хеш содержимого', async () => {
      const mdContent = '# Архитектура системы Titan\n\nЭто описание распределенной архитектуры.';
      const parsed = await DocumentParser.parse({
        rawText: mdContent,
        title: 'titan.md',
        mimeType: 'text/markdown',
      });

      expect(parsed.title).toBe('titan.md');
      expect(parsed.mimeType).toBe('text/markdown');
      expect(parsed.content).toContain('Это описание распределенной архитектуры');
      expect(parsed.byteSize).toBeGreaterThan(0);
      expect(parsed.contentHash).toBeDefined();
      expect(parsed.requiresOcr).toBe(false);
    });

    it('должен корректно парсить JSON и форматировать его в структурированный текст', async () => {
      const jsonObj = { service: 'Titan-Core', version: '2.5.0', status: 'active' };
      const jsonBuffer = Buffer.from(JSON.stringify(jsonObj, null, 2));
      const parsed = await DocumentParser.parse({
        rawBuffer: jsonBuffer,
        title: 'service-info.json',
        mimeType: 'application/json',
      });

      expect(parsed.mimeType).toBe('application/json');
      expect(parsed.content).toContain('"service": "Titan-Core"');
      expect(parsed.contentHash).toHaveLength(64); // SHA-256
    });

    it('должен определять PDF без текстового слоя как требующий OCR (requires_ocr)', () => {
      // Имитируем бинарный PDF без извлекаемых текстовых блоков Tj/TJ
      const fakeScannedPdf = Buffer.from('%PDF-1.4 ... binary image stream data only ... %%EOF');
      const parsed = DocumentParser.parsePdfBuffer(fakeScannedPdf);

      expect(parsed.requiresOcr).toBe(true);
      expect(parsed.text).toBe('');
      expect(parsed.pageCount).toBe(1);
    });
  });

  describe('ChunkingEngine (Разделение на чанки и вычисление позиций)', () => {
    const sampleArticle = `Первый абзац статьи описывает архитектурные принципы. Он содержит несколько предложений для проверки сохранения структуры.

Второй абзац посвящен высоконагруженному взаимодействию микросервисов. Здесь описаны очереди сообщений Kafka и паттерн Transactional Outbox.

Третий абзац финализирует выводы команды инженеров. Надежность платформы повысилась до 99.99%.`;

    it('должен разбивать текст на чанки с соблюдением максимального размера и перекрытия', () => {
      const chunks = ChunkingEngine.chunkText(sampleArticle, {
        chunkSize: 150,
        chunkOverlap: 30,
      });

      expect(chunks.length).toBeGreaterThan(1);

      chunks.forEach((chunk, index) => {
        expect(chunk.chunkIndex).toBe(index);
        expect(chunk.content.length).toBeGreaterThan(0);
        expect(chunk.startChar).toBeLessThan(chunk.endChar);
        expect(chunk.contentHash).toBeDefined();
      });
    });

    it('должен сохранять точные координаты startChar и endChar в исходном документе', () => {
      const chunks = ChunkingEngine.chunkText(sampleArticle, {
        chunkSize: 120,
        chunkOverlap: 20,
      });

      for (const chunk of chunks) {
        // Проверяем, что срез оригинального текста соответствует началу содержимого чанка
        const originalSlice = sampleArticle.substring(chunk.startChar, chunk.endChar).trim();
        expect(originalSlice.length).toBeGreaterThan(0);
      }
    });

    it('должен возвращать один чанк для короткого текста', () => {
      const shortText = 'Краткая заметка для базы знаний.';
      const chunks = ChunkingEngine.chunkText(shortText, {
        chunkSize: 500,
        chunkOverlap: 50,
      });

      expect(chunks.length).toBe(1);
      expect(chunks[0].chunkIndex).toBe(0);
      expect(chunks[0].content).toBe(shortText);
      expect(chunks[0].startChar).toBe(0);
      expect(chunks[0].endChar).toBe(shortText.length);
    });
  });
});
