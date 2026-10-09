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
  const [activeTab, setActiveTab] = useState<'ai' | 'mcp' | 'system'>('ai');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMCPModalOpen, setIsMCPModalOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string; latencyMs?: number }>>({});

  const [mcpFormData, setMcpFormData] = useState({
    name: '',
    description: '',
    transport: 'stdio' as 'stdio' | 'sse' | 'http',
    serverUrl: '',
    command: 'node',
    args: '',
    env: '',
    authType: 'none' as 'none' | 'bearer' | 'api-key-header',
    apiKey: '',
  });

  const resetMCPForm = () => {
    setMcpFormData({
      name: '',
      description: '',
      transport: 'stdio',
      serverUrl: '',
      command: 'node',
      args: '',
      env: '',
      authType: 'none',
      apiKey: '',
    });
  };

  const { data: mcpServers = [], isLoading: isMCPLoading } = useQuery<any[]>({
    queryKey: ['mcp-servers'],
    queryFn: async () => {
      const res = await api.getMCPServers();
      return (res || []) as any[];
    },
  });

  const createMCPMutation = useMutation({
    mutationFn: (data: any) => api.createMCPServer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-servers'] });
      setIsMCPModalOpen(false);
      resetMCPForm();
    },
    onError: (err: any) => {
      alert(`Ошибка создания MCP сервера: ${err.message}`);
    },
  });

  const deleteMCPMutation = useMutation({
    mutationFn: (id: string) => api.deleteMCPServer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-servers'] });
    },
  });

  const testMCPMutation = useMutation({
    mutationFn: (id: string) => api.testMCPServer(id),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['mcp-servers'] });
      alert(res.message || 'Подключение успешно проверено!');
    },
    onError: (err: any) => {
      alert(`Ошибка подключения к MCP: ${err.message}`);
    },
  });

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

          {activeTab === 'mcp' && (
            <button
              onClick={() => {
                resetMCPForm();
                setIsMCPModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Добавить MCP Сервер</span>
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
            onClick={() => setActiveTab('mcp')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'mcp'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-4 h-4 text-indigo-400" />
            <span>MCP Серверы (Integrations)</span>
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

          {/* ВКЛАДКА: MCP СЕРВЕРЫ */}
          {activeTab === 'mcp' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-200">Подключенные MCP Серверы (Model Context Protocol)</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Стандарт Anthropic/Linux Foundation для универсального подключения инструментов, ресурсов и промптов (stdio, SSE, HTTP).
                  </p>
                </div>
              </div>

              {isMCPLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                </div>
              ) : mcpServers.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-white/10 bg-[#12141F]">
                  <Server className="w-8 h-8 text-slate-500 mx-auto mb-2.5" />
                  <p className="text-sm font-medium text-slate-300">MCP Серверы пока не подключены</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Добавьте локальный (stdio через npx/python/uvx/docker) или удаленный (SSE/HTTP) сервер для расширения возможностей AI-агентов.
                  </p>
                  <button
                    onClick={() => {
                      resetMCPForm();
                      setIsMCPModalOpen(true);
                    }}
                    className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 cursor-pointer"
                  >
                    Подключить первый MCP сервер
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3.5">
                  {mcpServers.map((server) => {
                    const isTesting = testMCPMutation.isPending && (testMCPMutation.variables as any) === server.id;
                    const toolsCount = Array.isArray(server.discoveredTools) ? server.discoveredTools.length : 0;

                    return (
                      <div
                        key={server.id}
                        className="p-5 rounded-2xl bg-[#12141F] border border-white/5 hover:border-white/10 transition-all flex items-start justify-between gap-4"
                      >
                        <div className="space-y-2.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="text-sm font-semibold text-slate-100">{server.name}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              {server.transport}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-slate-300">
                              {toolsCount} инструментов
                            </span>
                          </div>

                          {server.description && (
                            <p className="text-xs text-slate-400">{server.description}</p>
                          )}

                          <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                            {server.transport === 'stdio' ? (
                              <span>Команда: <strong className="text-slate-200">{server.command} {(server.args || []).join(' ')}</strong></span>
                            ) : (
                              <span>URL: <strong className="text-slate-200">{server.serverUrl}</strong></span>
                            )}
                          </div>

                          {toolsCount > 0 && (
                            <div className="pt-2 border-t border-white/5 flex flex-wrap gap-1.5">
                              {server.discoveredTools.map((t: any) => (
                                <span
                                  key={t.name}
                                  title={t.description || t.name}
                                  className="px-2 py-0.5 rounded bg-[#181B2B] border border-white/5 text-[10px] font-mono text-cyan-300"
                                >
                                  ⚡ {t.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => testMCPMutation.mutate(server.id)}
                            disabled={isTesting}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181B2B] hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/5 transition-colors cursor-pointer"
                          >
                            {isTesting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                            )}
                            <span>{isTesting ? 'Проверка...' : 'Обновить инструменты'}</span>
                          </button>

                          <button
                            onClick={() => {
                              if (confirm(`Удалить MCP сервер «${server.name}»?`)) {
                                deleteMCPMutation.mutate(server.id);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
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

      {/* МОДАЛЬНОЕ ОКНО СОЗДАНИЯ MCP СЕРВЕРА */}
      {isMCPModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#12141F] border border-white/10 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-indigo-900/30 to-purple-900/20">
              <div className="flex items-center gap-2.5">
                <Server className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">Добавить MCP Сервер</h3>
              </div>
              <button onClick={() => setIsMCPModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMCPMutation.mutate({
                  name: mcpFormData.name,
                  description: mcpFormData.description || undefined,
                  transport: mcpFormData.transport,
                  command: mcpFormData.transport === 'stdio' ? mcpFormData.command : undefined,
                  args: mcpFormData.transport === 'stdio' && mcpFormData.args ? mcpFormData.args.split(' ').map((s) => s.trim()).filter(Boolean) : undefined,
                  serverUrl: mcpFormData.transport !== 'stdio' ? mcpFormData.serverUrl : undefined,
                  authType: mcpFormData.authType,
                  apiKey: mcpFormData.apiKey || undefined,
                });
              }}
              className="p-6 overflow-y-auto space-y-4 flex-1"
            >
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Название MCP Сервера:</label>
                <input
                  type="text"
                  required
                  placeholder="GitHub MCP, Postgres DB, File System..."
                  value={mcpFormData.name}
                  onChange={(e) => setMcpFormData({ ...mcpFormData, name: e.target.value })}
                  className="w-full bg-[#181B2B] text-xs text-slate-200 p-2.5 rounded-lg border border-white/5 focus:border-indigo-500/50 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Описание (опционально):</label>
                <input
                  type="text"
                  placeholder="Доступ к репозиториям и issue трекеру"
                  value={mcpFormData.description}
                  onChange={(e) => setMcpFormData({ ...mcpFormData, description: e.target.value })}
                  className="w-full bg-[#181B2B] text-xs text-slate-200 p-2.5 rounded-lg border border-white/5 focus:border-indigo-500/50 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Транспорт (Transport):</label>
                <select
                  value={mcpFormData.transport}
                  onChange={(e) => setMcpFormData({ ...mcpFormData, transport: e.target.value as any })}
                  className="w-full bg-[#181B2B] text-xs text-slate-200 p-2.5 rounded-lg border border-white/5 focus:border-indigo-500/50 outline-none"
                >
                  <option value="stdio">Stdio (Локальный процесс: node, npx, python, uvx, docker)</option>
                  <option value="sse">SSE (Server-Sent Events по HTTP)</option>
                  <option value="http">HTTP Remote Endpoint</option>
                </select>
              </div>

              {mcpFormData.transport === 'stdio' ? (
                <>
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">Команда (Command):</label>
                    <select
                      value={mcpFormData.command}
                      onChange={(e) => setMcpFormData({ ...mcpFormData, command: e.target.value })}
                      className="w-full bg-[#181B2B] text-xs text-slate-200 p-2.5 rounded-lg border border-white/5 focus:border-indigo-500/50 outline-none"
                    >
                      <option value="npx">npx</option>
                      <option value="node">node</option>
                      <option value="python">python</option>
                      <option value="python3">python3</option>
                      <option value="uvx">uvx</option>
                      <option value="docker">docker</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">Аргументы (через пробел):</label>
                    <input
                      type="text"
                      placeholder="-y @modelcontextprotocol/server-filesystem /path"
                      value={mcpFormData.args}
                      onChange={(e) => setMcpFormData({ ...mcpFormData, args: e.target.value })}
                      className="w-full bg-[#181B2B] font-mono text-xs text-slate-200 p-2.5 rounded-lg border border-white/5 focus:border-indigo-500/50 outline-none"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">Server URL (с SSRF-проверкой):</label>
                    <input
                      type="url"
                      required
                      placeholder="https://mcp.example.com/sse"
                      value={mcpFormData.serverUrl}
                      onChange={(e) => setMcpFormData({ ...mcpFormData, serverUrl: e.target.value })}
                      className="w-full bg-[#181B2B] font-mono text-xs text-slate-200 p-2.5 rounded-lg border border-white/5 focus:border-indigo-500/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">Авторизация:</label>
                    <select
                      value={mcpFormData.authType}
                      onChange={(e) => setMcpFormData({ ...mcpFormData, authType: e.target.value as any })}
                      className="w-full bg-[#181B2B] text-xs text-slate-200 p-2.5 rounded-lg border border-white/5 focus:border-indigo-500/50 outline-none"
                    >
                      <option value="none">Без авторизации</option>
                      <option value="bearer">Bearer Token</option>
                      <option value="api-key-header">X-API-Key Header</option>
                    </select>
                  </div>
                  {mcpFormData.authType !== 'none' && (
                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">API Ключ / Токен:</label>
                      <input
                        type="password"
                        placeholder="Ключ шифруется AES-256-GCM"
                        value={mcpFormData.apiKey}
                        onChange={(e) => setMcpFormData({ ...mcpFormData, apiKey: e.target.value })}
                        className="w-full bg-[#181B2B] font-mono text-xs text-slate-200 p-2.5 rounded-lg border border-white/5 focus:border-indigo-500/50 outline-none"
                      />
                    </div>
                  )}
                </>
              )}

              <div className="p-4 border-t border-white/5 flex items-center justify-end gap-2 -mx-6 -mb-6 mt-6 bg-[#0D0E15]">
                <button
                  type="button"
                  onClick={() => setIsMCPModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={createMCPMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  {createMCPMutation.isPending ? 'Подключение...' : 'Подключить сервер'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
