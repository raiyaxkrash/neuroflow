import path from 'node:path';
import fs from 'node:fs/promises';
import {
  getDatabase,
  knowledgeSources,
  knowledgeDocuments,
  knowledgeChunks,
  eq,
  and,
} from '@neuroflow/database';
import { DocumentParser } from './document-parser.js';
import { ChunkingEngine } from './chunking-engine.js';
import { EmbeddingService } from './embedding-service.js';
import {
  KnowledgeSourceDto,
  KnowledgeDocumentDto,
  KnowledgeSourceStatus,
} from '@neuroflow/shared';

export class KnowledgeService {
  /**
   * Создание источника знаний
   */
  public static async createSource(params: {
    userId: string;
    name: string;
    type: any;
    pathOrUrl?: string;
    config?: Record<string, any>;
  }): Promise<KnowledgeSourceDto> {
    const db = getDatabase();
    const [created] = await db
      .insert(knowledgeSources)
      .values({
        userId: params.userId,
        name: params.name,
        type: params.type,
        pathOrUrl: params.pathOrUrl || null,
        config: params.config || {},
        status: 'idle',
      })
      .returning();

    return this.mapSourceToDto(created);
  }

  /**
   * Удаление источника знаний со всеми документами и чанками
   */
  public static async deleteSource(sourceId: string, userId: string): Promise<boolean> {
    const db = getDatabase();
    const [deleted] = await db
      .delete(knowledgeSources)
      .where(and(eq(knowledgeSources.id, sourceId), eq(knowledgeSources.userId, userId)))
      .returning();

    return Boolean(deleted);
  }

  /**
   * Удаление одного документа со всеми его фрагментами
   */
  public static async deleteDocument(documentId: string, userId: string): Promise<boolean> {
    const db = getDatabase();
    const [deleted] = await db
      .delete(knowledgeDocuments)
      .where(and(eq(knowledgeDocuments.id, documentId), eq(knowledgeDocuments.userId, userId)))
      .returning();

    return Boolean(deleted);
  }

  /**
   * Прямая вставка документа в Second Brain (например, из узла Knowledge Insert)
   */
  public static async insertDocument(params: {
    userId: string;
    title: string;
    content: string;
    sourceId?: string;
    metadata?: Record<string, any>;
    chunkSize?: number;
    chunkOverlap?: number;
  }): Promise<{ documentId: string; chunkCount: number }> {
    const db = getDatabase();

    // 1. Если sourceId не передан, находим или создаем дефолтный источник заметок
    let targetSourceId = params.sourceId;
    if (!targetSourceId) {
      const [existingSource] = await db
        .select()
        .from(knowledgeSources)
        .where(
          and(
            eq(knowledgeSources.userId, params.userId),
            eq(knowledgeSources.type, 'user_note')
          )
        )
        .limit(1);

      if (existingSource) {
        targetSourceId = existingSource.id;
      } else {
        const defaultSource = await this.createSource({
          userId: params.userId,
          name: 'Персональные заметки и память',
          type: 'user_note',
        });
        targetSourceId = defaultSource.id;
      }
    }

    // 2. Парсинг и очистка
    const parsed = await DocumentParser.parse({
      rawText: params.content,
      title: params.title,
      mimeType: 'text/markdown',
    });

    // 3. Сохранение документа
    const [doc] = await db
      .insert(knowledgeDocuments)
      .values({
        sourceId: targetSourceId,
        userId: params.userId,
        title: parsed.title,
        uri: `note://${targetSourceId}/${Date.now()}`,
        mimeType: parsed.mimeType,
        byteSize: parsed.byteSize,
        contentHash: parsed.contentHash,
        version: 1,
        status: parsed.requiresOcr ? 'requires_ocr' : 'indexed',
        pageCount: parsed.pageCount,
        metadata: { ...(params.metadata || {}), ...parsed.metadata },
      })
      .returning();

    if (parsed.requiresOcr) {
      return { documentId: doc.id, chunkCount: 0 };
    }

    // 4. Разбиение на чанки
    const chunks = ChunkingEngine.chunkText(parsed.content, {
      chunkSize: params.chunkSize || 800,
      chunkOverlap: params.chunkOverlap || 150,
      documentId: doc.id,
      sourceId: targetSourceId,
    });

    // 5. Векторизация и индексация фрагментов
    for (const chunk of chunks) {
      const embRes = await EmbeddingService.getEmbedding(chunk.content, {
        providerType: 'deterministic',
      });

      await db.insert(knowledgeChunks).values({
        documentId: doc.id,
        sourceId: targetSourceId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        pageNumber: chunk.pageNumber,
        startChar: chunk.startChar,
        endChar: chunk.endChar,
        contentHash: chunk.contentHash,
        embedding: embRes.embedding as any,
        embeddingModel: embRes.model,
        embeddingDim: embRes.dimension,
        metadata: chunk.metadata,
      });
    }

    // Обновление счетчика элементов источника
    if (targetSourceId) {
      await db
        .update(knowledgeSources)
        .set({
          itemCount: (await db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.sourceId, targetSourceId))).length,
          status: 'indexed',
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(knowledgeSources.id, targetSourceId));
    }

