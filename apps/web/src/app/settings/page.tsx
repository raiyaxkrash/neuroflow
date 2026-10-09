'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  Shield,
  Server,
  Database,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Check,
  Zap,
  Globe,
  Sliders,
  Key,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { api } from '@/lib/api-client';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'ai' | 'system'>('ai');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string; latencyMs?: number }>>({});

  // Состояние формы добавления провайдера
  const [formData, setFormData] = useState({
    name: '',
    provider: 'openai' as 'openai' | 'gemini' | 'anthropic' | 'ollama' | 'openai-compatible' | 'custom-rest',
    endpoint: '',
    apiKey: '',
    defaultModel: 'gpt-4o-mini',
    models: 'gpt-4o, gpt-4o-mini, gpt-4-turbo',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
    isDefault: false,
    headersJson: '',
    customBodyTemplate: '',
    customResponsePath: 'choices.0.message.content',
  });

  // Запрос списка провайдеров
  const { data: providers = [], isLoading } = useQuery<any[]>({
    queryKey: ['ai-providers'],
    queryFn: async () => {
      const res = await api.getAIProviders();
      return (res?.providers || []) as any[];
    },
  });

  // Создание провайдера
  const createMutation = useMutation({
    mutationFn: (newProvider: any) => api.createAIProvider(newProvider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-providers'] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      alert(`Ошибка при сохранении провайдера: ${err.message}`);
    },
  });

  // Удаление провайдера
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAIProvider(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-providers'] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      provider: 'openai',
      endpoint: '',
      apiKey: '',
      defaultModel: 'gpt-4o-mini',
      models: 'gpt-4o, gpt-4o-mini, gpt-4-turbo',
      defaultTemperature: 0.7,
      defaultMaxTokens: 2048,
      isDefault: false,
      headersJson: '',
      customBodyTemplate: '',
      customResponsePath: 'choices.0.message.content',
    });
  };

  const handleProviderTypeChange = (type: any) => {
    let defaultModel = 'gpt-4o-mini';
    let models = 'gpt-4o, gpt-4o-mini';
    let endpoint = '';

    if (type === 'anthropic') {
      defaultModel = 'claude-3-5-sonnet-20241022';
      models = 'claude-3-5-sonnet-20241022, claude-3-haiku-20240307';
    } else if (type === 'gemini') {
      defaultModel = 'gemini-1.5-flash';
      models = 'gemini-1.5-pro, gemini-1.5-flash';
    } else if (type === 'ollama') {
      defaultModel = 'llama3';
      models = 'llama3, mistral, qwen2.5';
      endpoint = 'http://localhost:11434';
    } else if (type === 'openai-compatible') {
      defaultModel = 'deepseek-chat';
      models = 'deepseek-chat, deepseek-coder';
      endpoint = 'https://api.deepseek.com/v1';
    } else if (type === 'custom-rest') {
      defaultModel = 'custom-model';
      models = 'custom-model';
      endpoint = 'https://my-llm-service.local/v1/chat';
    }

    setFormData({
      ...formData,
      provider: type,
      defaultModel,
      models,
      endpoint,
    });
  };

  const handleTestConnection = async (providerId: string) => {
    setTestingId(providerId);
    try {
      const res = await api.testAIProvider(providerId);
      setTestResults((prev) => ({
        ...prev,
        [providerId]: {
          success: res.success,
          message: res.message || (res.success ? 'Подключение успешно' : 'Ошибка соединения'),
          latencyMs: res.latencyMs,
        },
      }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [providerId]: {
          success: false,
          message: err.message || 'Ошибка проверки соединения',
        },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Укажите имя провайдера');
      return;
    }

    let parsedHeaders: Record<string, string> | undefined;
    if (formData.headersJson.trim()) {
      try {
        parsedHeaders = JSON.parse(formData.headersJson.trim());
      } catch (e) {
        alert('Поле Custom Headers должно содержать валидный JSON');
        return;
      }
    }

    const payload: any = {
      name: formData.name.trim(),
      provider: formData.provider,
      endpoint: formData.endpoint.trim() || undefined,
      apiKey: formData.apiKey.trim() || undefined,
      defaultModel: formData.defaultModel.trim(),
      models: formData.models.split(',').map((m) => m.trim()).filter(Boolean),
      defaultTemperature: formData.defaultTemperature,
      defaultMaxTokens: formData.defaultMaxTokens,
      isDefault: formData.isDefault,
      headers: parsedHeaders,
    };

    if (formData.provider === 'custom-rest') {
      payload.customBodyTemplate = formData.customBodyTemplate.trim() || undefined;
      payload.customResponsePath = formData.customResponsePath.trim() || undefined;
    }

    createMutation.mutate(payload);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090A0F]">
      <Sidebar />

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Заголовок страницы */}
        <header className="h-16 border-b border-white/10 px-8 flex items-center justify-between shrink-0 bg-[#0D0E15]">
          <div>
            <h1 className="text-lg font-semibold text-white tracking-tight">Настройки системы</h1>
            <p className="text-xs text-slate-400">
              Управление AI-провайдерами, учетными записями LLM и параметрами безопасности
            </p>
          </div>

          {activeTab === 'ai' && (
            <button
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/25 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Добавить AI Провайдер</span>
            </button>
          )}
        </header>

        {/* Навигация по вкладкам */}
        <div className="flex border-b border-white/10 px-8 bg-[#0D0E15]/50 shrink-0">
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'ai'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>AI Провайдеры (Credentials)</span>
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'system'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4 text-slate-400" />
            <span>Система и безопасность</span>
          </button>
        </div>

        {/* Основной контент */}
        <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full space-y-6">
          {/* ВКЛАДКА 1: AI PROVIDERS */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-200">Подключенные модели и LLM</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    API-ключи шифруются по стандарту AES-256-GCM. Доступны OpenAI, Gemini, Anthropic, Ollama, OpenAI-compatible и Custom REST.
                  </p>
                </div>
              </div>

              {isLoading ? (
                <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                  <span className="text-xs">Загрузка AI провайдеров...</span>
                </div>
              ) : providers.length === 0 ? (
                <div className="p-10 text-center rounded-2xl border border-white/10 bg-[#12141F]/40 space-y-3">
                  <Sparkles className="w-8 h-8 text-purple-400 mx-auto" />
                  <h3 className="text-sm font-semibold text-slate-200">AI провайдеры еще не добавлены</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Добавьте ключ OpenAI, Anthropic, Gemini или локальный Ollama, чтобы включить AI Model ноду, AI Workflow Generator и интерактивный Copilot.
                  </p>
                  <button
                    onClick={() => {
                      resetForm();
                      setIsModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Подключить первый провайдер</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {providers.map((p: any) => {
                    const test = testResults[p.id];
                    const isTesting = testingId === p.id;

                    return (
                      <div
                        key={p.id}
                        className="p-5 rounded-2xl bg-[#12141F] border border-white/5 hover:border-white/10 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2.5">
                            <span className="font-semibold text-sm text-slate-100">{p.name}</span>
                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                              {p.provider}
                            </span>
                            {p.isDefault && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                Default
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                            <span>
                              Модель по умолчанию: <strong className="text-slate-300 font-mono">{p.defaultModel}</strong>
                            </span>
                            {p.endpoint && (
                              <span className="truncate max-w-xs font-mono text-[11px]">
                                Endpoint: {p.endpoint}
                              </span>
                            )}
                            {p.maskedKey && (
                              <span className="font-mono text-[11px] text-slate-500">
                                Ключ: {p.maskedKey}
                              </span>
                            )}
                          </div>

                          {/* Результат теста */}
                          {test && (
                            <div className="pt-1.5 flex items-center gap-2 text-xs">
                              {test.success ? (
                                <div className="flex items-center gap-1.5 text-emerald-400">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{test.message}</span>
                                  {test.latencyMs !== undefined && (
                                    <span className="text-slate-400 font-mono text-[10px]">
                                      ({test.latencyMs}ms)
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-rose-400">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  <span>{test.message}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Кнопки действий */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleTestConnection(p.id)}
                            disabled={isTesting}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181B2B] hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/5 transition-colors"
                          >
                            {isTesting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                            )}
                            <span>{isTesting ? 'Проверка...' : 'Test Connection'}</span>
                          </button>

                          <button
                            onClick={() => {
                              if (confirm(`Удалить AI провайдер «${p.name}»?`)) {
                                deleteMutation.mutate(p.id);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ВКЛАДКА 2: СИСТЕМА И БЕЗОПАСНОСТЬ */}
          {activeTab === 'system' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-[#12141F] border border-white/5 space-y-3">
                <div className="flex items-center gap-2.5 text-slate-200 font-semibold text-sm">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>Безопасность сетевых запросов (SSRF Guard Phase 2)</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Активна комплексная защита: блокируются запросы к loopback (127.0.0.1, ::1), RFC1918 приватным сетям, metadata AWS/GCP (169.254.169.254), альтернативным IPv4 представлениям (dword/hex/octal) и защищены от атак через 30x редиректы. Локальный порт Ollama (11434) валидируется по белому списку.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#12141F] border border-white/5 space-y-3">
                <div className="flex items-center gap-2.5 text-slate-200 font-semibold text-sm">
                  <Database className="w-4 h-4 text-purple-400" />
                  <span>Хранилище данных и криптография</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  PostgreSQL / PGLite с Drizzle ORM. Все пароли пользователей защищены алгоритмом PBKDF2/SHA-256 с динамической солью, а ключи API провайдеров зашифрованы симметричным шифрованием AES-256-GCM с уникальными IV.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* МОДАЛЬНОЕ ОКНО СОЗДАНИЯ AI ПРОВАЙДЕРА */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#12141F] border border-white/10 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-purple-900/30 to-indigo-900/20">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">Добавить AI Провайдер</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Название аккаунта / профиля:
                </label>
                <input
                  type="text"
                  required
                  placeholder="My OpenAI Production, Local Ollama, Groq Llama..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[#181B2B] text-xs text-slate-200 p-2.5 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Тип провайдера:
                </label>
                <select
                  value={formData.provider}
                  onChange={(e) => handleProviderTypeChange(e.target.value)}
                  className="w-full bg-[#181B2B] text-xs text-slate-200 p-2.5 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                >
                  <option value="openai">OpenAI (GPT-4o, o1, mini)</option>
                  <option value="anthropic">Anthropic (Claude 3.5 Sonnet / Haiku)</option>
                  <option value="gemini">Google Gemini (Gemini 1.5 Pro / Flash)</option>
                  <option value="ollama">Ollama (Локальный сервер / Home lab)</option>
                  <option value="openai-compatible">OpenAI-Compatible (vLLM, DeepSeek, Groq, Together)</option>
                  <option value="custom-rest">Custom REST API (Пользовательский шлюз)</option>
                </select>
              </div>

              {formData.provider !== 'ollama' && (
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    API-ключ:
                  </label>
                  <input
                    type="password"
                    placeholder="sk-proj-... / AIzaSy..."
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    className="w-full bg-[#181B2B] font-mono text-xs text-slate-200 p-2.5 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Ключ шифруется AES-256-GCM на сервере и никогда не отображается открытым текстом.
                  </span>
                </div>
              )}

              {(formData.provider === 'ollama' ||
                formData.provider === 'openai-compatible' ||
                formData.provider === 'custom-rest') && (
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Endpoint (Base URL):
                  </label>
                  <input
                    type="url"
                    placeholder="http://localhost:11434 или https://api.deepseek.com/v1"
                    value={formData.endpoint}
                    onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                    className="w-full bg-[#181B2B] font-mono text-xs text-slate-200 p-2.5 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Модель по умолчанию:
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.defaultModel}
                    onChange={(e) => setFormData({ ...formData, defaultModel: e.target.value })}
                    className="w-full bg-[#181B2B] font-mono text-xs text-slate-200 p-2 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Каталог моделей (через запятую):
                  </label>
                  <input
                    type="text"
                    value={formData.models}
                    onChange={(e) => setFormData({ ...formData, models: e.target.value })}
                    className="w-full bg-[#181B2B] font-mono text-xs text-slate-200 p-2 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Temperature (0.0 — 2.0):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={formData.defaultTemperature}
                    onChange={(e) => setFormData({ ...formData, defaultTemperature: Number(e.target.value) })}
                    className="w-full bg-[#181B2B] text-xs text-slate-200 p-2 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Max Output Tokens:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="128000"
                    value={formData.defaultMaxTokens}
                    onChange={(e) => setFormData({ ...formData, defaultMaxTokens: Number(e.target.value) })}
                    className="w-full bg-[#181B2B] text-xs text-slate-200 p-2 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                  />
                </div>
              </div>

              {formData.provider === 'custom-rest' && (
                <div className="space-y-3 pt-2 border-t border-white/5">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      JSON Template запроса (опционально):
                    </label>
                    <textarea
                      rows={2}
                      placeholder='{"prompt": "{{prompt}}", "max_tokens": 1000}'
                      value={formData.customBodyTemplate}
                      onChange={(e) => setFormData({ ...formData, customBodyTemplate: e.target.value })}
                      className="w-full bg-[#181B2B] font-mono text-xs text-slate-200 p-2 rounded-lg border border-white/5 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      JSON Path для извлечения ответа (dot-notation):
                    </label>
                    <input
                      type="text"
                      placeholder="choices.0.message.content"
                      value={formData.customResponsePath}
                      onChange={(e) => setFormData({ ...formData, customResponsePath: e.target.value })}
                      className="w-full bg-[#181B2B] font-mono text-xs text-slate-200 p-2 rounded-lg border border-white/5 outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isDefaultCheckbox"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="rounded accent-purple-600 cursor-pointer"
                />
                <label htmlFor="isDefaultCheckbox" className="text-xs text-slate-300 cursor-pointer">
                  Сделать провайдером по умолчанию для AI узлов и генератора
                </label>
              </div>

              <div className="p-4 border-t border-white/5 flex items-center justify-end gap-2 -mx-6 -mb-6 mt-6 bg-[#0D0E15]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-purple-600/20"
                >
                  {createMutation.isPending ? 'Сохранение...' : 'Сохранить провайдер'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
