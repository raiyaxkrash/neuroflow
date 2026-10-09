import crypto from 'node:crypto';

export interface ChunkItem {
  chunkIndex: number;
  content: string;
  startChar: number;
  endChar: number;
  contentHash: string;
  documentId?: string;
  sourceId?: string;
  pageNumber?: number;
  metadata: Record<string, any>;
}

export interface ChunkOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  documentId?: string;
  sourceId?: string;
  pageNumber?: number;
  preserveCodeBlocks?: boolean;
}

export class ChunkingEngine {
  /**
   * Разделение текста на фрагменты (чанки) с сохранением структуры предложений и перекрытием
   */
  public static chunkText(text: string, options: ChunkOptions = {}): ChunkItem[] {
    const chunkSize = options.chunkSize || 800;
    const chunkOverlap = options.chunkOverlap !== undefined ? Math.min(options.chunkOverlap, Math.floor(chunkSize / 2)) : 150;
    const trimmed = (text || '').trim();

    if (!trimmed) {
      return [];
    }

    if (trimmed.length <= chunkSize) {
      const hash = crypto.createHash('sha256').update(trimmed).digest('hex');
      return [
        {
          chunkIndex: 0,
          content: trimmed,
          startChar: 0,
          endChar: trimmed.length,
          contentHash: hash,
          documentId: options.documentId,
          sourceId: options.sourceId,
          pageNumber: options.pageNumber || 1,
          metadata: { length: trimmed.length },
        },
      ];
    }

    const chunks: ChunkItem[] = [];
    let startChar = 0;
    let chunkIndex = 0;

    while (startChar < trimmed.length) {
      let endChar = Math.min(startChar + chunkSize, trimmed.length);

      // Если мы не в самом конце текста, ищем естественную границу разрыва
      if (endChar < trimmed.length) {
        const slice = trimmed.substring(startChar, endChar);

        // 1. Поиск двойного перевода строки (граница абзаца)
        let splitIdx = slice.lastIndexOf('\n\n');
        if (splitIdx === -1 || splitIdx < chunkSize * 0.4) {
          // 2. Поиск точки/восклицательного/вопросительного знака с пробелом
          const match = slice.match(/[.!?]\s+(?=[A-ZА-Я0-9])/g);
          if (match && match.length > 0) {
            const lastMatch = match[match.length - 1];
            splitIdx = slice.lastIndexOf(lastMatch) + 1;
          }
        }
        if (splitIdx === -1 || splitIdx < chunkSize * 0.4) {
          // 3. Поиск одинарного перевода строки
          splitIdx = slice.lastIndexOf('\n');
        }
        if (splitIdx === -1 || splitIdx < chunkSize * 0.4) {
          // 4. Поиск обычного пробела
          splitIdx = slice.lastIndexOf(' ');
        }

        if (splitIdx !== -1 && splitIdx >= chunkSize * 0.4) {
          endChar = startChar + splitIdx;
        }
      }

      const chunkContent = trimmed.substring(startChar, endChar).trim();
      if (chunkContent.length > 0) {
        const hash = crypto.createHash('sha256').update(chunkContent).digest('hex');
        chunks.push({
          chunkIndex,
          content: chunkContent,
          startChar,
          endChar,
          contentHash: hash,
          documentId: options.documentId,
          sourceId: options.sourceId,
          pageNumber: options.pageNumber || 1,
          metadata: { length: chunkContent.length },
        });
        chunkIndex++;
      }

      // Перемещение курсора с учетом перекрытия
      if (endChar >= trimmed.length) {
        break;
      }

      startChar = Math.max(startChar + 1, endChar - chunkOverlap);
    }

    return chunks;
  }
}
