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
  ExternalLink,
  ShieldAlert,
  Sliders,
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
    setFormName(`${item.name} Connection`);
    setFormCredentials({});
    setFormSettings({});
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
          name: formName,
          serviceType: selectedCatalogItem.serviceType,
          credentials: formCredentials,
          settings: formSettings,
          isEnabled: true,
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
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/${id}/test`, {
        method: 'POST',
      });
      const data = await res.json();
      setTestResult({
        id,
        success: data.success,
        message: data.message,
      });
      await loadData();
    } catch (err: any) {
      setTestResult({
        id,
        success: false,
        message: `Ошибка проверки: ${err.message}`,
      });
    }
  };

  const handleDeleteIntegration = async (id: string) => {
    if (!confirm('Удалить это подключение интеграции?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/integrations/${id}`, { method: 'DELETE' });
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
        return <Send className="w-5 h-5 text-[#0088CC]" />;
      case 'github':
        return <Github className="w-5 h-5 text-white" />;
      case 'discord':
        return <MessageSquare className="w-5 h-5 text-[#5865F2]" />;
      case 'filesystem':
        return <Folder className="w-5 h-5 text-emerald-400" />;
      default:
        return <Webhook className="w-5 h-5 text-purple-400" />;
    }
  };

  return (
    <div className="flex-1 bg-[#090A0F] text-slate-100 min-h-screen overflow-y-auto p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Blocks className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">Персональные интеграции</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Подключение Telegram, GitHub, Discord, защищенной файловой песочницы и Webhooks
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-white/10 bg-[#12141F] hover:bg-white/5 text-xs text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Обновить</span>
          </button>
        </div>

        {/* Текущие активные подключения */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-400">
            Активные подключения ({integrationsList.length})
          </h2>

          {integrationsList.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-white/10 bg-[#12141F]/40 text-center">
              <Blocks className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <div className="text-sm font-medium text-slate-300">Подключения пока не настроены</div>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Выберите сервис из каталога ниже, чтобы подключить Telegram бота, GitHub или файлы на компьютере.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {integrationsList.map((item) => (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl border border-white/10 bg-[#12141F] flex flex-col justify-between hover:border-white/20 transition-all shadow-sm"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                          {getServiceIcon(item.serviceType)}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">{item.name}</h3>
                          <div className="text-2xs font-mono text-slate-400 uppercase tracking-wider mt-0.5">
                            {item.serviceType}
                          </div>
                        </div>
                      </div>

                      {/* Статус бейдж */}
                      <div className="flex items-center gap-2">
                        {item.status === 'connected' ? (
                          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" /> Подключено
                          </span>
                        ) : item.status === 'error' ? (
                          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <XCircle className="w-3 h-3" /> Ошибка
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                            <AlertCircle className="w-3 h-3" /> Отключено
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Результат проверки подключения */}
                    {testResult && testResult.id === item.id && (
                      <div
                        className={`p-2.5 rounded-xl text-xs border ${
                          testResult.success
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        }`}
                      >
                        {testResult.message}
                      </div>
                    )}

                    {item.lastError && (
                      <div className="text-2xs text-rose-400 bg-rose-500/5 p-2 rounded-lg border border-rose-500/15">
                        {item.lastError}
                      </div>
                    )}
                  </div>

                  {/* Кнопки действий */}
                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTestConnection(item.id)}
                        className="px-3 py-1.5 rounded-lg border border-white/10 bg-[#181B2B] hover:bg-white/10 text-2xs font-medium text-slate-200 transition-colors"
                      >
                        Test Connection
                      </button>

                      {/* Для Telegram: кнопка Long Polling */}
                      {item.serviceType === 'telegram' && (
                        <button
                          onClick={() => handleTogglePolling(item.id, !!pollingStatus[item.id])}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-2xs font-medium border transition-colors ${
                            pollingStatus[item.id]
                              ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                              : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20'
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
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
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
          <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-400">
            Каталог сервисов для подключения
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {catalog.map((item) => (
              <div
                key={item.serviceType}
                className="p-5 rounded-2xl border border-white/10 bg-[#12141F] flex flex-col justify-between hover:border-purple-500/40 transition-all group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 rounded-xl bg-[#181B2B] border border-white/5">
                      {getServiceIcon(item.serviceType)}
                    </div>
                    <span className="text-2xs font-mono text-purple-400 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                      {item.category}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                      {item.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-3 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  {/* Доступные узлы */}
                  <div className="pt-2">
                    <div className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Доступные узлы:
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {item.availableTriggers.map((tr) => (
                        <span
                          key={tr.id}
                          className="text-2xs px-1.5 py-0.5 rounded bg-white/5 text-slate-300 border border-white/5"
                        >
                          ⚡ {tr.name}
                        </span>
                      ))}
                      {item.availableActions.map((ac) => (
                        <span
                          key={ac.id}
                          className="text-2xs px-1.5 py-0.5 rounded bg-white/5 text-slate-300 border border-white/5"
                        >
                          ⚙ {ac.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-5 mt-4 border-t border-white/5">
                  <button
                    onClick={() => handleOpenCreate(item)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-600/20 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Подключить {item.name}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Модальное окно настройки подключения */}
      {isModalOpen && selectedCatalogItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#12141F] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                {getServiceIcon(selectedCatalogItem.serviceType)}
                <h3 className="text-base font-bold text-white">
                  Настройка {selectedCatalogItem.name}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveIntegration} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Название подключения
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#181B2B] border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500"
                  placeholder="Мой Telegram Бот"
                />
              </div>

              {/* Поля учетных данных */}
              {selectedCatalogItem.credentialFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {field.label} {field.required && <span className="text-rose-400">*</span>}
                  </label>
                  <input
                    type={field.type}
                    required={field.required}
                    value={formCredentials[field.key] || ''}
                    onChange={(e) =>
                      setFormCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    placeholder={field.placeholder}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#181B2B] border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                  />
                  {field.helpText && (
                    <p className="text-2xs text-slate-500 mt-1">{field.helpText}</p>
                  )}
                </div>
              ))}

              {/* Настройки безопасности и allowlist */}
              {selectedCatalogItem.serviceType === 'telegram' && (
                <div className="p-3.5 rounded-xl bg-[#181B2B]/70 border border-white/5 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                    <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                    <span>Безопасность и фильтрация (Allowlist)</span>
                  </div>
                  <div>
                    <label className="block text-2xs font-medium text-slate-400 mb-1">
                      Разрешенные Telegram User ID (через запятую)
                    </label>
                    <input
                      type="text"
                      placeholder="123456789, 987654321"
                      onChange={(e) => {
                        const ids = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                        setFormSettings((prev) => ({ ...prev, allowedUserIds: ids }));
                      }}
                      className="w-full px-3 py-1.5 rounded-lg bg-[#12141F] border border-white/10 text-xs font-mono text-white"
                    />
                    <p className="text-2xs text-slate-500 mt-1">
                      Только указанные пользователи смогут отправлять команды и обращаться к AI.
                    </p>
                  </div>
                </div>
              )}

              {selectedCatalogItem.serviceType === 'filesystem' && (
                <div className="p-3.5 rounded-xl bg-[#181B2B]/70 border border-white/5 space-y-3">
                  <label className="block text-2xs font-medium text-slate-400 mb-1">
                    Разрешенные директории файловой песочницы (через запятую)
                  </label>
                  <input
                    type="text"
                    defaultValue="./data/storage"
                    onChange={(e) => {
                      const roots = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                      setFormSettings((prev) => ({ ...prev, allowedRootPaths: roots }));
                    }}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#12141F] border border-white/10 text-xs font-mono text-white"
                  />
                  <p className="text-2xs text-slate-500">
                    AI-агенты и воркфлоу имеют доступ только к указанным папкам на диске.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-white/10 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition-all disabled:opacity-50"
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
