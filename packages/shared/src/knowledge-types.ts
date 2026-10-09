import { z } from 'zod';

export type KnowledgeSourceType =
  | 'file'
  | 'directory'
  | 'git'
  | 'github'
  | 'execution_history'
  | 'user_note'
  | 'agent_output';

export type KnowledgeSourceStatus =
  | 'idle'
  | 'indexing'
  | 'indexed'
  | 'error'
  | 'requires_ocr';

export type KnowledgeDocumentStatus =
  | 'pending'
  | 'parsed'
  | 'chunked'
  | 'indexed'
  | 'error'
  | 'requires_ocr';

export interface KnowledgeSourceDto {
  id: string;
  userId: string;
  name: string;
  type: KnowledgeSourceType;
  pathOrUrl?: string | null;
  config: Record<string, any>;
  status: KnowledgeSourceStatus;
  lastSyncAt?: string | null;
  lastError?: string | null;
  itemCount: number;
  contentHash?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDocumentDto {
  id: string;
  sourceId: string;
  userId: string;
  title: string;
  uri: string;
  mimeType: string;
  byteSize: number;
  contentHash: string;
  version: number;
  status: KnowledgeDocumentStatus;
  pageCount: number;
  metadata: Record<string, any>;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunkDto {
  id: string;
  documentId: string;
  sourceId: string;
  chunkIndex: number;
  content: string;
  pageNumber?: number | null;
  startChar?: number | null;
  endChar?: number | null;
  contentHash: string;
  embeddingModel?: string | null;
  embeddingDim?: number | null;
  metadata: Record<string, any>;
  createdAt: string;
}

// Граф знаний (Knowledge Graph)
export type KnowledgeEntityType =
  | 'Project'
  | 'Document'
  | 'Repository'
  | 'Person'
  | 'Task'
  | 'Decision'
  | 'Technology'
  | 'Event'
  | 'Concept';

export type KnowledgeRelationType =
  | 'depends_on'
  | 'belongs_to'
  | 'created_by'
  | 'references'
  | 'related_to'
  | 'supersedes'
  | 'implements';

export type KnowledgeRelationStatus = 'suggested' | 'verified' | 'rejected';

export interface KnowledgeEntityDto {
  id: string;
  userId: string;
  sourceId?: string | null;
  documentId?: string | null;
  name: string;
  type: KnowledgeEntityType;
  description?: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeRelationDto {
  id: string;
  userId: string;
  fromEntityId: string;
  toEntityId: string;
  relationType: KnowledgeRelationType;
  confidence: number; // 0..100
  provenance?: string | null;
  status: KnowledgeRelationStatus;
  verifiedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Поиск и RAG
export type SearchMode = 'hybrid' | 'text' | 'vector';

export interface SearchResultItem {
  chunkId: string;
  documentId: string;
  sourceId: string;
  documentTitle: string;
  uri: string;
  pageNumber?: number | null;
  chunkIndex: number;
  content: string;
  score: number; // 0..1
  searchType: 'vector' | 'keyword' | 'hybrid';
  metadata: Record<string, any>;
}

export interface Citation {
  index: number;
  documentId: string;
  documentTitle: string;
  uri: string;
  pageNumber?: number | null;
  chunkIndex: number;
  snippet: string;
}

export interface RAGAnswerResult {
  answer: string;
  hasSufficientContext: boolean;
  citations: Citation[];
  usedTokens?: number;
  retrievedChunksCount: number;
}

// Долговременная память агентов
export type LongTermMemoryScope =
  | 'episodic'
  | 'semantic'
  | 'project'
  | 'shared'
  | 'execution'
  | 'workflow'
  | 'agent'
  | 'user';

export interface AgentMemoryEntryDto {
  id: string;
  userId: string;
  agentId?: string | null;
  workflowId?: string | null;
  executionId?: string | null;
  scope: LongTermMemoryScope;
  key: string;
  value: any;
  metadata: Record<string, any>;
  confidence?: number;
  isVerified?: boolean;
  provenance?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Учет токенов
export interface TokenUsageRecordDto {
  id: string;
  userId: string;
  providerId?: string | null;
  model: string;
  agentId?: string | null;
  workflowId?: string | null;
  executionId?: string | null;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
  estimatedCostMicros: number;
  isEstimated: boolean;
  createdAt: string;
}

export interface TokenBudgetConfig {
  dailyLimitTokens: number;
  perExecutionLimitTokens: number;
  perAgentLimitTokens: number;
  actionOnLimit: 'warn' | 'stop';
  todayUsedTokens: number;
  isBudgetExceeded: boolean;
}
