'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  GitFork,
  Activity,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { api } from '@/lib/api-client';

export default function OverviewPage() {
  const { data: workflowsData } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => api.getWorkflows(),
  });

  const { data: executionsData } = useQuery({
    queryKey: ['executions'],
    queryFn: () => api.getExecutions(),
  });

  const workflows = workflowsData?.workflows || [];
  const executions = executionsData?.executions || [];
  const successExecs = executions.filter((e) => e.status === 'success');
  const successRate = executions.length > 0 ? Math.round((successExecs.length / executions.length) * 100) : 100;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090A0F]">
      <Sidebar />

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 border-b border-white/10 px-8 flex items-center justify-between shrink-0 bg-[#0D0E15]">
          <div>
            <h1 className="text-lg font-semibold text-white tracking-tight">Панель управления</h1>
            <p className="text-xs text-slate-400">
              Сводка состояния платформы NeuroFlow и метрики производительности
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 max-w-6xl mx-auto w-full space-y-6">
          {/* Ключевые метрики */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-[#12141F] border border-white/5 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Активных сценариев</span>
                <GitFork className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-white">{workflows.length}</div>
              <div className="text-[11px] text-slate-500">Готовы к выполнению</div>
            </div>

            <div className="p-5 rounded-2xl bg-[#12141F] border border-white/5 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Всего запусков</span>
                <Activity className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-white">{executions.length}</div>
              <div className="text-[11px] text-slate-500">Зафиксировано в БД</div>
            </div>

            <div className="p-5 rounded-2xl bg-[#12141F] border border-white/5 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Успешность (Success Rate)</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400">{successRate}%</div>
              <div className="text-[11px] text-slate-500">Стабильность работы</div>
            </div>

            <div className="p-5 rounded-2xl bg-[#12141F] border border-white/5 space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Архитектура</span>
                <Cpu className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-sm font-semibold text-white pt-1">Node.js + PostgreSQL</div>
              <div className="text-[11px] text-slate-500">Self-Hosted Engine</div>
            </div>
          </div>

          {/* Быстрые действия */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-900/20 via-[#12141F] to-indigo-900/20 border border-purple-500/20 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white">Создайте свой первый визуальный процесс</h3>
              <p className="text-xs text-slate-400">
                Используйте холст с поддержкой Manual Trigger, HTTP Request, Condition ветвления и трансформации данных.
              </p>
            </div>
            <Link
              href="/workflows"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all shrink-0"
            >
              <span>Перейти в редактор</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
