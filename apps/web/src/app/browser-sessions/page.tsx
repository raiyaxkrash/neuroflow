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
    <div className="flex-1 flex flex-col min-h-screen bg-background text-foreground p-8 space-y-6">
      {/* Шапка страницы */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-border gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-highlight/10 border border-highlight/20 flex items-center justify-center text-highlight">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Браузерная автоматизация & Сессии
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-foreground border border-border font-mono font-medium">
                  Playwright
                </span>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Мониторинг изолированных браузерных контекстов, скриншотов в реальном времени и Desktop Companion
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchSessions}
            disabled={actionInProgress}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Обновить</span>
          </button>
          <button
            onClick={handleTerminateAll}
            disabled={actionInProgress || sessions.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-status-danger/10 border border-status-danger/30 text-xs font-semibold text-status-danger hover:bg-status-danger/20 transition disabled:opacity-50"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Остановить все</span>
          </button>
        </div>
      </div>

      {/* Основной контент */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Список сессий (2 колонки) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-highlight" />
              Активные браузерные сессии ({sessions.length})
            </h2>
          </div>

          {sessions.length === 0 ? (
            <div className="p-10 rounded-2xl border border-dashed border-border text-center bg-card/40">
              <Globe className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-60" />
              <h3 className="text-sm font-semibold text-foreground">Нет активных браузерных сессий</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Запустите воркфлоу с узлами "Browser Start" или "AI Browser Agent" для автоматического управления веб-страницами.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`rounded-2xl border transition-all p-4 bg-card flex flex-col justify-between ${
                    selectedSessionId === s.id
                      ? 'border-highlight shadow-sm ring-1 ring-highlight/20'
                      : 'border-border hover:border-border/80'
                  }`}
                >
                  <div>
                    {/* Статус и имя */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
                        <span className="font-semibold text-xs text-foreground">{s.name || s.id.slice(0, 8)}</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-status-success/10 text-status-success border border-status-success/20">
                        {s.status}
                      </span>
                    </div>

                    {/* URL */}
                    <div className="mb-3">
                      <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                        <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="font-mono text-foreground truncate">{s.currentUrl || 'about:blank'}</span>
                      </div>
                      {s.title && <div className="text-[10px] text-muted-foreground truncate mt-0.5">{s.title}</div>}
                    </div>

                    {/* Live Preview Скриншот */}
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-muted border border-border flex items-center justify-center mb-3">
                      {s.latestScreenshotBase64 ? (
                        <img
                          src={`data:image/jpeg;base64,${s.latestScreenshotBase64}`}
                          alt="Live Screenshot"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center text-muted-foreground text-[10px]">
                          <Camera className="w-5 h-5 mb-1 opacity-50" />
                          <span>Нет снимка экрана</span>
                        </div>
                      )}
                    </div>

                    {/* Метаданные */}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-4">
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3 text-highlight" /> Действий: {s.actionCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        {new Date(s.lastActivityAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  {/* Кнопки управления */}
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <button
                      onClick={() => handleCaptureScreenshot(s.id)}
                      disabled={actionInProgress}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-surface hover:bg-muted text-[11px] font-medium text-foreground transition flex items-center justify-center gap-1 border border-border"
                    >
                      <Camera className="w-3 h-3" /> Снимок
                    </button>
                    <button
                      onClick={() => handleViewDetails(s.id)}
                      className="py-1.5 px-2.5 rounded-lg bg-highlight/10 hover:bg-highlight/20 text-[11px] font-medium text-highlight transition flex items-center justify-center gap-1 border border-highlight/20"
                    >
                      <Eye className="w-3 h-3" /> Лог
                    </button>
                    <button
                      onClick={() => handleTerminateSession(s.id)}
                      disabled={actionInProgress}
                      className="py-1.5 px-2 rounded-lg bg-status-danger/10 hover:bg-status-danger/20 text-[11px] font-medium text-status-danger transition flex items-center justify-center gap-1 border border-status-danger/20"
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
            <div className="p-5 rounded-2xl bg-card border border-border mt-6">
              <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4 text-highlight" />
                  Журнал действий сессии: {sessionDetails.name}
                </h3>
                <button
                  onClick={() => setSessionDetails(null)}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕ Закрыть
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto font-mono text-[11px]">
                {sessionDetails.actionLogs && sessionDetails.actionLogs.length > 0 ? (
                  sessionDetails.actionLogs.map((log: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border flex items-center justify-between ${
                        log.success
                          ? 'bg-status-success/5 border-status-success/20 text-status-success'
                          : 'bg-status-danger/5 border-status-danger/20 text-status-danger'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {log.success ? (
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span className="font-bold uppercase text-[10px]">{log.action}</span>
                        <span className="text-foreground truncate">{log.target || ''}</span>
                        {log.error && <span className="text-status-danger">({log.error})</span>}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                        {log.durationMs}ms
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground text-center py-4">Нет зафиксированных действий</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Правая колонка: Desktop Companion Agent */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Monitor className="w-4 h-4 text-highlight" />
            Windows Desktop Companion
          </h2>

          <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <span className="text-xs text-muted-foreground">Статус службы</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-status-success">
                <span className="w-2 h-2 rounded-full bg-status-success" />
                {companionStatus?.name || 'Активен'}
              </span>
            </div>

            <div className="space-y-1 text-xs">
              <div className="text-muted-foreground text-[11px]">Белый список процессов (Whitelist):</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {companionStatus?.allowedProcesses?.map((p: string) => (
                  <span
                    key={p}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface text-foreground border border-border"
                  >
                    {p}
                  </span>
                )) || <span className="text-muted-foreground text-[11px]">Загрузка...</span>}
              </div>
            </div>

            <div className="pt-3 border-t border-border space-y-2">
              <div className="text-xs font-semibold text-foreground">
                Обнаруженные окна приложений ({windows.length})
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {windows.length > 0 ? (
                  windows.map((w, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-surface border border-border flex items-center justify-between text-xs"
                    >
                      <div className="truncate mr-2">
                        <div className="font-semibold text-foreground truncate">{w.title}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{w.processName}.exe</div>
                      </div>
                      {w.isActive && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-highlight/10 text-highlight border border-highlight/20 shrink-0">
                          В фокусе
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-[11px] text-muted-foreground text-center py-2">
                    Нет активных окон из белого списка
                  </div>
                )}
              </div>
            </div>

            <div className="text-[10px] text-muted-foreground leading-relaxed pt-2 border-t border-border">
              Защита: прямой доступ к терминалу/PowerShell от AI-агентов полностью заблокирован. Управление осуществляется строго через типизированные Windows события.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
