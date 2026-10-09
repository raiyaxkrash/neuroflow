import crypto from 'node:crypto';

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimension: number;
  embeddingType: 'semantic_neural' | 'heuristic_ngram_fallback';
  provider: 'ollama' | 'openai' | 'fallback';
  isFallback: boolean;
}

export class EmbeddingService {
  /**
   * Вычисление косинусного сходства между двумя векторами одинаковой размерности.
   * Возвращает значение от -1.0 до 1.0 (для L2-нормализованных векторов: от 0.0 до 1.0).
   */
  public static cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) {
      return 0;
    }
    if (vecA.length !== vecB.length) {
      throw new Error(`[Embedding] Несовпадение размерностей векторов: ${vecA.length} != ${vecB.length}. Нельзя смешивать разные модели!`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return Math.max(-1, Math.min(1, dotProduct / denominator));
  }

  /**
   * Детерминированное построение векторного представления на базе n-грамм и L2-нормализации.
   * Используется ИСКЛЮЧИТЕЛЬНО как автономный эвристический fallback при недоступности внешних нейросетей.
   */
  public static generateDeterministicEmbedding(text: string, dimension = 384): number[] {
    const vector = new Array(dimension).fill(0);
    const normalized = (text || '').toLowerCase().trim();
    if (!normalized) return vector;

    // Разбиение на слова и биграммы
    const tokens = normalized.split(/\s+/);
    const ngrams: string[] = [...tokens];
    for (let i = 0; i < tokens.length - 1; i++) {
      ngrams.push(`${tokens[i]}_${tokens[i + 1]}`);
    }

    for (const ngram of ngrams) {
      // Хеширование токена в несколько индексов вектора
      const hash = crypto.createHash('sha256').update(ngram).digest();
      const idx1 = hash.readUInt16LE(0) % dimension;
      const idx2 = hash.readUInt16LE(2) % dimension;
      const idx3 = hash.readUInt16LE(4) % dimension;

      // Приращение с учетом веса длины токена
      const weight = Math.log(1 + ngram.length);
      vector[idx1] += weight;
      vector[idx2] += weight * 0.7;
      vector[idx3] += weight * 0.5;
    }

    // L2-нормализация вектора
    let sumSquares = 0;
    for (let i = 0; i < dimension; i++) {
      sumSquares += vector[i] * vector[i];
    }

    const norm = Math.sqrt(sumSquares);
    if (norm > 0) {
      for (let i = 0; i < dimension; i++) {
        vector[i] = Number((vector[i] / norm).toFixed(6));
      }
    }

    return vector;
  }

  /**
   * Получение векторного представления через Ollama, OpenAI или детерминированный fallback.
   * Четко помечает, является ли результат настоящим нейросетевым эмбеддингом или эвристикой.
   */
  public static async getEmbedding(
    text: string,
    options: {
      providerType?: 'ollama' | 'openai' | 'mock' | 'deterministic';
      baseUrl?: string;
      apiKey?: string;
      model?: string;
      dimension?: number;
    } = {}
  ): Promise<EmbeddingResult> {
    const providerType = options.providerType || 'deterministic';
    const model = options.model || (providerType === 'ollama' ? 'nomic-embed-text' : providerType === 'openai' ? 'text-embedding-3-small' : 'heuristic-ngram-384');
    const dimension = options.dimension || (model.includes('384') ? 384 : 1536);

    // 1. Ollama локально (реальные нейросетевые эмбеддинги)
    if (providerType === 'ollama') {
      try {
        const baseUrl = options.baseUrl || 'http://localhost:11434';
        const res = await fetch(`${baseUrl}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt: text }),
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          if (Array.isArray(data.embedding)) {
            return {
              embedding: data.embedding,
              model,
              dimension: data.embedding.length,
              embeddingType: 'semantic_neural',
              provider: 'ollama',
              isFallback: false,
            };
          }
        }
      } catch (err: any) {
        console.warn(`[Embedding] Локальный Ollama недоступен (${err.message}). Переход на автономный n-gram fallback.`);
      }
    }

    // 2. OpenAI-совместимый API (реальные нейросетевые эмбеддинги)
    if (providerType === 'openai' && options.apiKey) {
      try {
        const baseUrl = options.baseUrl || 'https://api.openai.com/v1';
        const res = await fetch(`${baseUrl}/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${options.apiKey}`,
          },
          body: JSON.stringify({ model, input: text }),
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          const emb = data.data?.[0]?.embedding;
          if (Array.isArray(emb)) {
            return {
              embedding: emb,
              model,
              dimension: emb.length,
              embeddingType: 'semantic_neural',
              provider: 'openai',
              isFallback: false,
            };
          }
        }
      } catch (err: any) {
        console.warn(`[Embedding] OpenAI API недоступен (${err.message}). Переход на автономный n-gram fallback.`);
      }
    }

    // 3. Автономный n-gram эвристический fallback
    const embedding = this.generateDeterministicEmbedding(text, dimension);
    return {
      embedding,
      model: `heuristic-ngram-${dimension}`,
      dimension,
      embeddingType: 'heuristic_ngram_fallback',
      provider: 'fallback',
      isFallback: true,
    };
  }

  /**
   * Пакетная генерация векторных представлений
   */
  public static async getBatchEmbeddings(
    texts: string[],
    options: {
      providerType?: 'ollama' | 'openai' | 'mock' | 'deterministic';
      baseUrl?: string;
      apiKey?: string;
      model?: string;
      dimension?: number;
    } = {}
  ): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    for (const text of texts) {
      const emb = await this.getEmbedding(text, options);
      results.push(emb);
    }
    return results;
  }
}
