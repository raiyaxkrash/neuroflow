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
import { Sidebar } from '@/components/layout/sidebar';
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
        name: `New Workflow #${workflows.length + 1}`,
        description: 'Новый автоматизированный сценарий',
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
      const parsed = JSON.parse(text);
      const res = await fetch(`${API_BASE}/api/workflows/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      if (res.ok) {
        const imported = await res.json();
        queryClient.invalidateQueries({ queryKey: ['workflows'] });
        router.push(`/workflows/${imported.id}`);
      } else {
        const err = await res.json();
        alert(`Ошибка импорта: ${err.error || 'Неверный формат'}`);
      }
    } catch (err: any) {
      alert(`Ошибка парсинга JSON: ${err.message}`);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Вы уверены, что хотите удалить этот воркфлоу?')) return;
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
    <div className="flex h-screen w-screen overflow-hidden bg-[#090A0F]">
      <Sidebar />

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-white/10 px-8 flex items-center justify-between shrink-0 bg-[#0D0E15]">
          <div>
            <h1 className="text-lg font-semibold text-white tracking-tight">
              Сценарии автоматизации
            </h1>
            <p className="text-xs text-slate-400">
              Создавайте, визуализируйте и запускайте рабочие процессы
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsTemplatesOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#12141F] hover:bg-white/5 text-slate-300 border border-white/10 text-xs font-semibold transition-all cursor-pointer"
            >
              <LayoutTemplate className="w-4 h-4 text-purple-400" />
              <span>Шаблоны</span>
            </button>

            <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#12141F] hover:bg-white/5 text-slate-300 border border-white/10 text-xs font-semibold transition-all cursor-pointer">
              <Upload className="w-4 h-4 text-emerald-400" />
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
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold shadow-lg shadow-purple-500/10 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Создать с AI</span>
            </button>

            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/25 transition-all cursor-pointer disabled:opacity-50"
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>Создать сценарий</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 max-w-6xl w-full mx-auto">
          {/* Search bar */}
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Поиск по сценариям..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#12141F] text-xs text-slate-200 pl-9 pr-4 py-2 rounded-xl border border-white/10 focus:border-purple-500/50 outline-none transition-colors"
              />
            </div>
            <div className="text-xs text-slate-400">
              Всего сценариев: <span className="font-semibold text-slate-200">{workflows.length}</span>
            </div>
          </div>

          {/* Workflow List */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
              <span className="text-sm">Загрузка сценариев...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border border-dashed border-white/10 rounded-2xl p-8 text-center bg-[#12141F]/30">
              <GitFork className="w-8 h-8 text-slate-600 mb-3" />
              <h3 className="text-sm font-medium text-slate-300">Сценарии не найдены</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
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
                    className="group flex flex-col justify-between p-5 rounded-2xl bg-[#12141F] hover:bg-[#151826] border border-white/5 hover:border-purple-500/30 transition-all cursor-pointer hover:shadow-xl hover:shadow-purple-500/5"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          v{wf.version}
                        </span>
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={(e) => handleExport(wf.id, wf.name, e)}
                            title="Экспортировать JSON"
                            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-100 transition-all"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(wf.id, e)}
                            title="Удалить"
                            className="p-1 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-sm font-semibold text-slate-100 group-hover:text-purple-300 transition-colors mb-1.5">
                        {wf.name}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                        {wf.description || 'Без описания'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5" />
                          <span>{nodeCount} блоков</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-purple-400 group-hover:translate-x-1 transition-transform">
                        <span>Открыть</span>
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Модальное окно готовых шаблонов */}
      {isTemplatesOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-[#12141F] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <LayoutTemplate className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">
                  Библиотека готовых шаблонов
                </h3>
              </div>
              <button
                onClick={() => setIsTemplatesOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {templatesList.map((tpl) => (
                <div
                  key={tpl.id}
                  className="p-4 rounded-xl border border-white/10 bg-[#181B2B] flex items-center justify-between hover:border-purple-500/40 transition-all"
                >
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{tpl.name}</h4>
                      <span className="text-2xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
                        {tpl.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{tpl.description}</p>
                    <div className="text-2xs text-slate-500 flex items-center gap-1 pt-1">
                      <span>Требует credentials:</span>
                      <span className="font-mono text-slate-400">{tpl.requiredCredentials.join(', ')}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleInstantiateTemplate(tpl.id)}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-600/20 transition-all shrink-0 cursor-pointer"
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
