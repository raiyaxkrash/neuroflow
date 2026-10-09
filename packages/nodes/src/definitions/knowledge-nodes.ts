import { BaseNodeDef, NodeExecutionContext, NodeExecutionOutput } from '../base.js';
import {
  NodeCategory,
  WorkflowPortDefinition,
  KnowledgeSearchParametersSchema,
  KnowledgeInsertParametersSchema,
  DocumentLoaderParametersSchema,
  DocumentChunkerParametersSchema,
  EmbeddingsGeneratorParametersSchema,
  RAGQueryParametersSchema,
  MemoryReadParametersSchema,
  MemoryWriteParametersSchema,
  KnowledgeGraphQueryParametersSchema,
} from '@neuroflow/shared';
import { HybridSearchEngine } from '../knowledge/hybrid-search.js';
import { KnowledgeService } from '../knowledge/knowledge-service.js';
import { DocumentParser } from '../knowledge/document-parser.js';
import { ChunkingEngine } from '../knowledge/chunking-engine.js';
import { EmbeddingService } from '../knowledge/embedding-service.js';
import { RAGEngine } from '../knowledge/rag-engine.js';
import { KnowledgeGraphService } from '../knowledge/knowledge-graph-service.js';
import { TokenUsageManager } from '../knowledge/token-manager.js';
import { getDatabase, agentMemories, eq, and } from '@neuroflow/database';

// Хелпер подстановки строковых шаблонов вида {{variable}}
function interpolateString(template: string, data: Record<string, any>): string {
  if (!template || typeof template !== 'string') return template;
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const trimmed = key.trim();
    const parts = trimmed.split('.');
    let val: any = data;
    for (const part of parts) {
      if (val && typeof val === 'object' && part in val) {
        val = val[part];
      } else {
        return `{{${trimmed}}}`;
      }
    }
    return val !== undefined ? String(val) : '';
  });
}

// 1. Knowledge Search Node
export class KnowledgeSearchNode extends BaseNodeDef {
  type = 'knowledge-search';
  name = 'Knowledge Search';
  description = 'Семантический и гибридный поиск по базе знаний Second Brain с ранжированием и цитатами';
  category = NodeCategory.KNOWLEDGE;
  icon = 'Search';
  color = '#8B5CF6';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Поисковый запрос или контекст' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Results', type: 'main', description: 'Найденные релевантные фрагменты' },
  ];

  parameterSchema = KnowledgeSearchParametersSchema;
  defaultParameters = {
    query: '',
    searchMode: 'hybrid' as const,
    limit: 5,
    minScore: 0.2,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const input = (context as any).inputData ?? (context as any).input ?? {};
    const fullContext = { ...context.workflowContext, ...input };

    const rawQuery = params.query || input.query || input.question || input.text || '';
    const query = interpolateString(rawQuery, fullContext).trim();

    if (!query) {
      throw new Error('[Knowledge Search] Поисковый запрос не может быть пустым.');
    }

    const userId = (context.workflowContext as any)?.userId || '00000000-0000-0000-0000-000000000001';

    const results = await HybridSearchEngine.search(query, {
      userId,
      searchMode: params.searchMode || this.defaultParameters.searchMode,
      limit: params.limit || this.defaultParameters.limit,
      minScore: params.minScore || this.defaultParameters.minScore,
      sourceIds: params.sourceIds,
    });

    const payload = {
      query,
      resultsCount: results.length,
      chunks: results,
      formattedSnippets: results.map((r, i) => `[${i + 1}] "${r.documentTitle}": ${r.content}`).join('\n\n'),
    };

    return {
      outputData: payload,
      output: payload,
      selectedPort: 'main',
    };
  }
}

