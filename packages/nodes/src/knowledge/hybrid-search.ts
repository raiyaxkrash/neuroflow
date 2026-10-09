import {
  getDatabase,
  knowledgeChunks,
  knowledgeDocuments,
  knowledgeSources,
  eq,
  and,
} from '@neuroflow/database';
import { EmbeddingService } from './embedding-service.js';
import { SearchResultItem, SearchMode } from '@neuroflow/shared';

export interface HybridSearchOptions {
  userId?: string;
  sourceIds?: string[];
  searchMode?: SearchMode;
  limit?: number;
  minScore?: number;
  embeddingProvider?: {
    providerType?: 'ollama' | 'openai' | 'mock' | 'deterministic';
    baseUrl?: string;
    apiKey?: string;
    model?: string;
  };
}

export class HybridSearchEngine {
  /**
   * Вычисление текстовой релевантности запроса и документа (BM25 / Keyword Matching)
   */
  public static calculateKeywordScore(query: string, content: string, title?: string): number {
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return 0;

    const terms = cleanQuery.split(/\s+/).filter((t) => t.length > 2);
    if (terms.length === 0) return 0;

    const cleanContent = content.toLowerCase();
    const cleanTitle = (title || '').toLowerCase();

    let matchedTerms = 0;
    let occurrences = 0;

    for (const term of terms) {
      let termMatches = 0;
      if (cleanTitle.includes(term)) {
        termMatches += 3; // Вес заголовочных совпадений
      }
      let idx = 0;
      while ((idx = cleanContent.indexOf(term, idx)) !== -1) {
        termMatches++;
        idx += term.length;
      }
      if (termMatches > 0) {
        matchedTerms++;
        occurrences += termMatches;
      }
    }

    const termCoverage = matchedTerms / terms.length; // Доля совпавших слов
    const frequencyScore = Math.min(occurrences / (terms.length * 4), 1.0);

    return Number((termCoverage * 0.7 + frequencyScore * 0.3).toFixed(4));
  }

  /**
   * Выполнение гибридного поиска по базе знаний
   */
  public static async search(
    query: string,
    options: HybridSearchOptions = {}
  ): Promise<SearchResultItem[]> {
    const searchMode = options.searchMode || 'hybrid';
    const limit = options.limit || 5;
    const minScore = options.minScore || 0.15;
    const db = getDatabase();

    // 1. Получение чанков из базы данных с джойном документов и источников
    const queryBuilder = db
      .select({
        chunkId: knowledgeChunks.id,
        documentId: knowledgeChunks.documentId,
        sourceId: knowledgeChunks.sourceId,
        chunkIndex: knowledgeChunks.chunkIndex,
        content: knowledgeChunks.content,
        pageNumber: knowledgeChunks.pageNumber,
        embedding: knowledgeChunks.embedding,
        embeddingModel: knowledgeChunks.embeddingModel,
        embeddingDim: knowledgeChunks.embeddingDim,
        metadata: knowledgeChunks.metadata,
        documentTitle: knowledgeDocuments.title,
        uri: knowledgeDocuments.uri,
        userId: knowledgeDocuments.userId,
      })
      .from(knowledgeChunks)
      .innerJoin(knowledgeDocuments, eq(knowledgeChunks.documentId, knowledgeDocuments.id))
      .innerJoin(knowledgeSources, eq(knowledgeChunks.sourceId, knowledgeSources.id));

    const rows = await queryBuilder;

    // Фильтрация по пользователю и источникам в памяти
    const filteredRows = rows.filter((r: any) => {
      if (options.userId && r.userId !== options.userId) return false;
      if (options.sourceIds && options.sourceIds.length > 0 && !options.sourceIds.includes(r.sourceId)) return false;
      return true;
    });

    if (filteredRows.length === 0) {
      return [];
    }

    // 2. Векторизация запроса, если включен семантический поиск
    let queryEmbedding: number[] | null = null;
    if (searchMode === 'vector' || searchMode === 'hybrid') {
      try {
        const embRes = await EmbeddingService.getEmbedding(query, options.embeddingProvider);
        queryEmbedding = embRes.embedding;
      } catch {
        // Fallback на текстовый поиск при сбое векторизации
        queryEmbedding = null;
      }
    }

    // 3. Вычисление скоров для каждого фрагмента
    const scoredItems: Array<{
      item: SearchResultItem;
      keywordScore: number;
      vectorScore: number;
      finalScore: number;
    }> = [];

    for (const row of filteredRows) {
      const keywordScore = this.calculateKeywordScore(query, row.content, row.documentTitle);
      let vectorScore = 0;

      if (queryEmbedding && Array.isArray(row.embedding)) {
        try {
          vectorScore = EmbeddingService.cosineSimilarity(queryEmbedding, row.embedding as number[]);
          // Нормализация в диапазон [0, 1]
          vectorScore = Math.max(0, vectorScore);
        } catch {
          vectorScore = 0;
        }
      }

      let finalScore = 0;
      let actualSearchType: 'vector' | 'keyword' | 'hybrid' = 'keyword';

      if (searchMode === 'vector') {
        finalScore = vectorScore;
        actualSearchType = 'vector';
      } else if (searchMode === 'text' || !queryEmbedding) {
        finalScore = keywordScore;
        actualSearchType = 'keyword';
      } else {
        // Гибридное ранжирование с балансировкой
        finalScore = keywordScore * 0.45 + vectorScore * 0.55;
        actualSearchType = 'hybrid';
      }

      if (finalScore >= minScore) {
        scoredItems.push({
          item: {
            chunkId: row.chunkId,
            documentId: row.documentId,
            sourceId: row.sourceId,
            documentTitle: row.documentTitle,
            uri: row.uri,
            pageNumber: row.pageNumber,
            chunkIndex: row.chunkIndex,
            content: row.content,
            score: Number(finalScore.toFixed(4)),
            searchType: actualSearchType,
            metadata: (row.metadata as any) || {},
          },
          keywordScore,
          vectorScore,
          finalScore,
        });
      }
    }

    // 4. Сортировка по финальному скору
    scoredItems.sort((a, b) => b.finalScore - a.finalScore);

    // 5. Дедупликация: исключаем одинаковые куски текста из одного документа
    const seenContent = new Set<string>();
    const deduplicated: SearchResultItem[] = [];

    for (const scored of scoredItems) {
      const contentSnippet = scored.item.content.slice(0, 100);
      if (!seenContent.has(contentSnippet)) {
        seenContent.add(contentSnippet);
        deduplicated.push(scored.item);
      }
      if (deduplicated.length >= limit) {
        break;
      }
    }

    return deduplicated;
  }
}
