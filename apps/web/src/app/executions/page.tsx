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
  Sparkles,
  Shield,
  Lightbulb,
} from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { api } from '@/lib/api-client';

export default function ExecutionsPage() {
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [isDebugLoading, setIsDebugLoading] = useState(false);
  const [debugAnalysis, setDebugAnalysis] = useState<any | null>(null);
  const [debugError, setDebugError] = useState<string | null>(null);

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

  const handleDebugExecution = async (id: string) => {
    setIsDebugLoading(true);
    setDebugError(null);
    setDebugAnalysis(null);
    try {
      const res = await api.debugExecution({ executionId: id });
      setDebugAnalysis(res);
    } catch (err: any) {
      setDebugError(err.message || 'Ошибка запуска AI отладчика');
    } finally {
      setIsDebugLoading(false);
    }
  };

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

                    {/* Блок ошибки и AI Debugger */}
                    {(details.error || details.status === 'failed') && (
                      <div className="space-y-2.5">
                        {details.error && (
                          <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30">
                            <div className="text-xs font-semibold text-rose-400 mb-1">Ошибка выполнения:</div>
                            <pre className="text-[11px] font-mono text-rose-300 whitespace-pre-wrap">
                              {details.error}
                            </pre>
                          </div>
                        )}

                        {/* Кнопка запуска AI Debugger */}
                        <button
                          onClick={() => handleDebugExecution(details.id)}
                          disabled={isDebugLoading}
                          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {isDebugLoading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                              <span>Анализирую причину сбоя...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                              <span>Объяснить ошибку с помощью AI</span>
                            </>
                          )}
                        </button>

                        {/* Ошибка работы дебаггера */}
                        {debugError && (
                          <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/30 text-[11px] text-rose-300">
                            {debugError}
                          </div>
                        )}

                        {/* Результат AI анализа */}
                        {debugAnalysis && (
                          <div className="p-3.5 rounded-xl bg-gradient-to-br from-purple-900/30 to-indigo-900/20 border border-purple-500/30 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-purple-200 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                Диагностика AI Debugger
                              </span>
                              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                                <Shield className="w-3 h-3" /> Секреты скрыты
                              </span>
                            </div>

                            {debugAnalysis.rootCause && (
                              <div>
                                <span className="text-[11px] font-medium text-slate-300 block mb-0.5">
                                  Первопричина сбоя:
                                </span>
                                <p className="text-xs text-slate-200 bg-[#12141F]/80 p-2.5 rounded-lg border border-white/5 leading-relaxed">
                                  {debugAnalysis.rootCause}
                                </p>
                              </div>
                            )}

                            {debugAnalysis.recommendations && debugAnalysis.recommendations.length > 0 && (
                              <div>
                                <span className="text-[11px] font-medium text-slate-300 block mb-1 flex items-center gap-1">
                                  <Lightbulb className="w-3 h-3 text-amber-400" /> Рекомендации по исправлению:
                                </span>
                                <ul className="space-y-1">
                                  {debugAnalysis.recommendations.map((rec: string, i: number) => (
                                    <li
                                      key={i}
                                      className="text-[11px] text-slate-300 bg-[#12141F]/60 p-2 rounded-lg border border-white/5 flex items-start gap-1.5"
                                    >
                                      <span className="text-purple-400 font-bold">•</span>
                                      <span>{rec}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {debugAnalysis.suggestedNodePatch && (
                              <div>
                                <span className="text-[11px] font-medium text-slate-300 block mb-1">
                                  Предлагаемые параметры узла:
                                </span>
                                <pre className="text-[10px] font-mono text-cyan-300 bg-[#12141F] p-2 rounded-lg border border-white/5 overflow-x-auto max-h-36">
                                  {JSON.stringify(debugAnalysis.suggestedNodePatch, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
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
