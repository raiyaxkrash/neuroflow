'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Plus,
  GitFork,
  Search,
  Trash2,
  Calendar,
  Layers,
  ArrowRight,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { api } from '@/lib/api-client';

export default function WorkflowsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => api.getWorkflows(),
  });

  const workflows = data?.workflows || [];

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
              Создавайте, визуализируйте и запускайте распределенные рабочие процессы
            </p>
          </div>

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
            <div className="p-12 text-center rounded-2xl border border-white/10 bg-[#12141F]/40 max-w-md mx-auto my-12">
              <div className="w-12 h-12 rounded-2xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-4 text-purple-400">
                <GitFork className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">
                {search ? 'Ничего не найдено' : 'Пока нет сценариев'}
              </h3>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                {search
                  ? 'Попробуйте изменить поисковый запрос'
                  : 'Создайте ваш первый визуальный сценарий автоматизации с ручным запуском, условиями и запросами.'}
              </p>
              {!search && (
                <button
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Создать первый workflow</span>
                </button>
              )}
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
                        <button
                          onClick={(e) => handleDelete(wf.id, e)}
                          title="Удалить"
                          className="p-1 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
    </div>
  );
}
