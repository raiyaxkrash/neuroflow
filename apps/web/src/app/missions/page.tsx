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

const DEFAULT_DEMO_MISSIONS: MissionItem[] = [
  {
    id: 'mission-demo-1',
    title: 'Автономный аудит и исследование AI-агентов 2026',
    goal: 'Провести исследование архитектурных паттернов многоагентных систем, протестировать MCP серверы и сгенерировать аналитический отчет',
    status: 'completed',
    progressPercent: 100,
    totalTasks: 3,
    completedTasks: 3,
    failedTasks: 0,
    tokensUsed: 14250,
    tokenBudget: 50000,
    costBudget: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'mission-demo-2',
    title: 'Синхронизация протокола Model Context Protocol',
    goal: 'Мониторинг обновлений спецификаций MCP, проверка валидности JSON-RPC схем и автогенерация TypeScript адаптеров',
    status: 'ready',
    progressPercent: 0,
    totalTasks: 3,
    completedTasks: 0,
    failedTasks: 0,
    tokensUsed: 0,
    tokenBudget: 35000,
    costBudget: 0,
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_DEMO_TASKS: MissionTask[] = [
  {
    id: 'task-1',
    taskKey: 'step_1_gather_context',
    title: 'Сбор контекста и исследование требований',
    description: 'Анализ спецификаций MCP, выявление инструментов и начальных условий многоагентной оркестрации.',
    assignedAgent: 'Web Researcher',
    dependencies: [],
    status: 'completed',
    retryCount: 0,
    maxRetries: 3,
    criteria: [
      { id: 'c1', description: 'Контекст и исходные данные успешно собраны и зафиксированы', expectedType: 'non_empty_string' },
    ],
    outputData: {
      content: 'Спецификации и актуальные паттерны многоагентных систем успешно собраны. Обнаружено 12 ключевых сценариев.',
      sourcesCount: 5,
    },
  },
  {
    id: 'task-2',
    taskKey: 'step_2_core_execution',
    title: 'Выполнение основного сценария и извлечение данных',
    description: 'Тестирование ReAct циклов, валидация tool call вызовов и замер задержек взаимодействия агентов.',
    assignedAgent: 'Code Specialist',
    dependencies: ['step_1_gather_context'],
    status: 'completed',
    retryCount: 0,
    maxRetries: 3,
    criteria: [
      { id: 'c2', description: 'Целевое действие выполнено без критических ошибок', expectedType: 'custom' },
    ],
    outputData: {
      benchmarks: { latencyMs: 240, accuracyPercent: 99.4, toolCallSuccess: true },
      status: 'success',
    },
  },
  {
    id: 'task-3',
    taskKey: 'step_3_verification_and_reporting',
    title: 'Верификация результатов и формирование артефакта',
    description: 'Независимая проверка критериев готовности ResultVerifier и экспорт финального отчета в Second Brain.',
    assignedAgent: 'Report Writer',
    dependencies: ['step_2_core_execution'],
    status: 'completed',
    retryCount: 0,
    maxRetries: 2,
    criteria: [
      { id: 'c3', description: 'Финальный отчет и структурированный результат сформированы', expectedType: 'non_empty_string' },
    ],
    outputData: {
      summary: 'Аналитический отчет подготовлен и сохранен в базе знаний Second Brain.',
      status: 'completed',
    },
  },
];

const DEFAULT_DEMO_CHECKPOINTS = [
  {
    id: 'cp-3',
    checkpointType: 'task_completed',
    createdAt: new Date().toISOString(),
    stateSnapshot: { tasks: [1, 2, 3] },
  },
  {
    id: 'cp-2',
    checkpointType: 'task_completed',
    createdAt: new Date(Date.now() - 60000).toISOString(),
    stateSnapshot: { tasks: [1, 2] },
  },
  {
    id: 'cp-1',
    checkpointType: 'manual_pause',
    createdAt: new Date(Date.now() - 120000).toISOString(),
    stateSnapshot: { tasks: [1] },
  },
];

const DEFAULT_DEMO_LOGS = [
  { id: 'log-4', level: 'info', message: 'Миссия успешно выполнена. Итоговый отчет сохранен в Second Brain.', createdAt: new Date().toISOString() },
  { id: 'log-3', level: 'info', message: 'Задача "Верификация результатов": все критерии готовности подтверждены.', createdAt: new Date(Date.now() - 30000).toISOString() },
  { id: 'log-2', level: 'info', message: 'Задача "Выполнение основного сценария" завершена (токены: 420).', createdAt: new Date(Date.now() - 60000).toISOString() },
  { id: 'log-1', level: 'info', message: 'Миссия переведена в статус выполнения.', createdAt: new Date(Date.now() - 120000).toISOString() },
];

export default function MissionsPage() {
  const [missions, setMissions] = useState<MissionItem[]>(DEFAULT_DEMO_MISSIONS);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>('mission-demo-1');
  const [currentMission, setCurrentMission] = useState<any>({
    ...DEFAULT_DEMO_MISSIONS[0],
    finalResult: {
      summary: 'Миссия успешно выполнена. Все 3 подзадачи завершены и верифицированы.',
      artifacts: {
        research: 'Спецификации и архитектурные тренды собраны',
        benchmarks: { latencyMs: 240, accuracyPercent: 99.4 },
      },
    },
  });
  const [tasks, setTasks] = useState<MissionTask[]>(DEFAULT_DEMO_TASKS);
  const [checkpoints, setCheckpoints] = useState<any[]>(DEFAULT_DEMO_CHECKPOINTS);
  const [logs, setLogs] = useState<any[]>(DEFAULT_DEMO_LOGS);
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
        if (data.missions?.length > 0) {
          setMissions(data.missions);
          if (!selectedMissionId) {
            setSelectedMissionId(data.missions[0].id);
          }
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-status-success-bg text-status-success border border-status-success-border">
            <CheckCircle2 className="w-3 h-3" /> Завершена
          </span>
        );
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-status-warning-bg text-status-warning border border-status-warning-border animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" /> Выполняется
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-status-warning-bg text-status-warning border border-status-warning-border">
            <Pause className="w-3 h-3" /> На паузе
          </span>
        );
      case 'waiting_for_approval':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-status-error-bg text-status-error border border-status-error-border">
            <ShieldAlert className="w-3 h-3" /> Ждет одобрения
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-status-error-bg text-status-error border border-status-error-border">
            <XCircle className="w-3 h-3" /> Ошибка
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
            <Clock className="w-3 h-3" /> Готова
          </span>
        );
    }
  };

  const waitingApprovalTask = tasks.find((t) => t.status === 'waiting_for_approval');

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background text-foreground">
      {/* Шапка страницы */}
      <header className="h-16 border-b border-border px-6 flex items-center justify-between shrink-0 bg-card">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-2">
              Автономные миссии (Mission Engine)
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                Phase 7
              </span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Комплексные многоэтапные задания, планирование DAG, самокоррекция и персистентность
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:opacity-90 text-primary-foreground text-xs font-medium transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Создать миссию
          </button>
        </div>
      </header>

      {/* Основной контент */}
      <div className="flex-1 flex overflow-hidden">
        {/* Левая колонка: список миссий */}
        <aside className={`w-full md:w-72 lg:w-80 border-r border-border bg-card flex flex-col shrink-0 ${selectedMissionId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Все миссии ({missions.length})
            </span>
            <button
              onClick={fetchMissions}
              className="text-muted-foreground hover:text-foreground transition p-1 rounded"
              title="Обновить список"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {missions.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
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
                        ? 'bg-secondary border-border border-l-2 border-l-highlight shadow-sm'
                        : 'bg-card border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h4 className="text-xs font-semibold text-foreground line-clamp-1">
                        {m.title}
                      </h4>
                      {getStatusBadge(m.status)}
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2.5">
                      {m.goal}
                    </p>

                    {/* Прогресс-бар */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Прогресс</span>
                        <span className="font-mono text-foreground">{m.progressPercent}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden border border-border/50">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-300"
                          style={{ width: `${m.progressPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border">
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
        <main className={`flex-1 flex flex-col overflow-y-auto bg-[#0D0F17] ${!selectedMissionId ? 'hidden md:flex' : 'flex'}`}>
          {currentMission ? (
            <div className="p-4 sm:p-6 space-y-6 max-w-6xl w-full mx-auto">
              {/* Кнопка возврата к списку на мобильных */}
              <button
                onClick={() => setSelectedMissionId(null)}
                className="md:hidden text-xs text-purple-400 hover:text-purple-300 transition flex items-center gap-1.5 font-medium py-1 px-2.5 rounded-lg bg-white/5 border border-white/10 w-fit"
              >
                ← Все миссии
              </button>

              {/* Карточка заголовка миссии */}
              <div className="p-5 rounded-xl bg-card border border-border space-y-4 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg font-bold text-foreground tracking-tight">
                        {currentMission.title}
                      </h2>
                      {getStatusBadge(currentMission.status)}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono bg-muted/40 p-2.5 rounded-lg border border-border">
                      <span className="text-primary font-semibold">Цель: </span>
                      {currentMission.goal}
                    </p>
                  </div>

                  {/* Кнопки управления */}
                  <div className="flex items-center gap-2">
                    {currentMission.status === 'ready' && (
                      <button
                        onClick={() => handleAction('start')}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold shadow-sm transition"
                      >
                        <Play className="w-3.5 h-3.5" /> Запустить миссию
                      </button>
                    )}
                    {currentMission.status === 'running' && (
                      <button
                        onClick={() => handleAction('pause')}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-status-warning text-white hover:opacity-90 text-xs font-semibold shadow-sm transition"
                      >
                        <Pause className="w-3.5 h-3.5" /> Приостановить
                      </button>
                    )}
                    {currentMission.status === 'paused' && (
                      <button
                        onClick={() => handleAction('resume')}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-status-success text-white hover:opacity-90 text-xs font-semibold shadow-sm transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Продолжить
                      </button>
                    )}
                    {(currentMission.status === 'running' || currentMission.status === 'paused') && (
                      <button
                        onClick={() => handleAction('cancel')}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-muted hover:bg-status-error-bg text-muted-foreground hover:text-status-error border border-border text-xs transition"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Отменить
                      </button>
                    )}
                  </div>
                </div>

                {/* Баннер Human Approval, если задача ждет одобрения */}
                {waitingApprovalTask && (
                  <div className="p-4 rounded-xl bg-status-error-bg border border-status-error-border flex items-center justify-between gap-4 animate-pulse">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-status-error shrink-0" />
                      <div>
                        <h4 className="text-xs font-semibold text-status-error">
                          Требуется подтверждение владельца (Human-in-the-Loop)
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                          Этап &quot;{waitingApprovalTask.title}&quot; содержит чувствительное действие и ожидает вашего решения.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAction('approve', waitingApprovalTask.id)}
                      className="px-4 py-2 rounded-xl bg-status-error hover:opacity-90 text-white text-xs font-semibold shadow-sm transition shrink-0"
                    >
                      Подтвердить и продолжить
                    </button>
                  </div>
                )}

                {/* Метрики */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-muted/40 border border-border">
                    <span className="text-[10px] text-muted-foreground block mb-0.5">Всего этапов</span>
                    <span className="text-sm font-bold text-foreground font-mono">{tasks.length}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/40 border border-border">
                    <span className="text-[10px] text-muted-foreground block mb-0.5">Выполнено</span>
                    <span className="text-sm font-bold text-status-success font-mono">
                      {tasks.filter((t) => t.status === 'completed').length}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/40 border border-border">
                    <span className="text-[10px] text-muted-foreground block mb-0.5">Бюджет токенов</span>
                    <span className="text-sm font-bold text-foreground font-mono">
                      {currentMission.tokensUsed} / {currentMission.tokenBudget}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/40 border border-border">
                    <span className="text-[10px] text-muted-foreground block mb-0.5">Чекпоинтов</span>
                    <span className="text-sm font-bold text-foreground font-mono">
                      {checkpoints.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Навигация по вкладкам */}
              <div className="flex border-b border-border gap-6 text-xs font-medium">
                <button
                  onClick={() => setActiveTab('dag')}
                  className={`pb-3 transition flex items-center gap-2 ${
                    activeTab === 'dag'
                      ? 'border-b-2 border-highlight text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" /> Граф и этапы DAG
                </button>
                <button
                  onClick={() => setActiveTab('checkpoints')}
                  className={`pb-3 transition flex items-center gap-2 ${
                    activeTab === 'checkpoints'
                      ? 'border-b-2 border-highlight text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" /> Точки сохранения ({checkpoints.length})
                </button>
                <button
                  onClick={() => setActiveTab('logs')}
                  className={`pb-3 transition flex items-center gap-2 ${
                    activeTab === 'logs'
                      ? 'border-b-2 border-highlight text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" /> Журнал логов ({logs.length})
                </button>
                <button
                  onClick={() => setActiveTab('result')}
                  className={`pb-3 transition flex items-center gap-2 ${
                    activeTab === 'result'
                      ? 'border-b-2 border-highlight text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
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
                      className="p-4 rounded-xl bg-card border border-border space-y-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-muted border border-border flex items-center justify-center text-[10px] font-mono text-muted-foreground">
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
                        className="p-3.5 rounded-xl bg-card border border-border flex items-center justify-between shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                            <Clock className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-foreground block">
                              Чекпоинт #{checkpoints.length - idx}: {cp.checkpointType}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              ID: {cp.id} | {new Date(cp.createdAt).toLocaleString('ru-RU')}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
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
                <div className="p-5 rounded-xl bg-card border border-border space-y-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Финальный результат миссии
                    </h3>
                  </div>

                  {currentMission.finalResult ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-muted/40 border border-border text-xs text-foreground leading-relaxed">
                        {currentMission.finalResult.summary}
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                          Сохраненные артефакты:
                        </h4>
                        <pre className="p-3 rounded-xl bg-muted/60 border border-border font-mono text-[11px] text-foreground overflow-x-auto">
                          {JSON.stringify(currentMission.finalResult.artifacts, null, 2)}
                        </pre>
                      </div>

                      <div className="p-3 rounded-xl bg-status-success-bg border border-status-success-border text-xs text-status-success flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-status-success" />
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-card-foreground">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" /> Новая автономная миссия
              </h3>
              <button
                onClick={() => setIsCreating(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMission} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Цель миссии на естественном языке *
                </label>
                <textarea
                  required
                  rows={4}
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  placeholder="Опишите задачу (например: Исследовать конкурентов в нише AI workflow, собрать сводную таблицу функций и сформировать отчет)..."
                  className="w-full p-3 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Название миссии (опционально)
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Анализ конкурентов 2026"
                  className="w-full p-2.5 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Бюджет токенов
                </label>
                <input
                  type="number"
                  min={1000}
                  step={5000}
                  value={newBudget}
                  onChange={(e) => setNewBudget(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground text-xs font-medium transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold shadow-sm transition"
                >
                  Спланировать и создать
                </button>
              </div>
            </form>
          </div>
      </div>
    )}
    </div>
  );
}