    return { documentId: doc.id, chunkCount: chunks.length };
  }

  /**
   * Конвейер синхронизации и индексации источника (Source → Parse → Normalize → Chunk → Embed → Index)
   */
  public static async syncSource(sourceId: string, userId: string): Promise<{
    processedCount: number;
    skippedCount: number;
    requiresOcrCount: number;
    totalChunks: number;
  }> {
    const db = getDatabase();
    const [source] = await db
      .select()
      .from(knowledgeSources)
      .where(and(eq(knowledgeSources.id, sourceId), eq(knowledgeSources.userId, userId)))
      .limit(1);

    if (!source) {
      throw new Error(`Источник знаний с id ${sourceId} не найден.`);
    }

    await db
      .update(knowledgeSources)
      .set({ status: 'indexing', lastError: null, updatedAt: new Date() })
      .where(eq(knowledgeSources.id, sourceId));

    let processedCount = 0;
    let skippedCount = 0;
    let requiresOcrCount = 0;
    let totalChunks = 0;

    try {
      const filesToIndex: string[] = [];

      if (source.type === 'file' && source.pathOrUrl) {
        filesToIndex.push(source.pathOrUrl);
      } else if ((source.type === 'directory' || source.type === 'git') && source.pathOrUrl) {
        filesToIndex.push(...(await this.scanDirectory(source.pathOrUrl)));
      }

      for (const filePath of filesToIndex) {
        if (DocumentParser.isSensitiveFile(filePath)) {
          skippedCount++;
          continue;
        }

        try {
          // Чтение и парсинг
          const parsed = await DocumentParser.parse({ filePath });

          // Инкрементальная проверка: проверяем, существует ли документ с таким же URI и хешем
          const [existingDoc] = await db
            .select()
            .from(knowledgeDocuments)
            .where(
              and(
                eq(knowledgeDocuments.sourceId, sourceId),
                eq(knowledgeDocuments.uri, filePath)
              )
            )
            .limit(1);

          if (existingDoc && existingDoc.contentHash === parsed.contentHash && existingDoc.status === 'indexed') {
            skippedCount++;
            continue; // Хеш не изменился, пропускаем переиндексацию
          }

          // Если документ уже был, удаляем старые чанки перед обновлением
          if (existingDoc) {
            await db.delete(knowledgeChunks).where(eq(knowledgeChunks.documentId, existingDoc.id));
          }

          const docStatus: KnowledgeSourceStatus = parsed.requiresOcr ? 'requires_ocr' : 'indexed';

          let docId = existingDoc?.id;
          if (existingDoc) {
            await db
              .update(knowledgeDocuments)
              .set({
                title: parsed.title,
                byteSize: parsed.byteSize,
                contentHash: parsed.contentHash,
                version: existingDoc.version + 1,
                status: docStatus,
                pageCount: parsed.pageCount,
                metadata: parsed.metadata,
                updatedAt: new Date(),
              })
              .where(eq(knowledgeDocuments.id, existingDoc.id));
          } else {
            const [newDoc] = await db
              .insert(knowledgeDocuments)
              .values({
                sourceId,
                userId,
                title: parsed.title,
                uri: filePath,
                mimeType: parsed.mimeType,
                byteSize: parsed.byteSize,
                contentHash: parsed.contentHash,
                version: 1,
                status: docStatus,
                pageCount: parsed.pageCount,
                metadata: parsed.metadata,
              })
              .returning();
            docId = newDoc.id;
          }

          if (parsed.requiresOcr) {
            requiresOcrCount++;
            continue;
          }

          // Разбиение на чанки
          const chunks = ChunkingEngine.chunkText(parsed.content, {
            chunkSize: 800,
            chunkOverlap: 150,
            documentId: docId,
            sourceId,
          });

          // Генерация эмбеддингов и сохранение чанков
          for (const chunk of chunks) {
            const embRes = await EmbeddingService.getEmbedding(chunk.content, {
              providerType: 'deterministic',
            });

            await db.insert(knowledgeChunks).values({
              documentId: docId!,
              sourceId,
              chunkIndex: chunk.chunkIndex,
              content: chunk.content,
              pageNumber: chunk.pageNumber,
              startChar: chunk.startChar,
              endChar: chunk.endChar,
              contentHash: chunk.contentHash,
              embedding: embRes.embedding as any,
              embeddingModel: embRes.model,
              embeddingDim: embRes.dimension,
              metadata: chunk.metadata,
            });
            totalChunks++;
          }

          processedCount++;
        } catch (err: any) {
          console.warn(`[KnowledgeService] Ошибка обработки файла ${filePath}:`, err.message);
        }
      }

      const finalStatus: KnowledgeSourceStatus = requiresOcrCount > 0 && processedCount === 0
        ? 'requires_ocr'
        : 'indexed';

      await db
        .update(knowledgeSources)
        .set({
          status: finalStatus,
          itemCount: processedCount + skippedCount + requiresOcrCount,
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(knowledgeSources.id, sourceId));

      return {
        processedCount,
        skippedCount,
        requiresOcrCount,
        totalChunks,
      };
    } catch (err: any) {
      await db
        .update(knowledgeSources)
        .set({
          status: 'error',
          lastError: err.message,
          updatedAt: new Date(),
        })
        .where(eq(knowledgeSources.id, sourceId));
      throw err;
    }
  }

  /**
   * Рекурсивный безопасный сбор файлов директории
   */
  private static async scanDirectory(dirPath: string): Promise<string[]> {
    const results: string[] = [];

    const walk = async (currentDir: string) => {
      let entries: any[] = [];
      try {
        entries = await fs.readdir(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (DocumentParser.isSensitiveFile(fullPath)) {
          continue;
        }

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          results.push(fullPath);
        }
      }
    };

    await walk(path.resolve(dirPath));
    return results;
  }

  private static mapSourceToDto(s: any): KnowledgeSourceDto {
    return {
      id: s.id,
      userId: s.userId,
      name: s.name,
      type: s.type,
      pathOrUrl: s.pathOrUrl,
      config: (s.config as any) || {},
      status: s.status,
      lastSyncAt: s.lastSyncAt instanceof Date ? s.lastSyncAt.toISOString() : s.lastSyncAt ? String(s.lastSyncAt) : null,
      lastError: s.lastError,
      itemCount: s.itemCount || 0,
      contentHash: s.contentHash,
      createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
      updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : String(s.updatedAt),
    };
  }
}
