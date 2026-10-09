'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  GitFork,
  Activity,
  CheckCircle2,
  Clock,
  Cpu,
  ArrowUpRight,
  Plus,
  Play,
  Bot,
  Brain,
  ShieldCheck,
  Sparkles,
  Server,
  Layers,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api-client';

export default function OverviewPage() {
  const [taskFilter, setTaskFilter] = useState<'all' | 'running' | 'success' | 'failed'>('all');

  const { data: workflowsData, isLoading: isWorkflowsLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => api.getWorkflows(),
  });

  const { data: executionsData, isLoading: isExecsLoading } = useQuery({
    queryKey: ['executions'],
    queryFn: () => api.getExecutions(),
  });

  const { data: missionsData } = useQuery({
    queryKey: ['missions'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/missions');
        if (!res.ok) return { missions: [] };
        return await res.json();
      } catch {
        return { missions: [] };
      }
    },
  });

  const workflows = workflowsData?.workflows || [];
  const executions = executionsData?.executions || [];
  const missions = missionsData?.missions || [];

  const runningExecs = executions.filter((e) => e.status === 'running');
  const successExecs = executions.filter((e) => e.status === 'success');
  const failedExecs = executions.filter((e) => e.status === 'failed');

  const successRate = executions.length > 0
    ? Math.round((successExecs.length / executions.length) * 100)
    : 100;

  const filteredExecutions = executions.filter((e) => {
    if (taskFilter === 'running') return e.status === 'running';
    if (taskFilter === 'success') return e.status === 'success';
    if (taskFilter === 'failed') return e.status === 'failed';
    return true;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Page Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Персональная система · Workspace
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Обзор системы
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Мониторинг локальных агентов, очереди выполнения сценариев и состояния инфраструктуры.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/workflows"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-medium transition-colors shadow-sm"
          >
            <GitFork className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Сценарии</span>
          </Link>
          <Link
            href="/missions"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-xs font-semibold transition-opacity shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Новая миссия</span>
          </Link>
        </div>
      </div>

      {/* 4 Ключевые метрики (Metric Strip) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border space-y-1.5 shadow-sm transition-colors">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Активных агентов</span>
            <Bot className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {missions.length > 0 ? missions.length : '4'}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Локальные процессы готовы</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border space-y-1.5 shadow-sm transition-colors">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Сценариев в системе</span>
            <GitFork className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {isWorkflowsLoading ? '—' : workflows.length}
          </div>
          <div className="text-[11px] text-muted-foreground">
            DAG воркфлоу с React Flow
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border space-y-1.5 shadow-sm transition-colors">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Всего запусков</span>
            <Activity className="w-4 h-4 text-highlight" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {isExecsLoading ? '—' : executions.length}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {runningExecs.length > 0 ? `${runningExecs.length} выполняются сейчас` : 'Очередь свободна'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border space-y-1.5 shadow-sm transition-colors">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Успешность (Success Rate)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {successRate}%
          </div>
          <div className="text-[11px] text-muted-foreground">
            {failedExecs.length === 0 ? 'Без системных сбоев' : `${failedExecs.length} завершились ошибкой`}
          </div>
        </div>
      </div>

      {/* Основная сетка: Таблица очереди (2fr) + Инспектор и Агенты (1fr) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Левая колонка: Очередь задач и запусков */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl bg-card border border-border overflow-hidden shadow-sm">
            {/* Заголовок карточки с табами фильтрации */}
            <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Очередь и история запусков</h2>
                <p className="text-[11px] text-muted-foreground">
                  Последние выполненные и текущие процессы в ядре NeuroFlow
                </p>
              </div>

              {/* Табы */}
              <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-lg border border-border/60 text-xs">
                <button
                  onClick={() => setTaskFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    taskFilter === 'all'
                      ? 'bg-card text-foreground font-medium shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Все ({executions.length})
                </button>
                <button
                  onClick={() => setTaskFilter('running')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    taskFilter === 'running'
                      ? 'bg-card text-foreground font-medium shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  В работе ({runningExecs.length})
                </button>
                <button
                  onClick={() => setTaskFilter('success')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    taskFilter === 'success'
                      ? 'bg-card text-foreground font-medium shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Успешные ({successExecs.length})
                </button>
                <button
                  onClick={() => setTaskFilter('failed')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    taskFilter === 'failed'
                      ? 'bg-card text-foreground font-medium shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Ошибки ({failedExecs.length})
                </button>
              </div>
            </div>

            {/* Список задач */}
            <div className="divide-y divide-border">
              {filteredExecutions.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <Activity className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                  <p className="text-xs text-muted-foreground font-medium">
                    Нет запусков, соответствующих выбранному фильтру
                  </p>
                  <Link
                    href="/workflows"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline pt-1"
                  >
                    <span>Запустить сценарий в редакторе</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ) : (
                filteredExecutions.slice(0, 7).map((exec) => {
                  const wf = workflows.find((w) => w.id === exec.workflowId);
                  const isSuccess = exec.status === 'success';
                  const isRunning = exec.status === 'running';
                  const isFailed = exec.status === 'failed';

                  return (
                    <div
                      key={exec.id}
                      className="p-3.5 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isSuccess
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : isRunning
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse'
                              : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                          }`}
                        >
                          {isSuccess ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : isRunning ? (
                            <Clock className="w-3.5 h-3.5" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-foreground truncate">
                            {wf?.name || `Воркфлоу #${exec.workflowId.slice(0, 8)}`}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-2">
                            <span>ID: {exec.id.slice(0, 8)}</span>
                            <span>·</span>
                            <span>
                              {new Date(exec.startedAt).toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase tracking-wider font-semibold ${
                            isSuccess
                              ? 'bg-status-success-bg text-status-success border-status-success-border'
                              : isRunning
                              ? 'bg-status-warning-bg text-status-warning border-status-warning-border'
                              : 'bg-status-error-bg text-status-error border-status-error-border'
                          }`}
                        >
                          {exec.status}
                        </span>
                        <Link
                          href="/executions"
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                          title="Подробнее в журнале выполнений"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 bg-muted/20 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground text-[11px]">
                Показано {Math.min(filteredExecutions.length, 7)} из {filteredExecutions.length}
              </span>
              <Link
                href="/executions"
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
              >
                <span>Полный журнал выполнений</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Правая колонка: Ростер локальных агентов и RAG */}
        <div className="space-y-6">
          {/* Ростер агентов */}
          <div className="rounded-xl bg-card border border-border p-4 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-semibold text-foreground">Ростер агентов</h3>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                Self-Hosted
              </span>
            </div>

            <div className="space-y-2.5">
              {[
                { name: 'Mission Orchestrator', role: 'Координация ReAct & DAG', status: 'online', model: 'claude-3-5-sonnet' },
                { name: 'Browser Agent', role: 'Playwright & автоматизация веб', status: 'online', model: 'gpt-4o' },
                { name: 'Second Brain RAG', role: 'Векторный поиск & память', status: 'online', model: 'text-embedding-3' },
                { name: 'Code Synthesizer', role: 'Генерация узлов & скриптов', status: 'idle', model: 'claude-3-5-sonnet' },
              ].map((agent) => (
                <div
                  key={agent.name}
                  className="p-2.5 rounded-lg bg-muted/40 border border-border/60 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{agent.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{agent.role}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {agent.status}
                    </span>
                    <div className="text-[9px] font-mono text-muted-foreground">{agent.model}</div>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/missions"
              className="block w-full py-2 text-center text-xs font-medium text-primary hover:bg-muted/50 rounded-lg border border-border transition-colors"
            >
              Управление миссиями и агентами →
            </Link>
          </div>

          {/* Интеграция со Вторым мозгом (Second Brain) */}
          <div className="rounded-xl bg-card border border-border p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-highlight" />
                <h3 className="text-xs font-semibold text-foreground">Второй мозг (RAG)</h3>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">Гибридный поиск</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Локальная база знаний с векторными эмбеддингами и графом знаний для автономного принятия решений агентами.
            </p>
            <Link
              href="/knowledge"
              className="flex items-center justify-between p-2.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
            >
              <span>Открыть базу знаний</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
