'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Plus,
  GitFork,
  Search,
  Trash2,
  Layers,
  ArrowRight,
  Loader2,
  Sparkles,
  LayoutTemplate,
  Upload,
  Download,
  X,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { AiGeneratorModal } from '@/components/editor/ai-generator-modal';

export default function WorkflowsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [templatesList, setTemplatesList] = useState<any[]>([]);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const { data, isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => api.getWorkflows(),
  });

  const workflows = data?.workflows || [];

  // Загрузка доступных шаблонов
  useEffect(() => {
    fetch(`${API_BASE}/api/workflows/templates`)
      .then((res) => (res.ok ? res.json() : []))
      .then((list) => setTemplatesList(list))
      .catch(() => setTemplatesList([]));
  }, [API_BASE]);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const created = await api.createWorkflow({
        name: `Сценарий #${workflows.length + 1}`,
        description: 'Новый автоматизированный процесс',
      });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      router.push(`/workflows/${created.id}`);
    } catch (err: any) {
      alert(`Ошибка при создании: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleInstantiateTemplate = async (templateId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/workflows/templates/${templateId}/instantiate`, {
        method: 'POST',
      });
      if (res.ok) {
        const created = await res.json();
        setIsTemplatesOpen(false);
        queryClient.invalidateQueries({ queryKey: ['workflows'] });
        router.push(`/workflows/${created.id}`);
      } else {
        alert('Не удалось применить шаблон');
      }
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    }
  };

  const handleExport = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${API_BASE}/api/workflows/${id}/export`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.neuroflow.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      alert(`Ошибка экспорта: ${err.message}`);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const workflowData = JSON.parse(text);

      const res = await fetch(`${API_BASE}/api/workflows/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflowData),
      });

      if (res.ok) {
        const created = await res.json();
        queryClient.invalidateQueries({ queryKey: ['workflows'] });
        router.push(`/workflows/${created.id}`);
      } else {
        const err = await res.json();
        alert(`Ошибка импорта: ${err.error || 'Неверный формат'}`);
      }
    } catch (err: any) {
      alert(`Ошибка парсинга файла: ${err.message}`);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Вы действительно хотите удалить этот сценарий?')) return;

    try {
      await api.deleteWorkflow(id);
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    } catch (err: any) {
      alert(`Ошибка удаления: ${err.message}`);
    }
  };

  const filtered = workflows.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Page Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Визуальный движок · DAG Editor
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Сценарии автоматизации
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Создавайте, визуализируйте и запускайте рабочие процессы на React Flow с поддержкой AI-агентов.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsTemplatesOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card hover:bg-muted text-foreground border border-border text-xs font-medium transition-colors shadow-sm"
          >
            <LayoutTemplate className="w-3.5 h-3.5 text-primary" />
            <span>Шаблоны</span>
          </button>

          <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card hover:bg-muted text-foreground border border-border text-xs font-medium transition-colors shadow-sm cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-status-success" />
            <span>Импорт</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportFile}
            />
          </label>

          <button
            onClick={() => setIsAiModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-secondary hover:opacity-90 text-foreground border border-border text-xs font-medium transition-opacity shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Создать с AI</span>
          </button>

          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold shadow-sm transition-opacity disabled:opacity-50"
          >
            {isCreating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            <span>Создать сценарий</span>
          </button>
        </div>
      </div>

      {/* Поисковая панель и счетчик */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Поиск по сценариям..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card text-xs text-foreground placeholder:text-muted-foreground pl-9 pr-4 py-2 rounded-lg border border-border focus:ring-1 focus:ring-ring outline-none transition-colors shadow-sm"
          />
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          Всего сценариев: <span className="font-semibold text-foreground">{workflows.length}</span>
        </div>
      </div>

      {/* Сетка карточек воркфлоу */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm">Загрузка сценариев...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border border-dashed border-border rounded-xl p-8 text-center bg-card">
          <GitFork className="w-8 h-8 text-muted-foreground/40 mb-3" />
          <h3 className="text-sm font-semibold text-foreground">Сценарии не найдены</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {search
              ? 'Попробуйте изменить поисковый запрос'
              : 'Создайте свой первый рабочий процесс или выберите готовый шаблон'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((wf) => {
            const nodeCount = wf.graph?.nodes?.length || 0;
            return (
              <div
                key={wf.id}
                onClick={() => router.push(`/workflows/${wf.id}`)}
                className="group flex flex-col justify-between p-5 rounded-xl bg-card hover:bg-muted/20 border border-border hover:border-highlight/70 transition-all cursor-pointer shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                      v{wf.version}
                    </span>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleExport(wf.id, wf.name, e)}
                        title="Экспортировать JSON"
                        className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(wf.id, e)}
                        title="Удалить"
                        className="p-1 rounded-md hover:bg-status-error-bg text-muted-foreground hover:text-status-error transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors mb-1.5">
                    {wf.name}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                    {wf.description || 'Без описания'}
                  </p>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    <span>{nodeCount} блоков</span>
                  </div>
                  <div className="flex items-center gap-1 text-primary group-hover:translate-x-0.5 transition-transform font-medium">
                    <span>Открыть</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Модальное окно готовых шаблонов */}
      {isTemplatesOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-6 max-h-[85vh] flex flex-col text-card-foreground">
            <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <LayoutTemplate className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  Библиотека готовых шаблонов
                </h3>
              </div>
              <button
                onClick={() => setIsTemplatesOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {templatesList.map((tpl) => (
                <div
                  key={tpl.id}
                  className="p-4 rounded-xl border border-border bg-muted/40 flex items-center justify-between hover:border-highlight/50 transition-colors"
                >
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-foreground">{tpl.name}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border font-mono">
                        {tpl.category}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{tpl.description}</p>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1 font-mono">
                      <span>Требует credentials:</span>
                      <span className="text-foreground">{tpl.requiredCredentials.join(', ')}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleInstantiateTemplate(tpl.id)}
                    className="px-4 py-2 rounded-xl bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold shadow-sm transition-opacity shrink-0"
                  >
                    Использовать
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно создания сценария с AI */}
      <AiGeneratorModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onCreateWorkflow={(created) => {
          queryClient.invalidateQueries({ queryKey: ['workflows'] });
          router.push(`/workflows/${created.id}`);
        }}
      />
    </div>
  );
}
