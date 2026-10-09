import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';

export interface ParsedDocumentResult {
  title: string;
  content: string;
  mimeType: string;
  byteSize: number;
  contentHash: string;
  pageCount: number;
  requiresOcr: boolean;
  metadata: Record<string, any>;
  hasSensitiveData?: boolean;
}

// Запрещенные файлы и секреты, которые НИКОГДА не должны попадать в индекс Second Brain
const SENSITIVE_FILE_PATTERNS = [
  /^\.env(\..+)?$/i,
  /\.(pem|key|pkcs12|pfx|crt|cer|der|jks|kdbx)$/i,
  /id_rsa/i,
  /id_ed25519/i,
  /id_ecdsa/i,
  /credentials\.json$/i,
  /token\.json$/i,
  /\.git[\/\\]/i,
  /node_modules[\/\\]/i,
  /\.DS_Store$/i,
  /thumbs\.db$/i,
];

// Запрещенные бинарные расширения (не содержащие извлекаемого текста)
const BINARY_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.dylib', '.bin', '.iso', '.dmg',
  '.zip', '.tar', '.gz', '.7z', '.rar',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
  '.mp4', '.avi', '.mov', '.mkv', '.mp3', '.wav', '.ogg',
  '.wasm', '.class', '.pyc',
]);

// Шаблоны секретов в содержимом (API-ключи, токены, приватные ключи)
const SENSITIVE_CONTENT_PATTERNS = [
  /-----BEGIN\s+([A-Z0-9_-]+\s+)?PRIVATE\s+KEY-----/i,
  /ghp_[a-zA-Z0-9]{36,}/, // GitHub Personal Access Token
  /gho_[a-zA-Z0-9]{36,}/, // GitHub OAuth
  /sk-[a-zA-Z0-9_\-]{20,}/,  // OpenAI / Anthropic secret key
  /AIza[0-9A-Za-z-_]{35}/, // Google API Key
  /AKIA[0-9A-Z]{16}/,     // AWS Access Key ID
  /password\s*[:=]\s*["'][^"'\s]{6,}["']/i,
];