// 2. Knowledge Insert Node
export class KnowledgeInsertNode extends BaseNodeDef {
  type = 'knowledge-insert';
  name = 'Knowledge Insert';
  description = 'Сохранение документа или заметки в Second Brain с автоматическим чанкингом и векторизацией';
  category = NodeCategory.KNOWLEDGE;
  icon = 'Database';
  color = '#8B5CF6';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Текст или документ для сохранения' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Result', type: 'main', description: 'Метаданные созданного документа и чанков' },
  ];

  parameterSchema = KnowledgeInsertParametersSchema;
  defaultParameters = {
    title: 'Untitled Note',
    content: '',
    chunkSize: 800,
    chunkOverlap: 150,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const input = (context as any).inputData ?? (context as any).input ?? {};
    const fullContext = { ...context.workflowContext, ...input };

    const rawTitle = params.title || input.title || 'Новая заметка';
    const title = interpolateString(rawTitle, fullContext);

    const rawContent = params.content || input.content || input.text || (typeof input === 'string' ? input : JSON.stringify(input, null, 2));
    const content = interpolateString(rawContent, fullContext);

    if (!content.trim()) {
      throw new Error('[Knowledge Insert] Содержимое документа для вставки не может быть пустым.');
    }

    const userId = (context.workflowContext as any)?.userId || '00000000-0000-0000-0000-000000000001';

    const inserted = await KnowledgeService.insertDocument({
      userId,
      title,
      content,
      sourceId: params.sourceId,
      metadata: params.metadata,
      chunkSize: params.chunkSize || this.defaultParameters.chunkSize,
      chunkOverlap: params.chunkOverlap || this.defaultParameters.chunkOverlap,
    });

    const payload = {
      success: true,
      documentId: inserted.documentId,
      title,
      chunksCreated: inserted.chunkCount,
    };

    return {
      outputData: payload,
      output: payload,
      selectedPort: 'main',
    };
  }
}

// 3. Document Loader Node
export class DocumentLoaderNode extends BaseNodeDef {
  type = 'document-loader';
  name = 'Document Loader';
  description = 'Загрузка и парсинг локальных документов (PDF, Markdown, TXT, JSON, CSV) с фильтрацией секретов';
  category = NodeCategory.KNOWLEDGE;
  icon = 'FileText';
  color = '#8B5CF6';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Путь к файлу или сырые данные' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Document', type: 'main', description: 'Разобранное текстовое содержимое' },
  ];

  parameterSchema = DocumentLoaderParametersSchema;
  defaultParameters = {
    sourceType: 'file_path' as const,
    pathOrText: '',
    encoding: 'utf-8' as const,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const input = (context as any).inputData ?? (context as any).input ?? {};
    const fullContext = { ...context.workflowContext, ...input };

    const rawPathOrText = params.pathOrText || input.filePath || input.path || input.text || '';
    const pathOrText = interpolateString(rawPathOrText, fullContext);

    if (!pathOrText.trim()) {
      throw new Error('[Document Loader] Не указан путь к файлу или текст документа.');
    }

    let parsedResult;
    if (params.sourceType === 'file_path' || input.filePath) {
      parsedResult = await DocumentParser.parse({ filePath: pathOrText });
    } else {
      parsedResult = await DocumentParser.parse({ rawText: pathOrText, title: input.title || 'Loaded Text' });
    }

    const payload = {
      title: parsedResult.title,
      content: parsedResult.content,
      mimeType: parsedResult.mimeType,
      byteSize: parsedResult.byteSize,
      contentHash: parsedResult.contentHash,
      pageCount: parsedResult.pageCount,
      requiresOcr: parsedResult.requiresOcr,
      hasSensitiveData: parsedResult.hasSensitiveData,
    };

    return {
      outputData: payload,
      output: payload,
      selectedPort: 'main',
    };
  }
}

