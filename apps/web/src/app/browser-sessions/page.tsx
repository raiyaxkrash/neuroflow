'use client';

import React, { useState, useEffect } from 'react';
import {
  Globe,
  Camera,
  PowerOff,
  RefreshCw,
  Monitor,
  Activity,
  ShieldAlert,
  Clock,
  Layers,
  CheckCircle,
  AlertCircle,
  Eye,
  ExternalLink,
} from 'lucide-react';

interface BrowserSessionItem {
  id: string;
  name?: string;
  status: 'active' | 'idle' | 'closed' | 'error';
  currentUrl?: string;
  title?: string;
  createdAt: string;
  lastActivityAt: string;
  actionCount: number;
  latestScreenshotBase64?: string;
}

interface DesktopWindowItem {
  handle: string;
  title: string;
  processName: string;
  isActive: boolean;
}

export default function BrowserSessionsPage() {
  const [sessions, setSessions] = useState<BrowserSessionItem[]>([]);
  const [windows, setWindows] = useState<DesktopWindowItem[]>([]);
  const [companionStatus, setCompanionStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/browser/sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch {
      // Игнорируем в offline
    } finally {
      setLoading(false);
    }
  };

  const fetchDesktopInfo = async () => {
    try {
      const [statusRes, winRes] = await Promise.all([
        fetch(`${API_URL}/api/desktop/status`).catch(() => null),
        fetch(`${API_URL}/api/desktop/windows`).catch(() => null),
      ]);
      if (statusRes && statusRes.ok) {
        setCompanionStatus(await statusRes.json());
      }
      if (winRes && winRes.ok) {
        const d = await winRes.json();
        setWindows(d.windows || []);
      }
    } catch {}
  };

  useEffect(() => {
    fetchSessions();
    fetchDesktopInfo();
    const interval = setInterval(() => {
      fetchSessions();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleTerminateSession = async (id: string) => {
    if (!confirm('Вы уверены, что хотите принудительно остановить эту браузерную сессию?')) return;
    try {
      setActionInProgress(true);
      await fetch(`${API_URL}/api/browser/sessions/${id}/terminate`, { method: 'POST' });
      await fetchSessions();
      if (selectedSessionId === id) {
        setSelectedSessionId(null);
        setSessionDetails(null);
      }
    } catch {} finally {
      setActionInProgress(false);
    }
  };

  const handleTerminateAll = async () => {
    if (!confirm('ВНИМАНИЕ: Принудительно завершить ВСЕ активные сессии Playwright?')) return;
    try {
      setActionInProgress(true);
      await fetch(`${API_URL}/api/browser/sessions/terminate-all`, { method: 'POST' });
      await fetchSessions();
      setSelectedSessionId(null);
      setSessionDetails(null);
    } catch {} finally {
      setActionInProgress(false);
    }
  };

  const handleCaptureScreenshot = async (id: string) => {
    try {
      setActionInProgress(true);
      const res = await fetch(`${API_URL}/api/browser/sessions/${id}/screenshot`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSessions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, latestScreenshotBase64: data.base64 } : s))
        );
      }
    } catch {} finally {
      setActionInProgress(false);
    }
  };

  const handleViewDetails = async (id: string) => {
    try {
      setSelectedSessionId(id);
      const res = await fetch(`${API_URL}/api/browser/sessions/${id}`);
      if (res.ok) {
        setSessionDetails(await res.json());
      }
    } catch {}
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-[#0B0D17] text-slate-100 p-8">
      {/* Шапка страницы */}
      <div className="flex items-center justify-between pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Браузерная автоматизация & Сессии
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono">
                  Playwright
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Мониторинг изолированных браузерных контекстов, скриншотов в реальном времени и Desktop Companion
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchSessions}
            disabled={actionInProgress}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-slate-300 hover:bg-white/5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </button>
          <button
            onClick={handleTerminateAll}
            disabled={actionInProgress || sessions.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 border border-rose-500/40 text-xs font-semibold text-rose-300 hover:bg-rose-600/30 transition disabled:opacity-50"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            Экстренная остановка всех
          </button>
        </div>
      </div>

      {/* Основной контент */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Список сессий (2 колонки) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              Активные браузерные сессии ({sessions.length})
            </h2>
          </div>

          {sessions.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-white/10 text-center bg-[#12141F]/40">
              <Globe className="w-10 h-10 text-slate-500 mx-auto mb-3 opacity-60" />
              <h3 className="text-sm font-semibold text-slate-300">Нет активных браузерных сессий</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Запустите воркфлоу с узлами "Browser Start" или "AI Browser Agent" для автоматического управления веб-страницами.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`rounded-2xl border transition-all p-4 bg-[#12141F] flex flex-col justify-between ${
                    selectedSessionId === s.id
                      ? 'border-blue-500/50 shadow-lg shadow-blue-500/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div>
                    {/* Статус и имя */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="font-semibold text-xs text-white">{s.name || s.id.slice(0, 8)}</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {s.status}
                      </span>
                    </div>

                    {/* URL */}
                    <div className="mb-3">
                      <div className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                        <ExternalLink className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="font-mono text-slate-300 truncate">{s.currentUrl || 'about:blank'}</span>
                      </div>
                      {s.title && <div className="text-[10px] text-slate-400 truncate mt-0.5">{s.title}</div>}
                    </div>

                    {/* Live Preview Скриншот */}
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-black/60 border border-white/5 flex items-center justify-center mb-3">
                      {s.latestScreenshotBase64 ? (
                        <img
                          src={`data:image/jpeg;base64,${s.latestScreenshotBase64}`}
                          alt="Live Screenshot"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center text-slate-500 text-[10px]">
                          <Camera className="w-5 h-5 mb-1 opacity-50" />
                          <span>Нет снимка экрана</span>
                        </div>
                      )}
                    </div>

                    {/* Метаданные */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-4">
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3 text-blue-400" /> Действий: {s.actionCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {new Date(s.lastActivityAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  {/* Кнопки управления */}
                  <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                    <button
                      onClick={() => handleCaptureScreenshot(s.id)}
                      disabled={actionInProgress}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-medium text-slate-300 transition flex items-center justify-center gap-1"
                    >
                      <Camera className="w-3 h-3" /> Снимок
                    </button>
                    <button
                      onClick={() => handleViewDetails(s.id)}
                      className="py-1.5 px-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-[11px] font-medium text-blue-300 transition flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3 h-3" /> Лог
                    </button>
                    <button
                      onClick={() => handleTerminateSession(s.id)}
                      disabled={actionInProgress}
                      className="py-1.5 px-2 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-[11px] font-medium text-rose-300 transition flex items-center justify-center gap-1"
                      title="Экстренная остановка"
                    >
                      <PowerOff className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Детализированный лог выбранной сессии */}
          {sessionDetails && (
            <div className="p-5 rounded-2xl bg-[#12141F] border border-white/10 mt-6">
              <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
                <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  Журнал действий сессии: {sessionDetails.name}
                </h3>
                <button
                  onClick={() => setSessionDetails(null)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  ✕ Закрыть
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto font-mono text-[11px]">
                {sessionDetails.actionLogs && sessionDetails.actionLogs.length > 0 ? (
                  sessionDetails.actionLogs.map((log: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg border flex items-center justify-between ${
                        log.success
                          ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/5 border-rose-500/20 text-rose-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {log.success ? (
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span className="font-bold uppercase text-[10px]">{log.action}</span>
                        <span className="text-slate-300 truncate">{log.target || ''}</span>
                        {log.error && <span className="text-rose-400">({log.error})</span>}
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0 ml-2">
                        {log.durationMs}ms
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 text-center py-4">Нет зафиксированных действий</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Правая колонка: Desktop Companion Agent */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Monitor className="w-4 h-4 text-emerald-400" />
            Windows Desktop Companion
          </h2>

          <div className="p-5 rounded-2xl bg-[#12141F] border border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <span className="text-xs text-slate-400">Статус службы</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                {companionStatus?.name || 'Активен'}
              </span>
            </div>

            <div className="space-y-1 text-xs">
              <div className="text-slate-400 text-[11px]">Белый список процессов (Whitelist):</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {companionStatus?.allowedProcesses?.map((p: string) => (
                  <span
                    key={p}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/5"
                  >
                    {p}
                  </span>
                )) || <span className="text-slate-500 text-[11px]">Загрузка...</span>}
              </div>
            </div>

            <div className="pt-3 border-t border-white/5 space-y-2">
              <div className="text-xs font-semibold text-slate-300">
                Обнаруженные окна приложений ({windows.length})
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {windows.length > 0 ? (
                  windows.map((w, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs"
                    >
                      <div className="truncate mr-2">
                        <div className="font-semibold text-slate-200 truncate">{w.title}</div>
                        <div className="text-[10px] font-mono text-slate-500">{w.processName}.exe</div>
                      </div>
                      {w.isActive && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 shrink-0">
                          В фокусе
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-[11px] text-slate-500 text-center py-2">
                    Нет активных окон из белого списка
                  </div>
                )}
              </div>
            </div>

            <div className="text-[10px] text-slate-500 leading-relaxed pt-2 border-t border-white/5">
              Защита: прямой доступ к терминалу/PowerShell от AI-агентов полностью заблокирован. Управление осуществляется строго через типизированные Windows события.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
