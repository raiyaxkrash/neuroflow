'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  Loader2,
  X,
  FileCode,
} from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { api } from '@/lib/api-client';

export default function ExecutionsPage() {
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['executions'],
    queryFn: () => api.getExecutions(),
  });

  const { data: details, isLoading: isDetailsLoading } = useQuery({
    queryKey: ['execution-details', selectedExecutionId],
    queryFn: () => api.getExecution(selectedExecutionId!),
    enabled: !!selectedExecutionId,
  });

  const executionsList = data?.executions || [];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090A0F]">
      <Sidebar />

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 border-b border-white/10 px-8 flex items-center justify-between shrink-0 bg-[#0D0E15]">
          <div>
            <h1 className="text-lg font-semibold text-white tracking-tight">История запусков</h1>
            <p className="text-xs text-slate-400">
              Мониторинг, логирование и аудит выполненных автоматизаций
            </p>
          </div>
          <div className="text-xs text-slate-400">
            Всего записей: <span className="font-semibold text-slate-200">{executionsList.length}</span>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Таблица / Список запусков */}
          <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full">
            {isLoading ? (
              <div className="flex items-center justify-center h-64 text-slate-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                <span className="text-sm">Загрузка истории...</span>
              </div>
            ) : executionsList.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-white/10 bg-[#12141F]/40 max-w-md mx-auto my-12">
                <Activity className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-300 mb-1">Запусков пока нет</h3>
                <p className="text-xs text-slate-500">
                  Откройте любой воркфлоу и нажмите «Запустить», чтобы увидеть процесс выполнения.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {executionsList.map((exec) => {
                  const isSuccess = exec.status === 'success';
                  const isFailed = exec.status === 'failed';
                  const isRunning = exec.status === 'running';

                  return (
                    <div
                      key={exec.id}
                      onClick={() => setSelectedExecutionId(exec.id)}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                        selectedExecutionId === exec.id
                          ? 'bg-[#181B2B] border-purple-500/50 shadow-md'
                          : 'bg-[#12141F] border-white/5 hover:border-white/10 hover:bg-[#151826]'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isSuccess
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : isFailed
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : isRunning
                              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse'
                              : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                          }`}
                        >
                          {isSuccess ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : isFailed ? (
                            <AlertCircle className="w-4 h-4" />
                          ) : isRunning ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Clock className="w-4 h-4" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                              {exec.status}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              (v{exec.workflowVersion})
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            ID: {exec.id}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right text-xs">
                          <div className="font-mono text-slate-300">
                            {exec.durationMs !== null ? `${exec.durationMs}ms` : '—'}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {new Date(exec.startedAt).toLocaleTimeString()}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Правая панель с подробностями выбранного запуска */}
          {selectedExecutionId && (
            <aside className="w-96 border-l border-white/10 bg-[#12141F] flex flex-col h-full overflow-hidden">
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <div className="font-semibold text-xs text-slate-200">Детали выполнения</div>
                <button
                  onClick={() => setSelectedExecutionId(null)}
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isDetailsLoading ? (
                  <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                    <span>Загрузка данных запуска...</span>
                  </div>
                ) : details ? (
                  <>
                    <div className="p-3 rounded-xl bg-[#181B2B] border border-white/5 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Статус:</span>
                        <span className="font-semibold capitalize text-purple-300">{details.status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Время работы:</span>
                        <span className="font-mono text-slate-200">{details.durationMs}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Тип триггера:</span>
                        <span className="text-slate-200 uppercase">{details.triggerType}</span>
                      </div>
                    </div>

                    {details.error && (
                      <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30">
                        <div className="text-xs font-semibold text-rose-400 mb-1">Ошибка:</div>
                        <pre className="text-[11px] font-mono text-rose-300 whitespace-pre-wrap">
                          {details.error}
                        </pre>
                      </div>
                    )}

                    {/* Выполненные узлы */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-300 mb-2">Шаги сценария:</h4>
                      <div className="space-y-1.5">
                        {(details.nodeExecutions || []).map((ne: any) => (
                          <div
                            key={ne.id}
                            className="p-2.5 rounded-lg bg-[#181B2B] border border-white/5 text-xs flex items-center justify-between"
                          >
                            <div>
                              <div className="font-medium text-slate-200">{ne.nodeType}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{ne.nodeId}</div>
                            </div>
                            <div className="text-right">
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                  ne.status === 'success'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : 'bg-rose-500/10 text-rose-400'
                                }`}
                              >
                                {ne.status}
                              </span>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {ne.durationMs}ms
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Итоговый результат */}
                    {details.outputPayload && (
                      <div>
                        <h4 className="text-xs font-semibold text-slate-300 mb-1.5">Финальный результат (JSON):</h4>
                        <pre className="p-3 rounded-xl bg-[#181B2B] border border-white/5 text-[11px] font-mono text-slate-200 overflow-x-auto max-h-56">
                          {JSON.stringify(details.outputPayload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