// 4. Document Chunker Node
export class DocumentChunkerNode extends BaseNodeDef {
  type = 'document-chunker';
  name = 'Document Chunker';
  description = 'Разбиение длинного текста на смысловые фрагменты с настраиваемым размером и перекрытием';
  category = NodeCategory.KNOWLEDGE;
  icon = 'Scissors';
  color = '#8B5CF6';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Text', type: 'main', description: 'Текст для фрагментации' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Chunks', type: 'main', description: 'Массив полученных фрагментов' },
  ];

  parameterSchema = DocumentChunkerParametersSchema;
  defaultParameters = {
    chunkSize: 800,
    chunkOverlap: 150,
    strategy: 'recursive' as const,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const input = (context as any).inputData ?? (context as any).input ?? {};
    const textToChunk = input.content || input.text || (typeof input === 'string' ? input : JSON.stringify(input));

    if (!textToChunk || typeof textToChunk !== 'string') {
      throw new Error('[Document Chunker] Входной текст для разбиения отсутствует.');
    }

    const chunks = ChunkingEngine.chunkText(textToChunk, {
      chunkSize: params.chunkSize || this.defaultParameters.chunkSize,
      chunkOverlap: params.chunkOverlap || this.defaultParameters.chunkOverlap,
      documentId: input.documentId,
    });

    const payload = {
      chunksCount: chunks.length,
      chunks,
    };

    return {
      outputData: payload,
      output: payload,
      selectedPort: 'main',
    };
  }
}

// 5. Embeddings Generator Node
export class EmbeddingsGeneratorNode extends BaseNodeDef {
  type = 'embeddings-generator';
  name = 'Embeddings Generator';
  description = 'Генерация векторных эмбеддингов для текстов через Ollama, OpenAI или локальный сервис';
  category = NodeCategory.KNOWLEDGE;
  icon = 'Cpu';
  color = '#8B5CF6';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Текст или массив фрагментов' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Embeddings', type: 'main', description: 'Векторные представления' },
  ];

  parameterSchema = EmbeddingsGeneratorParametersSchema;
  defaultParameters = {
    model: 'default',
    batchSize: 10,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const input = (context as any).inputData ?? (context as any).input ?? {};

    let texts: string[] = [];
    if (Array.isArray(input.chunks)) {
      texts = input.chunks.map((c: any) => c.content || String(c));
    } else if (Array.isArray(input.texts)) {
      texts = input.texts;
    } else if (input.text || input.content) {
      texts = [input.text || input.content];
    } else if (typeof input === 'string') {
      texts = [input];
    }

    if (texts.length === 0) {
      throw new Error('[Embeddings Generator] Нет текстов для построения векторов.');
    }

    const embeddings = await EmbeddingService.getBatchEmbeddings(texts, {
      providerType: 'deterministic',
      model: params.model || this.defaultParameters.model,
    });

    const payload = {
      count: embeddings.length,
      model: embeddings[0]?.model,
      dimension: embeddings[0]?.dimension,
      embeddings: embeddings.map((e) => e.embedding),
    };

    return {
      outputData: payload,
      output: payload,
      selectedPort: 'main',
    };
  }
}

// 6. RAG Query Node
export class RAGQueryNode extends BaseNodeDef {
  type = 'rag-query';
  name = 'RAG Query';
  description = 'Сквозной RAG: извлечение контекста, защита от инъекций и генерация ответа с обязательными цитатами';
  category = NodeCategory.KNOWLEDGE;
  icon = 'BookOpen';
  color = '#8B5CF6';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Question', type: 'main', description: 'Вопрос пользователя' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Answer', type: 'main', description: 'Обоснованный ответ с цитатами первоисточников' },
  ];

  parameterSchema = RAGQueryParametersSchema;
  defaultParameters = {
    question: '',
    searchMode: 'hybrid' as const,
    maxChunks: 5,
    temperature: 0.2,
    strictCitation: true,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const input = (context as any).inputData ?? (context as any).input ?? {};
    const fullContext = { ...context.workflowContext, ...input };

    const rawQuestion = params.question || input.question || input.query || input.prompt || '';
    const question = interpolateString(rawQuestion, fullContext).trim();

    if (!question) {
      throw new Error('[RAG Query] Вопрос для поиска не может быть пустым.');
    }

    const userId = (context.workflowContext as any)?.userId || '00000000-0000-0000-0000-000000000001';

    const ragResult = await RAGEngine.answerQuestion({
      userId,
      question,
      searchMode: params.searchMode || this.defaultParameters.searchMode,
      maxChunks: params.maxChunks || this.defaultParameters.maxChunks,
      providerId: params.providerId,
      model: params.model,
      temperature: params.temperature || this.defaultParameters.temperature,
    });

    // Учет использованных токенов
    if (ragResult.usedTokens) {
      await TokenUsageManager.recordUsage({
        userId,
        model: params.model || 'default',
        inputTokens: Math.round(ragResult.usedTokens * 0.7),
        outputTokens: Math.round(ragResult.usedTokens * 0.3),
        workflowId: (context.workflowContext as any)?.workflowId,
        executionId: (context.workflowContext as any)?.executionId,
      });
    }

    const payload = {
      question,
      answer: ragResult.answer,
      hasSufficientContext: ragResult.hasSufficientContext,
      citations: ragResult.citations,
      citationsText: ragResult.citations.map((c) => `[${c.index}] "${c.documentTitle}" (фрагмент ${c.chunkIndex})`).join(', '),
      retrievedChunksCount: ragResult.retrievedChunksCount,
    };

    return {
      outputData: payload,
      output: payload,
      selectedPort: 'main',
    };
  }
}

