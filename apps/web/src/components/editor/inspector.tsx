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
} from 'lucide-react';
import { useWorkflowStore } from '@/store/workflow-store';

export function Inspector() {
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const nodes = useWorkflowStore((s) => s.nodes);
  const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);
  const updateNodeParameters = useWorkflowStore((s) => s.updateNodeParameters);
  const updateNodeLabel = useWorkflowStore((s) => s.updateNodeLabel);
  const activeTab = useWorkflowStore((s) => s.activeInspectorTab);
  const setActiveTab = useWorkflowStore((s) => s.setActiveInspectorTab);
  const nodeExecStates = useWorkflowStore((s) => s.nodeExecStates);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  if (!selectedNode) {
    return (
      <aside className="w-80 border-l border-white/10 bg-[#12141F] flex flex-col h-full select-none p-6 text-center text-slate-400 justify-center items-center z-10">
        <div className="w-12 h-12 rounded-2xl bg-[#181B2B] border border-white/5 flex items-center justify-center mb-3 text-slate-500">
          <Settings2 className="w-6 h-6" />
        </div>
        <div className="text-sm font-medium text-slate-300">Узел не выбран</div>
        <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
          Нажмите на любой узел на холсте, чтобы настроить его параметры и просмотреть данные.
        </p>
      </aside>
    );
  }

  const nodeType = (selectedNode.data?.type as string) || 'manual-trigger';
  const label = (selectedNode.data?.label as string) || 'Node';
  const params = (selectedNode.data?.parameters as Record<string, any>) || {};
  const execState = nodeExecStates[selectedNode.id];

  return (
    <aside className="w-84 border-l border-white/10 bg-[#12141F] flex flex-col h-full z-10">
      {/* Шапка инспектора */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={label}
            onChange={(e) => updateNodeLabel(selectedNode.id, e.target.value)}
            className="bg-transparent font-medium text-sm text-slate-100 hover:bg-white/5 focus:bg-[#181B2B] px-1.5 py-0.5 rounded border border-transparent focus:border-purple-500/50 outline-none w-full"
          />
          <div className="text-[10px] text-slate-400 font-mono pl-1.5">
            ID: {selectedNode.id}
          </div>
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
                      updateNodeParameters(selectedNode.id, { initialPayload: parsed });
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
                    onChange={(e) => updateNodeParameters(selectedNode.id, { method: e.target.value })}
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
                    onChange={(e) => updateNodeParameters(selectedNode.id, { url: e.target.value })}
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
                      updateNodeParameters(selectedNode.id, { timeoutMs: Number(e.target.value) * 1000 })
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
                    onChange={(e) => updateNodeParameters(selectedNode.id, { leftValue: e.target.value })}
                    className="w-full bg-[#181B2B] font-mono text-xs text-slate-200 p-2 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Оператор:
                  </label>
                  <select
                    value={params.operator || 'equals'}
                    onChange={(e) => updateNodeParameters(selectedNode.id, { operator: e.target.value })}
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
                    onChange={(e) => updateNodeParameters(selectedNode.id, { rightValue: e.target.value })}
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
                      updateNodeParameters(selectedNode.id, {
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
                            updateNodeParameters(selectedNode.id, { operations: newOps });
                          }}
                          className="flex-1 bg-[#12141F] font-mono text-[11px] text-slate-200 px-2 py-1 rounded border border-white/5 outline-none"
                        />
                        <select
                          value={op.valueType || 'string'}
                          onChange={(e) => {
                            const newOps = [...(params.operations || [])];
                            newOps[idx] = { ...op, valueType: e.target.value };
                            updateNodeParameters(selectedNode.id, { operations: newOps });
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
                            updateNodeParameters(selectedNode.id, { operations: newOps });
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
                          updateNodeParameters(selectedNode.id, { operations: newOps });
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
                  onChange={(e) => updateNodeParameters(selectedNode.id, { seconds: Number(e.target.value) })}
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
                  onChange={(e) => updateNodeParameters(selectedNode.id, { customKey: e.target.value })}
                  className="w-full bg-[#181B2B] font-mono text-xs text-slate-200 p-2 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
                />
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
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-gradient-to-br from-purple-900/30 to-indigo-900/20 border border-purple-500/30">
              <div className="flex items-center gap-2 text-xs font-semibold text-purple-300 mb-1">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>AI Node Assistant</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Интеллектуальная настройка параметров блока и генерация логики трансформации.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300 block">
                Промпт для агента:
              </label>
              <textarea
                rows={3}
                placeholder="Опишите, что должен делать этот узел..."
                className="w-full bg-[#181B2B] text-xs text-slate-200 p-2.5 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none"
              />
              <button
                disabled
                className="w-full py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-slate-400 cursor-not-allowed text-center"
              >
                Генерация параметров (Фаза 2)
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
