'use client';

import React, { useState, useEffect } from 'react';
import {
  Brain,
  Search,
  Database,
  FileText,
  GitBranch,
  BookOpen,
  Sparkles,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Coins,
  Cpu,
  Layers,
  Tag,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
} from 'lucide-react';

interface KnowledgeSource {
  id: string;
  name: string;
  type: string;
  pathOrUrl?: string;
  status: 'idle' | 'indexing' | 'indexed' | 'error' | 'requires_ocr';
  itemCount: number;
  lastSyncAt?: string;
  lastError?: string;
}

interface SearchResult {
  chunkId: string;
  documentTitle: string;
  content: string;
  score: number;
  searchType: string;
  chunkIndex: number;
  pageNumber?: number;
}

interface Citation {
  index: number;
  documentTitle: string;
  chunkIndex: number;
  snippet: string;
}

interface GraphEntity {
  id: string;
  name: string;
  type: string;
  description?: string;
}

interface GraphRelation {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  relationType: string;
  confidence: number;
  provenance?: string;
  status: 'suggested' | 'verified' | 'rejected';
}

export default function SecondBrainPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'sources' | 'search' | 'graph' | 'memory' | 'tokens'>('overview');
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'hybrid' | 'text' | 'vector'>('hybrid');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [ragAnswer, setRagAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Граф
  const [entities, setEntities] = useState<GraphEntity[]>([]);
  const [relations, setRelations] = useState<GraphRelation[]>([]);

  // Память
  const [memoryScope, setMemoryScope] = useState<'semantic' | 'episodic' | 'project' | 'shared'>('semantic');
  const [memoryEntries, setMemoryEntries] = useState<any[]>([]);

  // Токены
  const [tokenStats, setTokenStats] = useState<any>(null);
  const [tokenBudget, setTokenBudget] = useState<any>(null);

  // Модалка источника
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceType, setNewSourceType] = useState('directory');
  const [newSourcePath, setNewSourcePath] = useState('./data/documents');

  const getAuthHeaders = () => {
    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('neuroflow_token') || window.localStorage.getItem('token')
        : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const fetchSources = async () => {
    try {
      const res = await fetch('/api/knowledge/sources', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSources(data);
      }
    } catch {
      // Игнорируем в offline
    }
  };

  const fetchGraph = async () => {
    try {
      const res = await fetch('/api/knowledge/graph', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setEntities(data.entities || []);
        setRelations(data.relations || []);
      }
    } catch {}
  };

  const fetchMemory = async () => {
    try {
      const res = await fetch(`/api/knowledge/memory?scope=${memoryScope}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMemoryEntries(data);
      }
    } catch {}
  };

  const fetchTokens = async () => {
    try {
      const [resStats, resBudget] = await Promise.all([
        fetch('/api/knowledge/tokens/stats', { headers: getAuthHeaders() }),
        fetch('/api/knowledge/tokens/budget', { headers: getAuthHeaders() }),
      ]);
      if (resStats.ok) setTokenStats(await resStats.json());
      if (resBudget.ok) setTokenBudget(await resBudget.json());
    } catch {}
  };

  useEffect(() => {
    fetchSources();
    fetchGraph();
    fetchTokens();
  }, []);

  useEffect(() => {
    if (activeTab === 'memory') fetchMemory();
    if (activeTab === 'tokens') fetchTokens();
  }, [activeTab, memoryScope]);

  const handleCreateSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim()) return;

    try {
      const res = await fetch('/api/knowledge/sources', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newSourceName,
          type: newSourceType,
          pathOrUrl: newSourcePath,
        }),
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewSourceName('');
        fetchSources();
      }
    } catch {}
  };

  const handleSyncSource = async (id: string) => {
    setLoading(true);
    try {
      await fetch(`/api/knowledge/sources/${id}/sync`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      await fetchSources();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (!confirm('Удалить источник и все связанные документы?')) return;
    try {
      await fetch(`/api/knowledge/sources/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      await fetchSources();
    } catch {}
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setRagAnswer(null);
    setCitations([]);

    try {
      // 1. Поиск фрагментов
      const searchRes = await fetch('/api/knowledge/search', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          query: searchQuery,
          searchMode,
          limit: 6,
        }),
      });
      if (searchRes.ok) {
        const data = await searchRes.json();
        setSearchResults(data.results || []);
      }

      // 2. Генерация RAG-ответа со строгими цитатами
      const ragRes = await fetch('/api/knowledge/rag', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          question: searchQuery,
          searchMode,
          maxChunks: 4,
        }),
      });
      if (ragRes.ok) {
        const ragData = await ragRes.json();
        setRagAnswer(ragData.answer);
        setCitations(ragData.citations || []);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleVerifyRelation = async (relId: string) => {
    try {
      await fetch(`/api/knowledge/graph/relations/${relId}/verify`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      await fetchGraph();
    } catch {}
  };

  const handleRejectRelation = async (relId: string) => {
    try {
      await fetch(`/api/knowledge/graph/relations/${relId}/reject`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      await fetchGraph();
    } catch {}
  };

  return (
    <div className="flex-1 bg-background text-foreground flex flex-col h-full overflow-hidden transition-colors">
      {/* Header */}
      <div className="border-b border-border px-4 sm:px-8 py-3 sm:py-0 sm:h-16 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-semibold text-foreground tracking-tight flex items-center gap-2">
              Second Brain & База знаний
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                Phase 5
              </span>
            </h1>
            <p className="hidden sm:block text-xs text-muted-foreground">
              Долговременная база знаний, гибридный RAG-поиск, граф сущностей и память AI-агентов
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-primary hover:opacity-90 text-primary-foreground text-xs font-medium transition-opacity shadow-sm shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Подключить источник
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="border-b border-border px-4 sm:px-8 bg-card/60 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
        {[
          { id: 'overview', label: 'Обзор', icon: Layers },
          { id: 'sources', label: 'Источники данных', icon: Database },
          { id: 'search', label: 'Семантический поиск & RAG', icon: Search },
          { id: 'graph', label: 'Граф знаний', icon: GitBranch },
          { id: 'memory', label: 'Память агентов', icon: Brain },
          { id: 'tokens', label: 'Расход токенов', icon: Coins },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-3 text-xs font-medium border-b-2 transition-all whitespace-nowrap shrink-0 ${
                isActive
                  ? 'border-highlight text-foreground font-semibold bg-muted/50'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6 max-w-6xl">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-card border border-border space-y-2 shadow-sm">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span>Источники знаний</span>
                  <Database className="w-4 h-4 text-primary" />
                </div>
                <div className="text-2xl font-bold text-foreground">{sources.length}</div>
                <div className="text-[11px] text-muted-foreground">Подключено вручную</div>
              </div>

              <div className="p-4 rounded-xl bg-card border border-border space-y-2 shadow-sm">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span>Документы & Файлы</span>
                  <FileText className="w-4 h-4 text-status-info" />
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {sources.reduce((acc, s) => acc + (s.itemCount || 0), 0)}
                </div>
                <div className="text-[11px] text-muted-foreground">Проиндексировано в БД</div>
              </div>

              <div className="p-4 rounded-xl bg-card border border-border space-y-2 shadow-sm">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span>Сущности графа</span>
                  <GitBranch className="w-4 h-4 text-status-warning" />
                </div>
                <div className="text-2xl font-bold text-foreground">{entities.length}</div>
                <div className="text-[11px] text-muted-foreground">{relations.length} связей в графе</div>
              </div>

              <div className="p-4 rounded-xl bg-card border border-border space-y-2 shadow-sm">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span>Токены за сегодня</span>
                  <Coins className="w-4 h-4 text-status-success" />
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {tokenBudget?.todayUsedTokens?.toLocaleString() || '0'}
                </div>
                <div className="text-[11px] text-status-success">
                  Лимит: {tokenBudget?.dailyLimitTokens?.toLocaleString() || '1,000,000'}
                </div>
              </div>
            </div>

            {/* Quick Search Widget */}
            <div className="p-6 rounded-xl bg-card border border-border space-y-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Быстрый семантический поиск по вашим знаниям</h2>
              </div>
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Задайте любой вопрос по вашей документации или заметкам..."
                    className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:opacity-90 text-primary-foreground text-xs font-medium transition-opacity shadow-sm flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  Найти
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: SOURCES */}
        {activeTab === 'sources' && (
          <div className="space-y-4 max-w-6xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-white">Подключенные источники знаний</h2>
              <span className="text-xs text-slate-400">Автоматическая фильтрация .env и секретов активна</span>
            </div>

            {sources.length === 0 ? (
              <div className="p-12 text-center rounded-xl bg-card border border-border space-y-3 shadow-sm">
                <Database className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                <div className="text-sm text-foreground font-medium">Нет подключенных источников</div>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Подключите локальную папку с документами (TXT, Markdown, PDF, JSON), Git-репозиторий или создайте заметку.
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 rounded-xl bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold shadow-sm transition-opacity"
                >
                  Подключить первый источник
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {sources.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 rounded-xl bg-card border border-border flex items-center justify-between hover:border-highlight/50 transition-colors shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                        {s.type === 'directory' ? <FileText className="w-4 h-4" /> : <Database className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                          {s.name}
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                            {s.type}
                          </span>
                          {s.status === 'requires_ocr' && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-status-warning-bg text-status-warning border border-status-warning-border flex items-center gap-1 font-mono">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Требуется OCR
                            </span>
                          )}
                          {s.status === 'indexed' && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Индексирован
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {s.pathOrUrl || 'Пользовательские заметки'} • {s.itemCount} документов
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSyncSource(s.id)}
                        disabled={loading}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all text-xs flex items-center gap-1.5"
                        title="Синхронизировать"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span>Синхронизация</span>
                      </button>
                      <button
                        onClick={() => handleDeleteSource(s.id)}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all text-xs"
                        title="Удалить источник"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SEARCH & RAG */}
        {activeTab === 'search' && (
          <div className="space-y-6 max-w-6xl">
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Задайте вопрос: например, 'Почему была изменена архитектура проекта?'"
                    className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-6 py-3 rounded-xl bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold flex items-center gap-2 shadow-sm transition-opacity"
                >
                  {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Спросить Second Brain
                </button>
              </div>

              {/* Mode Selectors */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Режим поиска:</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    checked={searchMode === 'hybrid'}
                    onChange={() => setSearchMode('hybrid')}
                    className="text-primary focus:ring-0"
                  />
                  <span>Гибридный (Hybrid)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    checked={searchMode === 'vector'}
                    onChange={() => setSearchMode('vector')}
                    className="text-primary focus:ring-0"
                  />
                  <span>Семантический (Vector)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    checked={searchMode === 'text'}
                    onChange={() => setSearchMode('text')}
                    className="text-primary focus:ring-0"
                  />
                  <span>По ключевым словам (Keyword)</span>
                </label>
              </div>
            </form>

            {/* RAG Answer with Citations */}
            {ragAnswer && (
              <div className="p-6 rounded-xl bg-card border border-border space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                      Обоснованный ответ Second Brain
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Найдено источников: {citations.length}
                  </span>
                </div>

                <div className="text-xs text-foreground leading-relaxed whitespace-pre-line font-sans">
                  {ragAnswer}
                </div>

                {citations.length > 0 && (
                  <div className="pt-3 border-t border-border space-y-2">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Подтверждающие цитаты и первоисточники:
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {citations.map((c) => (
                        <div
                          key={c.index}
                          className="p-2.5 rounded-xl bg-muted/50 border border-border text-[11px] space-y-1"
                        >
                          <div className="font-semibold text-foreground flex items-center justify-between">
                            <span>[{c.index}] {c.documentTitle}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">фрагмент #{c.chunkIndex}</span>
                          </div>
                          <div className="text-muted-foreground italic font-mono text-[10px] line-clamp-2">
                            "{c.snippet}"
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Found Chunks List */}
            {searchResults.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Найденные фрагменты ({searchResults.length}):
                </h3>
                <div className="space-y-2">
                  {searchResults.map((r, i) => (
                    <div
                      key={r.chunkId || i}
                      className="p-4 rounded-xl bg-card border border-border space-y-2 text-xs shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-primary" />
                          {r.documentTitle}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border text-[10px] font-mono">
                          Score: {Math.round(r.score * 100)}% • {r.searchType}
                        </span>
                      </div>
                      <div className="text-muted-foreground leading-relaxed whitespace-pre-wrap font-mono text-[11px]">
                        {r.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: GRAPH */}
        {activeTab === 'graph' && (
          <div className="space-y-6 max-w-6xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Граф знаний (Сущности & Связи)</h2>
                <p className="text-xs text-slate-400">Проверенные и предложенные связи между архитектурными решениями и документами</p>
              </div>
              <button onClick={fetchGraph} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
                Обновить
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Entities Card */}
              <div className="p-4 rounded-xl bg-card border border-border space-y-3 shadow-sm">
                <div className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5" />
                  Сущности ({entities.length})
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {entities.map((e) => (
                    <div key={e.id} className="p-2.5 rounded-lg bg-muted/40 border border-border flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-foreground">{e.name}</div>
                        <div className="text-[10px] text-muted-foreground">{e.description || 'Без описания'}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-mono border border-border">
                        {e.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Relations Card */}
              <div className="p-4 rounded-xl bg-card border border-border space-y-3 shadow-sm">
                <div className="text-xs font-semibold text-highlight uppercase tracking-wider flex items-center gap-2">
                  <GitBranch className="w-3.5 h-3.5" />
                  Связи графа ({relations.length})
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {relations.map((r) => {
                    const fromName = entities.find((e) => e.id === r.fromEntityId)?.name || 'Entity';
                    const toName = entities.find((e) => e.id === r.toEntityId)?.name || 'Entity';
                    return (
                      <div key={r.id} className="p-2.5 rounded-lg bg-muted/40 border border-border text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground flex items-center gap-1.5">
                            <span className="text-primary">{fromName}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-highlight">{toName}</span>
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                            r.status === 'verified'
                              ? 'bg-status-success-bg text-status-success border border-status-success-border'
                              : 'bg-status-warning-bg text-status-warning border border-status-warning-border'
                          }`}>
                            {r.relationType} ({r.confidence}%)
                          </span>
                        </div>

                        {r.provenance && (
                          <div className="text-[10px] text-muted-foreground italic">
                            Источник: {r.provenance}
                          </div>
                        )}

                        {r.status === 'suggested' && (
                          <div className="flex gap-2 pt-1 border-t border-border">
                            <button
                              onClick={() => handleVerifyRelation(r.id)}
                              className="px-2 py-0.5 rounded bg-status-success-bg hover:bg-status-success-bg/80 text-status-success text-[10px] flex items-center gap-1 border border-status-success-border"
                            >
                              <Check className="w-3 h-3" /> Подтвердить
                            </button>
                            <button
                              onClick={() => handleRejectRelation(r.id)}
                              className="px-2 py-0.5 rounded bg-status-error-bg hover:bg-status-error-bg/80 text-status-error text-[10px] flex items-center gap-1 border border-status-error-border"
                            >
                              <X className="w-3 h-3" /> Отклонить
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: MEMORY */}
        {activeTab === 'memory' && (
          <div className="space-y-4 max-w-6xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Долговременная память AI-агентов</h2>
                <p className="text-xs text-muted-foreground">Факты, эпизоды и контекст с разделением по типам памяти</p>
              </div>
              <div className="flex gap-2">
                {(['semantic', 'episodic', 'project', 'shared'] as const).map((sc) => (
                  <button
                    key={sc}
                    onClick={() => setMemoryScope(sc)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      memoryScope === sc
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {sc.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {memoryEntries.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-card border border-border text-xs text-muted-foreground shadow-sm">
                  В разделе {memoryScope.toUpperCase()} пока нет записей памяти.
                </div>
              ) : (
                memoryEntries.map((m) => (
                  <div key={m.id} className="p-3.5 rounded-xl bg-card border border-border text-xs space-y-1 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-primary font-mono">{m.key}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-foreground font-sans">
                      {typeof m.value === 'object' ? JSON.stringify(m.value) : String(m.value)}
                    </div>
                    {m.provenance && (
                      <div className="text-[10px] text-muted-foreground italic">
                        Происхождение: {m.provenance}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 6: TOKEN USAGE */}
        {activeTab === 'tokens' && (
          <div className="space-y-6 max-w-6xl">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Учет расхода токенов и контроль бюджета</h2>
              <p className="text-xs text-muted-foreground">Статистика по моделям и защита от перерасхода средств</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-card border border-border space-y-2 shadow-sm">
                <div className="text-xs text-muted-foreground">Всего токенов за все время</div>
                <div className="text-2xl font-bold text-foreground">
                  {tokenStats?.totalTokens?.toLocaleString() || '0'}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Входные: {tokenStats?.inputTokens?.toLocaleString()} • Выходные: {tokenStats?.outputTokens?.toLocaleString()}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-card border border-border space-y-2 shadow-sm">
                <div className="text-xs text-muted-foreground">Оценочная стоимость (USD)</div>
                <div className="text-2xl font-bold text-status-success">
                  ${((tokenStats?.totalCostMicros || 0) / 1000000).toFixed(4)}
                </div>
                <div className="text-[11px] text-muted-foreground">Локальный Ollama тарифицируется по $0.00</div>
              </div>

              <div className="p-4 rounded-xl bg-card border border-border space-y-2 shadow-sm">
                <div className="text-xs text-muted-foreground">Дневной бюджет</div>
                <div className="text-2xl font-bold text-foreground">
                  {tokenBudget?.todayUsedTokens?.toLocaleString()} / {tokenBudget?.dailyLimitTokens?.toLocaleString()}
                </div>
                <div className={`text-[11px] font-semibold ${tokenBudget?.isBudgetExceeded ? 'text-status-error' : 'text-status-success'}`}>
                  {tokenBudget?.isBudgetExceeded ? 'Лимит превышен!' : 'В пределах нормы'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: ADD SOURCE */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 space-y-4 shadow-2xl text-card-foreground">
            <h2 className="text-sm font-semibold text-foreground">Подключение источника знаний</h2>
            <form onSubmit={handleCreateSource} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1">Название источника</label>
                <input
                  type="text"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  placeholder="Например: Документация проекта Titan"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  required
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Тип источника</label>
                <select
                  value={newSourceType}
                  onChange={(e) => setNewSourceType(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="directory">Локальная директория (TXT, MD, PDF, JSON, CSV)</option>
                  <option value="file">Одиночный файл</option>
                  <option value="git">Локальный Git-репозиторий</option>
                  <option value="user_note">Пользовательские заметки</option>
                </select>
              </div>

              {newSourceType !== 'user_note' && (
                <div>
                  <label className="block text-muted-foreground mb-1">Путь к файлу или папке</label>
                  <input
                    type="text"
                    value={newSourcePath}
                    onChange={(e) => setNewSourcePath(e.target.value)}
                    placeholder="./data/storage/docs"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Секреты (.env, *.key, node_modules) автоматически исключаются из индекса.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-semibold shadow-sm transition-opacity"
                >
                  Создать и сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