// 7. Memory Read Node
export class MemoryReadNode extends BaseNodeDef {
  type = 'memory-read';
  name = 'Memory Read';
  description = 'Чтение из долговременной памяти агента (Episodic, Semantic, Project, Shared)';
  category = NodeCategory.KNOWLEDGE;
  icon = 'Eye';
  color = '#8B5CF6';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Ключ или запрос для поиска в памяти' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Value', type: 'main', description: 'Значение или список записей из памяти' },
  ];

  parameterSchema = MemoryReadParametersSchema;
  defaultParameters = {
    scope: 'semantic' as const,
    key: '',
    limit: 10,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const input = (context as any).inputData ?? (context as any).input ?? {};
    const fullContext = { ...context.workflowContext, ...input };

    const rawKey = params.key || input.key;
    const key = rawKey ? interpolateString(rawKey, fullContext) : undefined;
    const query = params.query || input.query;
    const userId = (context.workflowContext as any)?.userId || '00000000-0000-0000-0000-000000000001';

    let value: any = null;
    let records: any[] = [];

    const db = getDatabase();
    if (key) {
      const [row] = await db
        .select()
        .from(agentMemories)
        .where(
          and(
            eq(agentMemories.userId, userId),
            eq(agentMemories.scope, (params.scope || this.defaultParameters.scope) as any),
            eq(agentMemories.key, key)
          )
        )
        .limit(1);
      value = row ? row.value : null;
    }

    const rows = await db
      .select({
        id: agentMemories.id,
        key: agentMemories.key,
        value: agentMemories.value,
        confidence: agentMemories.confidence,
        isVerified: agentMemories.isVerified,
        provenance: agentMemories.provenance,
      })
      .from(agentMemories)
      .where(
        and(
          eq(agentMemories.userId, userId),
          eq(agentMemories.scope, (params.scope || this.defaultParameters.scope) as any)
        )
      )
      .limit(params.limit || 10);

    const term = (query || key || '').toLowerCase();
    records = term
      ? rows.filter((r: any) => r.key.toLowerCase().includes(term) || JSON.stringify(r.value).toLowerCase().includes(term))
      : rows;

    const payload = {
      scope: params.scope,
      key,
      value,
      records,
    };

    return {
      outputData: payload,
      output: payload,
      selectedPort: 'main',
    };
  }
}

