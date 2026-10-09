'use client';

import React, { useState } from 'react';
import {
  Settings2,
  Database,
  Sparkles,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Send,
  Loader2,
  RotateCcw,
  Bot,
  User,
  Check,
  Cpu,
} from 'lucide-react';
import { useWorkflowStore } from '@/store/workflow-store';
import { api } from '@/lib/api-client';

export function Inspector() {
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const workflowId = useWorkflowStore((s) => s.workflowId);
  const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);
  const updateNodeParameters = useWorkflowStore((s) => s.updateNodeParameters);
  const updateNodeLabel = useWorkflowStore((s) => s.updateNodeLabel);
  const activeTab = useWorkflowStore((s) => s.activeInspectorTab);
  const setActiveTab = useWorkflowStore((s) => s.setActiveInspectorTab);
  const nodeExecStates = useWorkflowStore((s) => s.nodeExecStates);
  const applyCopilotActions = useWorkflowStore((s) => s.applyCopilotActions);
  const undo = useWorkflowStore((s) => s.undo);

  const [copilotInput, setCopilotInput] = useState('');
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState<
    Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      actions?: any[];
      applied?: boolean;
    }>
  >([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Привет! Я AI Copilot платформы NeuroFlow. Я могу добавить узлы, соединить блоки, изменить параметры или объяснить логику сценария. Напишите вашу задачу!',
    },
  ]);

  const handleSendCopilot = async () => {
    if (!copilotInput.trim() || isCopilotLoading) return;
    const userMsg = copilotInput.trim();
    setCopilotInput('');

    const newMsgs = [
      ...copilotMessages,
      { id: String(Date.now()), role: 'user' as const, content: userMsg },
    ];
    setCopilotMessages(newMsgs);
    setIsCopilotLoading(true);

    try {
      const graph = {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.data?.type || 'manual-trigger',
          position: n.position,
          data: n.data,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle || null,
          targetHandle: e.targetHandle || null,
        })),
      };

      const history = newMsgs.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.copilot({
        message: userMsg,
        workflowId: workflowId || undefined,
        currentGraph: graph,
        selectedNodeId: selectedNodeId || undefined,
        history,
      });

      setCopilotMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: res.reply || 'Действие выполнено',
          actions: res.actions && res.actions.length > 0 ? res.actions : undefined,
          applied: false,
        },
      ]);
    } catch (err: any) {
      setCopilotMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: `Ошибка Copilot: ${err.message}`,
        },
      ]);
    } finally {
      setIsCopilotLoading(false);
    }
  };

  const handleApplyActions = (msgId: string, actions: any[]) => {
    applyCopilotActions(actions);
    setCopilotMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, applied: true } : m))
    );
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  if (!selectedNode && activeTab !== 'copilot') {
    return (
      <aside className="w-80 border-l border-white/10 bg-[#12141F] flex flex-col h-full select-none p-6 text-center text-slate-400 justify-center items-center z-10 space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-[#181B2B] border border-white/5 flex items-center justify-center text-slate-500">
          <Settings2 className="w-6 h-6" />
        </div>
        <div className="text-sm font-medium text-slate-300">Узел не выбран</div>
        <p className="text-xs text-slate-500 max-w-[200px]">
          Нажмите на любой узел на холсте, чтобы настроить его параметры, или запустите AI Copilot.
        </p>
        <button
          onClick={() => setActiveTab('copilot')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 text-xs font-medium transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>Открыть AI Copilot</span>
        </button>
      </aside>
    );
  }

  const nodeType = (selectedNode?.data?.type as string) || 'manual-trigger';
  const label = (selectedNode?.data?.label as string) || 'Node';
  const params = (selectedNode?.data?.parameters as Record<string, any>) || {};
  const execState = selectedNode ? nodeExecStates[selectedNode.id] : undefined;

  const updateCurrentNodeParams = (patch: Record<string, any>) => {
    if (selectedNode) {
      updateNodeParameters(selectedNode.id, patch);
    }
  };

  return (
    <aside className="w-84 border-l border-white/10 bg-[#12141F] flex flex-col h-full z-10">
      {/* Шапка инспектора */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          {selectedNode ? (
            <>
              <input
                type="text"
                value={label}
                onChange={(e) => updateNodeLabel(selectedNode.id, e.target.value)}
                className="bg-transparent font-medium text-sm text-slate-100 hover:bg-white/5 focus:bg-[#181B2B] px-1.5 py-0.5 rounded border border-transparent focus:border-purple-500/50 outline-none w-full"
              />
              <div className="text-[10px] text-slate-400 font-mono pl-1.5">
                ID: {selectedNode.id}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <div className="font-semibold text-sm text-slate-100">AI Workflow Copilot</div>
            </div>
          )}
        </div>
        <button
          onClick={() => setSelectedNodeId(null)}
          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Вкладки: Параметры / Данные / Copilot */}
      <div className="flex border-b border-white/5 px-2 bg-[#181B2B]/40">
        <button
          onClick={() => setActiveTab('parameters')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'parameters'
              ? 'border-purple-500 text-purple-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>Параметры</span>
        </button>
        <button
          onClick={() => setActiveTab('data')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'data'
              ? 'border-purple-500 text-purple-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Данные</span>
        </button>
        <button
          onClick={() => setActiveTab('copilot')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'copilot'
              ? 'border-purple-500 text-purple-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>AI Copilot</span>
        </button>
      </div>

      {/* Содержимое вкладки */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ВКЛАДКА 1: ПАРАМЕТРЫ */}
        {activeTab === 'parameters' && (
          <div className="space-y-4">
            {/* MANUAL TRIGGER */}
            {nodeType === 'manual-trigger' && (
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1.5">
                  Начальный JSON Payload:
                </label>
                <textarea
                  rows={6}
                  value={JSON.stringify(params.initialPayload || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      updateCurrentNodeParams( { initialPayload: parsed });
                    } catch {
                      // Ждем валидного JSON
                    }
                  }}
                  className="w-full bg-[#181B2B] font-mono text-xs text-slate-200 p-2.5 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                />
              </div>
            )}

            {/* HTTP REQUEST */}
            {nodeType === 'http-request' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    HTTP Метод:
                  </label>
                  <select
                    value={params.method || 'GET'}
                    onChange={(e) => updateCurrentNodeParams( { method: e.target.value })}
                    className="w-full bg-[#181B2B] text-xs text-slate-200 p-2 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    URL (с SSRF защитой):
                  </label>
                  <input
                    type="url"
                    value={params.url || 'https://httpbin.org/get'}
                    onChange={(e) => updateCurrentNodeParams( { url: e.target.value })}
                    className="w-full bg-[#181B2B] font-mono text-xs text-slate-200 p-2 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Запросы к localhost, 127.0.0.1 и метаданным облака блокируются.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Таймаут (секунды):
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={(params.timeoutMs || 10000) / 1000}
                    onChange={(e) =>
                      updateCurrentNodeParams( { timeoutMs: Number(e.target.value) * 1000 })
                    }
                    className="w-full bg-[#181B2B] text-xs text-slate-200 p-2 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                  />
                </div>
              </div>
            )}

            {/* CONDITION */}
            {nodeType === 'condition' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Поле / Путь (Dot notation):
                  </label>
                  <input
                    type="text"
                    placeholder="Например: status или user.role"
                    value={params.leftValue !== undefined ? params.leftValue : 'status'}
                    onChange={(e) => updateCurrentNodeParams( { leftValue: e.target.value })}
                    className="w-full bg-[#181B2B] font-mono text-xs text-slate-200 p-2 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Оператор:
                  </label>
                  <select
                    value={params.operator || 'equals'}
                    onChange={(e) => updateCurrentNodeParams( { operator: e.target.value })}
                    className="w-full bg-[#181B2B] text-xs text-slate-200 p-2 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                  >
                    <option value="equals">Равно (equals)</option>
                    <option value="not_equals">Не равно (not equals)</option>
                    <option value="contains">Содержит (contains)</option>
                    <option value="not_contains">Не содержит (not contains)</option>
                    <option value="greater_than">Больше (&gt;)</option>
                    <option value="less_than">Меньше (&lt;)</option>
                    <option value="is_empty">Пусто (is empty)</option>
                    <option value="is_not_empty">Не пусто (is not empty)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Ожидаемое значение:
                  </label>
                  <input
                    type="text"
                    value={params.rightValue !== undefined ? params.rightValue : 'success'}
                    onChange={(e) => updateCurrentNodeParams( { rightValue: e.target.value })}
                    className="w-full bg-[#181B2B] font-mono text-xs text-slate-200 p-2 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                  />
                </div>
              </div>
            )}

            {/* SET DATA */}
            {nodeType === 'set-data' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">
                    Операции модификации:
                  </label>
                  <button
                    onClick={() => {
                      const ops = params.operations || [];
                      updateCurrentNodeParams( {
                        operations: [
                          ...ops,
                          { targetKey: 'new_field', sourceValue: 'value', valueType: 'string' },
                        ],
                      });
                    }}
                    className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Добавить поле</span>
                  </button>
                </div>

                {(params.operations || [{ targetKey: 'status', sourceValue: 'success', valueType: 'string' }]).map(
                  (op: any, idx: number) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-[#181B2B] border border-white/5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          placeholder="targetKey"
                          value={op.targetKey}
                          onChange={(e) => {
                            const newOps = [...(params.operations || [])];
                            newOps[idx] = { ...op, targetKey: e.target.value };
                            updateCurrentNodeParams( { operations: newOps });
                          }}
                          className="flex-1 bg-[#12141F] font-mono text-[11px] text-slate-200 px-2 py-1 rounded border border-white/5 outline-none"
                        />
                        <select
                          value={op.valueType || 'string'}
                          onChange={(e) => {
                            const newOps = [...(params.operations || [])];
                            newOps[idx] = { ...op, valueType: e.target.value };
                            updateCurrentNodeParams( { operations: newOps });
                          }}
                          className="bg-[#12141F] text-[11px] text-slate-300 px-2 py-1 rounded border border-white/5 outline-none"
                        >
                          <option value="string">String</option>
                          <option value="number">Number</option>
                          <option value="boolean">Boolean</option>
                          <option value="json">JSON</option>
                        </select>
                        <button
                          onClick={() => {
                            const newOps = (params.operations || []).filter((_: any, i: number) => i !== idx);
                            updateCurrentNodeParams( { operations: newOps });
                          }}
                          className="text-slate-500 hover:text-red-400 p-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Значение"
                        value={op.sourceValue}
                        onChange={(e) => {
                          const newOps = [...(params.operations || [])];
                          newOps[idx] = { ...op, sourceValue: e.target.value };
                          updateCurrentNodeParams( { operations: newOps });
                        }}
                        className="w-full bg-[#12141F] font-mono text-[11px] text-slate-200 px-2 py-1 rounded border border-white/5 outline-none"
                      />
                    </div>
                  )
                )}
              </div>
            )}

            {/* DELAY */}
            {nodeType === 'delay' && (
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Задержка в секундах:
                </label>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={params.seconds || 2}
                  onChange={(e) => updateCurrentNodeParams( { seconds: Number(e.target.value) })}
                  className="w-full bg-[#181B2B] text-xs text-slate-200 p-2 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                />
              </div>
            )}

            {/* OUTPUT */}
            {nodeType === 'output' && (
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Пользовательский ключ результата (опционально):
                </label>
                <input
                  type="text"
                  placeholder="Оставьте пустым для прямого вывода"
                  value={params.customKey || ''}
                  onChange={(e) => updateCurrentNodeParams( { customKey: e.target.value })}
                  className="w-full bg-[#181B2B] font-mono text-xs text-slate-200 p-2 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                />
              </div>
            )}

            {/* AI MODEL */}
            {nodeType === 'ai-model' && (
              <div className="space-y-3.5">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    AI Провайдер:
                  </label>
                  <select
                    value={params.provider || 'openai'}
                    onChange={(e) => updateCurrentNodeParams( { provider: e.target.value })}
                    className="w-full bg-[#181B2B] text-xs text-slate-200 p-2 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                  >
                    <option value="openai">OpenAI (GPT-4o, o1, mini)</option>
                    <option value="anthropic">Anthropic (Claude 3.5 Sonnet / Haiku)</option>
                    <option value="gemini">Google Gemini (Gemini 1.5 Pro / Flash)</option>
                    <option value="ollama">Ollama (Local LLaMA 3, Mistral, Qwen)</option>
                    <option value="openai-compatible">OpenAI-Compatible (vLLM, DeepSeek, Groq)</option>
                    <option value="custom-rest">Custom REST API</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Идентификатор модели:
                  </label>
                  <input
                    type="text"
                    placeholder="gpt-4o-mini, claude-3-5-sonnet-20241022, llama3.2..."
                    value={params.model || 'gpt-4o-mini'}
                    onChange={(e) => updateCurrentNodeParams( { model: e.target.value })}
                    className="w-full bg-[#181B2B] font-mono text-xs text-slate-200 p-2 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Системный промпт (System Instructions):
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ты — аналитический помощник NeuroFlow..."
                    value={params.systemPrompt || ''}
                    onChange={(e) => updateCurrentNodeParams( { systemPrompt: e.target.value })}
                    className="w-full bg-[#181B2B] text-xs text-slate-200 p-2.5 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Пользовательский промпт (с переменными):
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Проанализируй входящие данные: {{data.text}}"
                    value={params.userPrompt || ''}
                    onChange={(e) => updateCurrentNodeParams( { userPrompt: e.target.value })}
                    className="w-full bg-[#181B2B] text-xs text-slate-200 p-2.5 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Используйте {`{{поле}}`} для подстановки значений из входящего JSON.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Формат ответа:
                    </label>
                    <select
                      value={params.responseFormat || 'text'}
                      onChange={(e) => updateCurrentNodeParams( { responseFormat: e.target.value })}
                      className="w-full bg-[#181B2B] text-xs text-slate-200 p-2 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                    >
                      <option value="text">Текст (Text)</option>
                      <option value="json">JSON объект</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Max Tokens:
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={128000}
                      value={params.maxTokens || 2048}
                      onChange={(e) => updateCurrentNodeParams( { maxTokens: Number(e.target.value) })}
                      className="w-full bg-[#181B2B] text-xs text-slate-200 p-2 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-slate-300">
                      Температура (Temperature):
                    </label>
                    <span className="text-xs font-mono text-purple-400">
                      {params.temperature !== undefined ? params.temperature : 0.7}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={params.temperature !== undefined ? params.temperature : 0.7}
                    onChange={(e) => updateCurrentNodeParams( { temperature: Number(e.target.value) })}
                    className="w-full accent-purple-500 bg-[#181B2B] rounded-lg cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Таймаут (мс):
                    </label>
                    <input
                      type="number"
                      min={1000}
                      max={300000}
                      value={params.timeout || 60000}
                      onChange={(e) => updateCurrentNodeParams( { timeout: Number(e.target.value) })}
                      className="w-full bg-[#181B2B] text-xs text-slate-200 p-2 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Повторы (retries):
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={params.retryPolicy?.maxRetries !== undefined ? params.retryPolicy.maxRetries : 2}
                      onChange={(e) => updateCurrentNodeParams( {
                        retryPolicy: { ...(params.retryPolicy || {}), maxRetries: Number(e.target.value) }
                      })}
                      className="w-full bg-[#181B2B] text-xs text-slate-200 p-2 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ВКЛАДКА 2: ДАННЫЕ */}
        {activeTab === 'data' && (
          <div className="space-y-4">
            {execState ? (
              <>
                <div className="p-3 rounded-xl bg-[#181B2B] border border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Статус:</span>
                    <span className="font-semibold capitalize text-emerald-400">
                      {execState.status}
                    </span>
                  </div>
                  {execState.durationMs !== undefined && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Длительность:</span>
                      <span className="font-mono text-slate-200">{execState.durationMs}ms</span>
                    </div>
                  )}
                  {execState.selectedPort && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Выбранная ветка:</span>
                      <span className="font-mono text-purple-300">{execState.selectedPort}</span>
                    </div>
                  )}
                </div>

                {execState.error && (
                  <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 mb-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Ошибка выполнения</span>
                    </div>
                    <pre className="text-[11px] font-mono text-rose-300 whitespace-pre-wrap">
                      {execState.error}
                    </pre>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1.5">
                    <span>Исходящие данные (Output):</span>
                  </div>
                  <pre className="bg-[#181B2B] text-slate-200 font-mono text-[11px] p-3 rounded-xl border border-white/5 overflow-x-auto max-h-72">
                    {JSON.stringify(execState.output || {}, null, 2)}
                  </pre>
                </div>
              </>
            ) : (
              <div className="p-6 text-center text-slate-500 text-xs">
                Узел еще не выполнялся в текущей сессии. Нажмите «Запустить» в верхнем тулбаре.
              </div>
            )}
          </div>
        )}

        {/* ВКЛАДКА 3: AI COPILOT */}
        {activeTab === 'copilot' && (
          <div className="flex flex-col h-full space-y-3">
            {/* Карточка статуса ассистента */}
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-900/30 to-indigo-900/20 border border-purple-500/30 shrink-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>AI Workflow Copilot</span>
                </div>
                <button
                  onClick={() =>
                    setCopilotMessages([
                      {
                        id: 'welcome',
                        role: 'assistant',
                        content: 'Диалог очищен. Напишите новую задачу для Copilot!',
                      },
                    ])
                  }
                  title="Очистить диалог"
                  className="text-[10px] text-slate-400 hover:text-white hover:underline"
                >
                  Очистить
                </button>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {selectedNode
                  ? `Контекст: узел «${label}» (${nodeType}) и граф холста.`
                  : 'Контекст: весь граф сценария.'}
              </p>
            </div>

            {/* Сообщения чата */}
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[380px] pr-1">
              {copilotMessages.map((msg) => (
                <div key={msg.id} className="space-y-2">
                  <div
                    className={`flex gap-2 text-xs p-3 rounded-xl border ${
                      msg.role === 'user'
                        ? 'bg-purple-950/20 border-purple-500/20 ml-4 text-slate-100'
                        : 'bg-[#181B2B] border-white/5 mr-2 text-slate-200'
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      {msg.role === 'user' ? (
                        <User className="w-3.5 h-3.5 text-purple-400" />
                      ) : (
                        <Bot className="w-3.5 h-3.5 text-cyan-400" />
                      )}
                    </div>
                    <div className="flex-1 whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </div>
                  </div>

                  {/* Карточка предложенных действий (Actions) */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-2 ml-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-purple-300 flex items-center gap-1">
                          <Cpu className="w-3.5 h-3.5" />
                          Предложенные действия ({msg.actions.length})
                        </span>
                        {msg.applied && (
                          <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                            <Check className="w-3 h-3" /> Применено
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        {msg.actions.map((act: any, i: number) => (
                          <div
                            key={i}
                            className="text-[10px] font-mono p-1.5 rounded bg-[#12141F] border border-white/5 text-slate-300"
                          >
                            {act.action === 'add_node' && (
                              <span className="text-emerald-400">
                                + Добавить: {act.label || act.type} ({act.type})
                              </span>
                            )}
                            {act.action === 'modify_node' && (
                              <span className="text-amber-400">
                                ✎ Изменить узел: {act.nodeId}
                              </span>
                            )}
                            {act.action === 'connect_nodes' && (
                              <span className="text-cyan-400">
                                → Соединить: {act.source} → {act.target}
                              </span>
                            )}
                            {act.action === 'remove_node' && (
                              <span className="text-rose-400">
                                ✕ Удалить узел: {act.nodeId}
                              </span>
                            )}
                            {act.action === 'explain' && (
                              <span className="text-slate-300">
                                ℹ {act.text}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {!msg.applied ? (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handleApplyActions(msg.id, msg.actions!)}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-medium transition-colors text-center"
                          >
                            Применить к холсту
                          </button>
                          <button
                            onClick={() =>
                              setCopilotMessages((prev) =>
                                prev.map((m) =>
                                  m.id === msg.id ? { ...m, actions: undefined } : m
                                )
                              )
                            }
                            className="py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 text-[11px] font-medium transition-colors"
                          >
                            Отклонить
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={undo}
                          className="w-full py-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 text-[10px] flex items-center justify-center gap-1 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Отменить применение (Undo)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {isCopilotLoading && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-[#181B2B] border border-white/5 text-xs text-purple-300">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                  <span>Copilot генерирует ответ и проверяет граф...</span>
                </div>
              )}
            </div>

            {/* Поле ввода запроса */}
            <div className="space-y-1.5 pt-2 border-t border-white/5 shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Добавь узел LLM, соедини с условием..."
                  value={copilotInput}
                  disabled={isCopilotLoading}
                  onChange={(e) => setCopilotInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendCopilot();
                    }
                  }}
                  className="flex-1 bg-[#181B2B] text-xs text-slate-200 px-3 py-2 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                />
                <button
                  onClick={handleSendCopilot}
                  disabled={isCopilotLoading || !copilotInput.trim()}
                  className="p-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white transition-colors"
                  title="Отправить запрос"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-[10px] text-slate-500 flex justify-between px-1">
                <span>Enter для отправки</span>
                <span>NeuroFlow AI Engine</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
