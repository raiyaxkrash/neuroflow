'use client';

import React, { useState, useEffect } from 'react';
import {
  Target,
  Play,
  Pause,
  RotateCcw,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Layers,
  FileText,
  ShieldAlert,
  Coins,
  ArrowRight,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';

interface MissionItem {
  id: string;
  title: string;
  goal: string;
  status: string;
  progressPercent: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  tokensUsed: number;
  tokenBudget: number;
  costBudget: number;
  createdAt: string;
}

interface MissionTask {
  id: string;
  taskKey: string;
  title: string;
  description: string;
  assignedAgent: string;
  dependencies: string[];
  status: string;
  retryCount: number;
  maxRetries: number;
  criteria: Array<{ id: string; description: string; expectedType: string }>;
  verificationResult?: any;
  outputData?: any;
}

export default function MissionsPage() {
  const [missions, setMissions] = useState<MissionItem[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [currentMission, setCurrentMission] = useState<any>(null);
  const [tasks, setTasks] = useState<MissionTask[]>([]);
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'dag' | 'checkpoints' | 'logs' | 'result'>('dag');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Форма новой миссии
  const [newGoal, setNewGoal] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newBudget, setNewBudget] = useState(50000);

  const fetchMissions = async () => {
    try {
      const res = await fetch('/api/missions');
      if (res.ok) {
        const data = await res.json();
        setMissions(data.missions || []);
        if (data.missions?.length > 0 && !selectedMissionId) {
          setSelectedMissionId(data.missions[0].id);
        }
      }
    } catch {
      // Игнорируем в демо/оффлайн режиме
    }
  };

  const fetchMissionDetails = async (id: string) => {
    setIsLoading(true);
    try {
      const [mRes, cpRes, logsRes] = await Promise.all([
        fetch(`/api/missions/${id}`),
        fetch(`/api/missions/${id}/checkpoints`),
        fetch(`/api/missions/${id}/logs`),
      ]);

      if (mRes.ok) {
        const data = await mRes.json();
        setCurrentMission(data.mission);
        setTasks(data.tasks || []);
      }
      if (cpRes.ok) {
        const data = await cpRes.json();
        setCheckpoints(data.checkpoints || []);
      }
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs || []);
      }
    } catch {
      // fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMissions();
  }, []);

  useEffect(() => {
    if (selectedMissionId) {
      fetchMissionDetails(selectedMissionId);
    }
  }, [selectedMissionId]);

  const handleAction = async (action: string, taskId?: string) => {
    if (!selectedMissionId) return;
    try {
      await fetch(`/api/missions/${selectedMissionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, taskId }),
      });
      fetchMissions();
      fetchMissionDetails(selectedMissionId);
    } catch {
      //
    }
  };

  const handleCreateMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.trim()) return;

    try {
      const res = await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: newGoal,
          title: newTitle || undefined,
          tokenBudget: Number(newBudget),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsCreating(false);
        setNewGoal('');
        setNewTitle('');
        await fetchMissions();
        if (data.mission?.id) {
          setSelectedMissionId(data.mission.id);
        }
      }
    } catch {
      //
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Завершена
          </span>
        );
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" /> Выполняется
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Pause className="w-3 h-3" /> На паузе
          </span>
        );
      case 'waiting_for_approval':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <ShieldAlert className="w-3 h-3" /> Ждет одобрения
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle className="w-3 h-3" /> Ошибка
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <Clock className="w-3 h-3" /> Готова
          </span>
        );
    }
  };

  const waitingApprovalTask = tasks.find((t) => t.status === 'waiting_for_approval');

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090A0F]">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#0D0F17] text-slate-200">
        {/* Шапка страницы */}
        <header className="h-16 border-b border-white/10 px-6 flex items-center justify-between shrink-0 bg-[#12141F]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
              Автономные миссии (Mission Engine)
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Phase 7
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Комплексные многоэтапные задания, планирование DAG, самокоррекция и персистентность
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition shadow-lg shadow-purple-600/20"
          >
            <Plus className="w-4 h-4" />
            Создать миссию
          </button>
        </div>
      </header>

      {/* Основной контент */}
      <div className="flex-1 flex overflow-hidden">
        {/* Левая колонка: список миссий */}
        <aside className="w-80 border-r border-white/10 bg-[#12141F]/60 flex flex-col shrink-0">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Все миссии ({missions.length})
            </span>
            <button
              onClick={fetchMissions}
              className="text-slate-400 hover:text-white transition p-1 rounded"
              title="Обновить список"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {missions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Миссий пока нет. Нажмите &quot;Создать миссию&quot; для старта первого автономного задания.
              </div>
            ) : (
              missions.map((m) => {
                const isSelected = m.id === selectedMissionId;
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMissionId(m.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition text-left ${
                      isSelected
                        ? 'bg-purple-600/15 border-purple-500/40 shadow-sm'
                        : 'bg-[#181B2B]/60 border-white/5 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h4 className="text-xs font-semibold text-white line-clamp-1">
                        {m.title}
                      </h4>
                      {getStatusBadge(m.status)}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mb-2.5">
                      {m.goal}
                    </p>

                    {/* Прогресс-бар */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Прогресс</span>
                        <span className="font-mono text-slate-200">{m.progressPercent}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-300"
                          style={{ width: `${m.progressPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-white/5">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3" /> {m.completedTasks}/{m.totalTasks} этапов
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <Coins className="w-3 h-3 text-amber-400/80" /> {m.tokensUsed} t
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Правая часть: детали выбранной миссии */}
        <main className="flex-1 flex flex-col overflow-y-auto bg-[#0D0F17]">
          {currentMission ? (
            <div className="p-6 space-y-6 max-w-6xl w-full mx-auto">
              {/* Карточка заголовка миссии */}
              <div className="p-5 rounded-2xl bg-[#12141F] border border-white/10 space-y-4 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg font-bold text-white tracking-tight">
                        {currentMission.title}
                      </h2>
                      {getStatusBadge(currentMission.status)}
                    </div>
                    <p className="text-xs text-slate-300 font-mono bg-black/30 p-2 rounded-lg border border-white/5">
                      <span className="text-purple-400 font-semibold">Цель: </span>
                      {currentMission.goal}
                    </p>
                  </div>

                  {/* Кнопки управления */}
                  <div className="flex items-center gap-2">
                    {currentMission.status === 'ready' && (
                      <button
                        onClick={() => handleAction('start')}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition"
                      >
                        <Play className="w-3.5 h-3.5" /> Запустить миссию
                      </button>
                    )}
                    {currentMission.status === 'running' && (
                      <button
                        onClick={() => handleAction('pause')}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md shadow-amber-600/30 transition"
                      >
                        <Pause className="w-3.5 h-3.5" /> Приостановить
                      </button>
                    )}
                    {currentMission.status === 'paused' && (
                      <button
                        onClick={() => handleAction('resume')}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Продолжить
                      </button>
                    )}
                    {(currentMission.status === 'running' || currentMission.status === 'paused') && (
                      <button
                        onClick={() => handleAction('cancel')}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-white/10 text-xs transition"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Отменить
                      </button>
                    )}
                  </div>
                </div>

                {/* Баннер Human Approval, если задача ждет одобрения */}
                {waitingApprovalTask && (
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-4 animate-pulse">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                      <div>
                        <h4 className="text-xs font-semibold text-rose-200">
                          Требуется подтверждение владельца (Human-in-the-Loop)
                        </h4>
                        <p className="text-[11px] text-rose-300/80">
                          Этап &quot;{waitingApprovalTask.title}&quot; содержит чувствительное действие и ожидает вашего решения.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAction('approve', waitingApprovalTask.id)}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition shrink-0"
                    >
                      Подтвердить и продолжить
                    </button>
                  </div>
                )}

                {/* Метрики */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Всего этапов</span>
                    <span className="text-sm font-bold text-white font-mono">{tasks.length}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Выполнено</span>
                    <span className="text-sm font-bold text-emerald-400 font-mono">
                      {tasks.filter((t) => t.status === 'completed').length}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Бюджет токенов</span>
                    <span className="text-sm font-bold text-amber-400 font-mono">
                      {currentMission.tokensUsed} / {currentMission.tokenBudget}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Чекпоинтов</span>
                    <span className="text-sm font-bold text-indigo-400 font-mono">
                      {checkpoints.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Навигация по вкладкам */}
              <div className="flex border-b border-white/10 gap-6 text-xs font-medium">
                <button
                  onClick={() => setActiveTab('dag')}
                  className={`pb-3 transition flex items-center gap-2 ${
                    activeTab === 'dag'
                      ? 'border-b-2 border-purple-500 text-purple-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" /> Граф и этапы DAG
                </button>
                <button
                  onClick={() => setActiveTab('checkpoints')}
                  className={`pb-3 transition flex items-center gap-2 ${
                    activeTab === 'checkpoints'
                      ? 'border-b-2 border-purple-500 text-purple-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" /> Точки сохранения ({checkpoints.length})
                </button>
                <button
                  onClick={() => setActiveTab('logs')}
                  className={`pb-3 transition flex items-center gap-2 ${
                    activeTab === 'logs'
                      ? 'border-b-2 border-purple-500 text-purple-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" /> Журнал логов ({logs.length})
                </button>
                <button
                  onClick={() => setActiveTab('result')}
                  className={`pb-3 transition flex items-center gap-2 ${
                    activeTab === 'result'
                      ? 'border-b-2 border-purple-500 text-purple-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" /> Итог и Second Brain
                </button>
              </div>

              {/* Содержимое вкладки: Этапы и граф DAG */}
              {activeTab === 'dag' && (
                <div className="space-y-4">
                  {tasks.map((task, idx) => (
                    <div
                      key={task.id}
                      className="p-4 rounded-xl bg-[#12141F] border border-white/10 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-mono text-purple-300">
                            {idx + 1}
                          </span>
                          <div>
                            <h4 className="text-xs font-semibold text-white">
                              {task.title}
                            </h4>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Ключ: {task.taskKey} | Агент: {task.assignedAgent}
                            </span>
                          </div>
                        </div>
                        {getStatusBadge(task.status)}
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {task.description}
                      </p>

                      {/* Зависимости */}
                      {task.dependencies && task.dependencies.length > 0 && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <ArrowRight className="w-3 h-3 text-purple-400" />
                          <span>Зависит от:</span>
                          {task.dependencies.map((dep) => (
                            <span
                              key={dep}
                              className="px-1.5 py-0.5 rounded bg-black/40 text-purple-300 font-mono text-[10px] border border-white/5"
                            >
                              {dep}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Критерии готовности (ResultVerifier) */}
                      {task.criteria && task.criteria.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-black/20 border border-white/5 space-y-1">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                            Критерии верификации ({task.criteria.length}):
                          </span>
                          {task.criteria.map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center gap-2 text-[11px] text-slate-300"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-400/80 shrink-0" />
                              <span>{c.description}</span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                ({c.expectedType})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Выходные данные / Артефакт */}
                      {task.outputData && (
                        <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1 font-mono text-[11px] text-slate-300 overflow-x-auto">
                          <span className="text-[10px] font-semibold text-purple-300 uppercase tracking-wider font-sans block">
                            Результат этапа:
                          </span>
                          <pre>{JSON.stringify(task.outputData, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Содержимое вкладки: Чекпоинты */}
              {activeTab === 'checkpoints' && (
                <div className="space-y-3">
                  {checkpoints.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      Чекпоинтов пока нет
                    </div>
                  ) : (
                    checkpoints.map((cp, idx) => (
                      <div
                        key={cp.id}
                        className="p-3.5 rounded-xl bg-[#12141F] border border-white/10 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                            <Clock className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-white block">
                              Чекпоинт #{checkpoints.length - idx}: {cp.checkpointType}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ID: {cp.id} | {new Date(cp.createdAt).toLocaleString('ru-RU')}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10">
                          {cp.stateSnapshot?.tasks?.length || 0} задач в снимке
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Содержимое вкладки: Логи */}
              {activeTab === 'logs' && (
                <div className="p-4 rounded-xl bg-black/40 border border-white/10 font-mono text-xs space-y-2 max-h-[500px] overflow-y-auto">
                  {logs.length === 0 ? (
                    <div className="text-slate-500 text-center py-4 font-sans">
                      Логи отсутствуют
                    </div>
                  ) : (
                    logs.map((log) => {
                      const levelColor =
                        log.level === 'error'
                          ? 'text-red-400'
                          : log.level === 'warn'
                          ? 'text-amber-400'
                          : 'text-slate-300';
                      return (
                        <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                          <span className="text-slate-500 text-[10px]">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </span>
                          <span className={`uppercase font-bold text-[10px] ${levelColor}`}>
                            [{log.level}]
                          </span>
                          <span className={levelColor}>{log.message}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Содержимое вкладки: Итог и Second Brain */}
              {activeTab === 'result' && (
                <div className="p-5 rounded-2xl bg-[#12141F] border border-white/10 space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-semibold text-white">
                      Финальный результат миссии
                    </h3>
                  </div>

                  {currentMission.finalResult ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-black/30 border border-white/5 text-xs text-slate-200 leading-relaxed">
                        {currentMission.finalResult.summary}
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-slate-300 mb-2">
                          Сохраненные артефакты:
                        </h4>
                        <pre className="p-3 rounded-xl bg-black/40 border border-white/5 font-mono text-[11px] text-slate-300 overflow-x-auto">
                          {JSON.stringify(currentMission.finalResult.artifacts, null, 2)}
                        </pre>
                      </div>

                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Результат миссии синхронизирован с долговременной памятью Second Brain.</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-500">
                      Миссия еще не завершена. Итоговый отчет появится после выполнения всех этапов.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <Target className="w-12 h-12 text-slate-600 mb-3" />
              <h3 className="text-sm font-semibold text-white mb-1">
                Выберите миссию из списка или создайте новую
              </h3>
              <p className="text-xs text-slate-400 max-w-sm">
                NeuroFlow автоматически разобьет сложную цель на ориентированный ациклический граф (DAG) подзадач и выполнит их с независимой проверкой результатов.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Модальное окно создания миссии */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12141F] border border-white/15 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-400" /> Новая автономная миссия
              </h3>
              <button
                onClick={() => setIsCreating(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMission} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Цель миссии на естественном языке *
                </label>
                <textarea
                  required
                  rows={4}
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  placeholder="Опишите задачу (например: Исследовать конкурентов в нише AI workflow, собрать сводную таблицу функций и сформировать отчет)..."
                  className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500 transition resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Название миссии (опционально)
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Анализ конкурентов 2026"
                  className="w-full p-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500 transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Бюджет токенов
                </label>
                <input
                  type="number"
                  min={1000}
                  step={5000}
                  value={newBudget}
                  onChange={(e) => setNewBudget(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500 transition font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md transition"
                >
                  Спланировать и создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