// 8. Memory Write Node
export class MemoryWriteNode extends BaseNodeDef {
  type = 'memory-write';
  name = 'Memory Write';
  description = 'Запись в долговременную память с опциональным согласованием владельцем для важных инструкций';
  category = NodeCategory.KNOWLEDGE;
  icon = 'Save';
  color = '#8B5CF6';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Data', type: 'main', description: 'Данные для сохранения в память' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Status', type: 'main', description: 'Результат записи в память' },
  ];

  parameterSchema = MemoryWriteParametersSchema;
  defaultParameters = {
    scope: 'semantic' as const,
    key: '',
    requiresApproval: false,
    confidence: 100,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const input = (context as any).inputData ?? (context as any).input ?? {};
    const fullContext = { ...context.workflowContext, ...input };

    const rawKey = params.key || input.key;
    if (!rawKey) {
      throw new Error('[Memory Write] Не указан ключ для сохранения в памяти.');
    }
    const key = interpolateString(rawKey, fullContext);

    const value = params.value !== undefined && params.value !== ''
      ? params.value
      : input.value !== undefined ? input.value : input;

    const userId = (context.workflowContext as any)?.userId || '00000000-0000-0000-0000-000000000001';

    // Человеческое одобрение для критических инструкций и фактов
    if (params.requiresApproval) {
      const isApproved = (context.workflowContext as any)?.__approved;
      if (!isApproved) {
        return {
          outputData: {
            waitingForApproval: true,
            action: 'memory_write',
            scope: params.scope,
            key,
            value,
          },
          output: { waitingForApproval: true },
          selectedPort: 'main',
        };
      }
    }

    const db = getDatabase();
    const jsonValue = typeof value === 'object' ? value : { text: String(value) };
    const expiresAt = params.ttlSeconds ? new Date(Date.now() + params.ttlSeconds * 1000) : null;

    const existing = await db
      .select()
      .from(agentMemories)
      .where(
        and(
          eq(agentMemories.userId, userId),
          eq(agentMemories.scope, (params.scope || this.defaultParameters.scope) as any),
          eq(agentMemories.key, key)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(agentMemories)
        .set({
          value: jsonValue,
          confidence: params.confidence || 100,
          provenance: params.provenance || existing[0].provenance,
          expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(agentMemories.id, existing[0].id));
    } else {
      await db.insert(agentMemories).values({
        userId,
        scope: (params.scope || this.defaultParameters.scope) as any,
        key,
        value: jsonValue,
        confidence: params.confidence || 100,
        isVerified: true,
        provenance: params.provenance || 'Сохранено узлом Memory Write',
        expiresAt,
        workflowId: (context.workflowContext as any)?.workflowId || null,
        executionId: (context.workflowContext as any)?.executionId || null,
      });
    }

    const payload = {
      success: true,
      scope: params.scope,
      key,
      value,
    };

    return {
      outputData: payload,
      output: payload,
      selectedPort: 'main',
    };
  }
}

// 9. Knowledge Graph Query Node
export class KnowledgeGraphQueryNode extends BaseNodeDef {
  type = 'knowledge-graph-query';
  name = 'Knowledge Graph Query';
  description = 'Поиск сущностей, связей и первоисточников в графе знаний Second Brain';
  category = NodeCategory.KNOWLEDGE;
  icon = 'Share2';
  color = '#8B5CF6';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Query', type: 'main', description: 'Параметры поиска в графе' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Graph', type: 'main', description: 'Сущности и связи графа' },
  ];

  parameterSchema = KnowledgeGraphQueryParametersSchema;
  defaultParameters = {
    query: '',
    maxDepth: 2,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const input = (context as any).inputData ?? (context as any).input ?? {};
    const fullContext = { ...context.workflowContext, ...input };

    const rawQuery = params.query || input.query || input.name || '';
    const query = interpolateString(rawQuery, fullContext).trim();

    const userId = (context.workflowContext as any)?.userId || '00000000-0000-0000-0000-000000000001';

    const graph = await KnowledgeGraphService.getGraph({
      userId,
      search: query || undefined,
      entityTypes: params.entityTypes as any,
      relationTypes: params.relationTypes as any,
    });

    const payload = {
      query,
      entitiesCount: graph.entities.length,
      relationsCount: graph.relations.length,
      entities: graph.entities,
      relations: graph.relations,
    };

    return {
      outputData: payload,
      output: payload,
      selectedPort: 'main',
    };
  }
}
