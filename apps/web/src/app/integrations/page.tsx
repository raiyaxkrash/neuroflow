'use client';

import React, { useState, useEffect } from 'react';
import {
  Blocks,
  Plus,
  Send,
  Github,
  MessageSquare,
  Folder,
  Webhook,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Play,
  Square,
  Trash2,
  ShieldAlert,
  X,
} from 'lucide-react';

interface IntegrationCatalogItem {
  serviceType: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  credentialFields: Array<{
    key: string;
    label: string;
    type: 'text' | 'password';
    required: boolean;
    placeholder?: string;
    helpText?: string;
  }>;
  availableTriggers: Array<{ id: string; name: string; description: string; nodeType: string }>;
  availableActions: Array<{ id: string; name: string; description: string; nodeType: string }>;
}

interface IntegrationItem {
  id: string;
  name: string;
  serviceType: string;
  credentialId: string | null;
  settings: Record<string, any>;
  status: 'connected' | 'error' | 'disconnected';
  lastTestedAt: string | null;
  lastError: string | null;
  isEnabled: boolean;
  createdAt: string;
}

export default function IntegrationsPage() {
  const [catalog, setCatalog] = useState<IntegrationCatalogItem[]>([]);
  const [integrationsList, setIntegrationsList] = useState<IntegrationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<IntegrationCatalogItem | null>(null);

  // Состояние формы
  const [formName, setFormName] = useState('');
  const [formCredentials, setFormCredentials] = useState<Record<string, string>>({});
  const [formSettings, setFormSettings] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [pollingStatus, setPollingStatus] = useState<Record<string, boolean>>({});

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [catRes, listRes] = await Promise.all([
        fetch(`${API_BASE}/api/integrations/catalog`),
        fetch(`${API_BASE}/api/integrations`),
      ]);

      if (catRes.ok) {
        const catData = await catRes.json();
        setCatalog(catData);
      }
      if (listRes.ok) {
        const listData = await listRes.json();
        setIntegrationsList(listData);
      }
    } catch (err) {
      console.error('Ошибка загрузки интеграций:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = (item: IntegrationCatalogItem) => {
    setSelectedCatalogItem(item);
    setFormName(`${item.name} (${integrationsList.length + 1})`);
    setFormCredentials({});
    setFormSettings({});
    setTestResult(null);
    setIsModalOpen(true);
  };

  const handleSaveIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatalogItem) return;

    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType: selectedCatalogItem.serviceType,
          name: formName,
          credentials: formCredentials,
          settings: formSettings,
        }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        await loadData();
      } else {
        const err = await res.json();
        alert(`Ошибка создания интеграции: ${err.error || 'Неизвестная ошибка'}`);
      }
    } catch (err: any) {
      alert(`Ошибка сети: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/integrations/${id}/test`, {
        method: 'POST',
      });
      const data = await res.json();
      setTestResult({
        id,
        success: data.success,
        message: data.message || (data.success ? 'Подключение успешно!' : 'Ошибка подключения'),
      });
      await loadData();
    } catch (err: any) {
      setTestResult({
        id,
        success: false,
        message: err.message,
      });
    }
  };

  const handleDeleteIntegration = async (id: string) => {
    if (!confirm('Вы действительно хотите удалить эту интеграцию?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/integrations/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTogglePolling = async (id: string, active: boolean) => {
    try {
      const endpoint = active ? 'stop-polling' : 'start-polling';
      const res = await fetch(`${API_BASE}/api/integrations/${id}/telegram/${endpoint}`, {
        method: 'POST',
      });
      if (res.ok) {
        setPollingStatus((prev) => ({ ...prev, [id]: !active }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getServiceIcon = (type: string) => {
    switch (type) {
      case 'telegram':
        return <Send className="w-5 h-5 text-sky-500" />;
      case 'github':
        return <Github className="w-5 h-5 text-foreground" />;
      case 'discord':
        return <MessageSquare className="w-5 h-5 text-indigo-500" />;
      case 'filesystem':
        return <Folder className="w-5 h-5 text-status-success" />;
      default:
        return <Webhook className="w-5 h-5 text-primary" />;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Интеграции · Model Context Protocol & APIs
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            MCP Hub & Интеграции
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Подключение серверов Model Context Protocol, Telegram, GitHub, Discord и защищенной файловой песочницы.
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs text-foreground transition-colors shadow-sm self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Обновить</span>
        </button>
      </div>

      {/* Текущие активные подключения */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
          Активные подключения ({integrationsList.length})
        </h2>

        {integrationsList.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-border bg-card text-center shadow-sm">
            <Blocks className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <div className="text-sm font-medium text-foreground">Подключения пока не настроены</div>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Выберите сервис из каталога ниже, чтобы подключить Telegram бота, GitHub или файлы на компьютере.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {integrationsList.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-xl border border-border bg-card flex flex-col justify-between hover:border-highlight/50 transition-colors shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-muted border border-border">
                        {getServiceIcon(item.serviceType)}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">{item.name}</h3>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mt-0.5">
                          {item.serviceType}
                        </div>
                      </div>
                    </div>

                    {/* Статус бейдж */}
                    <div className="flex items-center gap-2">
                      {item.status === 'connected' ? (
                        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-status-success-bg text-status-success border border-status-success-border">
                          <CheckCircle2 className="w-3 h-3" /> Подключено
                        </span>
                      ) : item.status === 'error' ? (
                        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-status-error-bg text-status-error border border-status-error-border">
                          <XCircle className="w-3 h-3" /> Ошибка
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-muted text-muted-foreground border border-border">
                          <AlertCircle className="w-3 h-3" /> Отключено
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Результат проверки подключения */}
                  {testResult && testResult.id === item.id && (
                    <div
                      className={`p-2.5 rounded-lg text-xs border ${
                        testResult.success
                          ? 'bg-status-success-bg border-status-success-border text-status-success'
                          : 'bg-status-error-bg border-status-error-border text-status-error'
                      }`}
                    >
                      {testResult.message}
                    </div>
                  )}

                  {item.lastError && (
                    <div className="text-[10px] text-status-error bg-status-error-bg p-2 rounded-lg border border-status-error-border font-mono">
                      {item.lastError}
                    </div>
                  )}
                </div>

                {/* Кнопки действий */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestConnection(item.id)}
                      className="px-3 py-1.5 rounded-lg border border-border bg-muted hover:bg-muted/80 text-[11px] font-medium text-foreground transition-colors"
                    >
                      Test Connection
                    </button>

                    {/* Для Telegram: кнопка Long Polling */}
                    {item.serviceType === 'telegram' && (
                      <button
                        onClick={() => handleTogglePolling(item.id, !!pollingStatus[item.id])}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                          pollingStatus[item.id]
                            ? 'bg-status-warning-bg border-status-warning-border text-status-warning'
                            : 'bg-secondary border-border text-foreground'
                        }`}
                      >
                        {pollingStatus[item.id] ? (
                          <>
                            <Square className="w-3 h-3" /> Остановить Polling
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3" /> Запустить Polling
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteIntegration(item.id)}
                    className="p-1.5 text-muted-foreground hover:text-status-error transition-colors"
                    title="Удалить"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Каталог поддерживаемых сервисов */}
      <div className="space-y-4 pt-4">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
          Каталог сервисов для подключения
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {catalog.map((item) => (
            <div
              key={item.serviceType}
              className="p-5 rounded-xl border border-border bg-card flex flex-col justify-between hover:border-highlight/60 transition-colors group shadow-sm"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-muted border border-border">
                    {getServiceIcon(item.serviceType)}
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground px-2 py-0.5 rounded bg-muted border border-border">
                    {item.category}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                    {item.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-3 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Доступные узлы */}
                <div className="pt-2">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Доступные узлы:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {item.availableTriggers.map((tr) => (
                      <span
                        key={tr.id}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-mono"
                      >
                        ⚡ {tr.name}
                      </span>
                    ))}
                    {item.availableActions.map((ac) => (
                      <span
                        key={ac.id}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-mono"
                      >
                        ⚙ {ac.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-border">
                <button
                  onClick={() => handleOpenCreate(item)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold shadow-sm transition-opacity"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Подключить {item.name}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Модальное окно настройки подключения */}
      {isModalOpen && selectedCatalogItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-6 text-card-foreground">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                {getServiceIcon(selectedCatalogItem.serviceType)}
                <h3 className="text-base font-bold text-foreground">
                  Настройка {selectedCatalogItem.name}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveIntegration} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Название подключения
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Мой Telegram Бот"
                />
              </div>

              {/* Поля учетных данных */}
              {selectedCatalogItem.credentialFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {field.label} {field.required && <span className="text-status-error">*</span>}
                  </label>
                  <input
                    type={field.type}
                    required={field.required}
                    value={formCredentials[field.key] || ''}
                    onChange={(e) =>
                      setFormCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    placeholder={field.placeholder}
                    className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  {field.helpText && (
                    <p className="text-[10px] text-muted-foreground mt-1">{field.helpText}</p>
                  )}
                </div>
              ))}

              {/* Настройки безопасности и allowlist */}
              {selectedCatalogItem.serviceType === 'telegram' && (
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <ShieldAlert className="w-3.5 h-3.5 text-primary" />
                    <span>Безопасность и фильтрация (Allowlist)</span>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                      Разрешенные Telegram User ID (через запятую)
                    </label>
                    <input
                      type="text"
                      placeholder="123456789, 987654321"
                      onChange={(e) => {
                        const ids = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                        setFormSettings((prev) => ({ ...prev, allowedUserIds: ids }));
                      }}
                      className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Только указанные пользователи смогут отправлять команды и обращаться к AI.
                    </p>
                  </div>
                </div>
              )}

              {selectedCatalogItem.serviceType === 'filesystem' && (
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-3">
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                    Разрешенные директории файловой песочницы (через запятую)
                  </label>
                  <input
                    type="text"
                    defaultValue="./data/storage"
                    onChange={(e) => {
                      const roots = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                      setFormSettings((prev) => ({ ...prev, allowedRootPaths: roots }));
                    }}
                    className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    AI-агенты и воркфлоу имеют доступ только к указанным папкам на диске.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold shadow-sm transition-opacity disabled:opacity-50"
                >
                  {isSaving ? 'Сохранение...' : 'Сохранить подключение'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