export class DocumentParser {
  /**
   * Проверка, является ли файл чувствительным или запрещенным для индексации
   */
  public static isSensitiveFile(filePath: string): boolean {
    const baseName = path.basename(filePath);
    const normalized = filePath.replace(/\\/g, '/');

    for (const pattern of SENSITIVE_FILE_PATTERNS) {
      if (pattern.test(baseName) || pattern.test(normalized)) {
        return true;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) {
      return true;
    }

    return false;
  }

  /**
   * Санитизация текста: обнаружение и маскирование секретов
   */
  public static sanitizeContent(content: string): { sanitized: string; maskedCount: number } {
    let sanitized = content;
    let maskedCount = 0;

    for (const pattern of SENSITIVE_CONTENT_PATTERNS) {
      sanitized = sanitized.replace(new RegExp(pattern, 'g'), (match) => {
        maskedCount++;
        return `[REDACTED_SECRET_${match.substring(0, 4)}...]`;
      });
    }

    return { sanitized, maskedCount };
  }

  /**
   * Парсинг текстового содержимого или файла
   */
  public static async parse(input: {
    filePath?: string;
    rawText?: string;
    rawBuffer?: Buffer;
    title?: string;
    mimeType?: string;
  }): Promise<ParsedDocumentResult> {
    let content = '';
    let byteSize = 0;
    let title = input.title || 'Untitled Document';
    let mimeType = input.mimeType || 'text/plain';
    let pageCount = 1;
    let requiresOcr = false;

    if (input.filePath) {
      if (this.isSensitiveFile(input.filePath)) {
        throw new Error(`[Security] Файл ${input.filePath} содержит системные секреты или является бинарным и исключен из базы знаний.`);
      }

      const stat = await fs.stat(input.filePath);
      byteSize = stat.size;
      title = path.basename(input.filePath);
      const ext = path.extname(input.filePath).toLowerCase();

      if (ext === '.pdf') {
        mimeType = 'application/pdf';
        const buffer = await fs.readFile(input.filePath);
        const pdfResult = this.parsePdfBuffer(buffer);
        content = pdfResult.text;
        pageCount = pdfResult.pageCount;
        requiresOcr = pdfResult.requiresOcr;
      } else if (ext === '.json') {
        mimeType = 'application/json';
        const text = await fs.readFile(input.filePath, 'utf-8');
        try {
          const parsed = JSON.parse(text);
          content = JSON.stringify(parsed, null, 2);
        } catch {
          content = text;
        }
      } else if (ext === '.csv') {
        mimeType = 'text/csv';
        content = await fs.readFile(input.filePath, 'utf-8');
      } else if (ext === '.md') {
        mimeType = 'text/markdown';
        content = await fs.readFile(input.filePath, 'utf-8');
      } else {
        mimeType = 'text/plain';
        content = await fs.readFile(input.filePath, 'utf-8');
      }
    } else if (input.rawBuffer) {
      byteSize = input.rawBuffer.length;
      if (mimeType === 'application/pdf') {
        const pdfResult = this.parsePdfBuffer(input.rawBuffer);
        content = pdfResult.text;
        pageCount = pdfResult.pageCount;
        requiresOcr = pdfResult.requiresOcr;
      } else {
        content = input.rawBuffer.toString('utf-8');
      }
    } else if (input.rawText !== undefined) {
      content = input.rawText;
      byteSize = Buffer.byteLength(content, 'utf-8');
    }

    // Проверка и маскирование секретов внутри текста
    const { sanitized, maskedCount } = this.sanitizeContent(content);
    content = sanitized;

    // Вычисление хеша содержимого
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');

    return {
      title,
      content,
      mimeType,
      byteSize,
      contentHash,
      pageCount,
      requiresOcr,
      hasSensitiveData: maskedCount > 0,
      metadata: {
        maskedSecretsCount: maskedCount,
      },
    };
  }

  /**
   * Безопасное извлечение текстового слоя из PDF буфера.
   * Если в PDF нет извлекаемого текста (сканированный документ), выставляет requiresOcr = true.
   */
  public static parsePdfBuffer(buffer: Buffer): { text: string; pageCount: number; requiresOcr: boolean } {
    const rawString = buffer.toString('binary');

    // Подсчет количества страниц через /Type /Page
    const pageMatches = rawString.match(/\/Type\s*\/Page[^s]/g) || [];
    const pageCount = Math.max(pageMatches.length, 1);

    // Извлечение текстовых блоков (BT ... ET)
    const textChunks: string[] = [];
    const textBlockRegex = /BT[\s\S]*?ET/g;
    const blocks = rawString.match(textBlockRegex) || [];

    for (const block of blocks) {
      // Извлечение текста в круглых скобках: (Hello World) Tj или [(Hello) 10 (World)] TJ
      const stringMatches = block.match(/\((?:\\.|[^()\\])*\)/g) || [];
      for (const str of stringMatches) {
        // Удаление скобок и unescape
        let clean = str.slice(1, -1);
        clean = clean.replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
        clean = clean.replace(/\\([nrtbf()\\\/])/g, (_, esc) => {
          switch (esc) {
            case 'n': return '\n';
            case 'r': return '\r';
            case 't': return '\t';
            default: return esc;
          }
        });
        if (clean.trim()) {
          textChunks.push(clean);
        }
      }

      // Извлечение шестнадцатеричных строк: <48656c6c6f> Tj
      const hexMatches = block.match(/<([0-9a-fA-F\s]+)>/g) || [];
      for (const hexStr of hexMatches) {
        const hex = hexStr.slice(1, -1).replace(/\s+/g, '');
        if (hex.length >= 2 && hex.length % 2 === 0) {
          try {
            const decoded = Buffer.from(hex, 'hex').toString('utf-8');
            if (decoded.trim() && /^[\x20-\x7E\xA0-\xFF\u0400-\u04FF\s]+$/.test(decoded)) {
              textChunks.push(decoded);
            }
          } catch {
            // Игнорируем некорректный hex
          }
        }
      }
    }

    const fullText = textChunks.join(' ').replace(/\s+/g, ' ').trim();

    // Если в документе менее 15 символов реального текста, это сканированный документ, требующий OCR
    const meaningfulText = fullText.replace(/[^a-zA-Zа-яА-Я0-9]/g, '');
    const requiresOcr = meaningfulText.length < 15;

    return {
      text: fullText,
      pageCount,
      requiresOcr,
    };
  }
}
