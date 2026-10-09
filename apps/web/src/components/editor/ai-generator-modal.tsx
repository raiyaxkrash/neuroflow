'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Loader2,
  Check,
  AlertCircle,
  Layers,
  ArrowRight,
  Cpu,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api-client';

interface AiGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyGraph?: (graph: { nodes: any[]; edges: any[] }, name?: string) => void;
  onCreateWorkflow?: (created: any) => void;
}

export function AiGeneratorModal({
  isOpen,
  onClose,
  onApplyGraph,
  onCreateWorkflow,
}: AiGeneratorModalProps) {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!prompt.trim() || isLoading) return;
    setIsLoading(true);
    setError(null);
    setGeneratedResult(null);

    try {
      const res = await api.generateWorkflow({ prompt: prompt.trim() });
      setGeneratedResult(res);
    } catch (err: any) {
      setError(err.message || 'Ошибка при генерации сценария с AI');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = async () => {
    if (!generatedResult) return;

    if (onApplyGraph) {
      // Применяем граф прямо к текущему открытому холсту
      onApplyGraph(generatedResult.graph, generatedResult.name);
      onClose();
    } else if (onCreateWorkflow) {
      // Создаем новый воркфлоу в БД и переходим к нему
      try {
        setIsLoading(true);
        const created = await api.createWorkflow({
          name: generatedResult.name || 'AI Generated Workflow',
          description: generatedResult.description || 'Сгенерировано с помощью NeuroFlow AI',
          graph: generatedResult.graph,
        });
        onCreateWorkflow(created);
        onClose();
      } catch (err: any) {
        setError(err.message || 'Ошибка сохранения воркфлоу');
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#12141F] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Шапка модального окна */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-purple-900/30 to-indigo-900/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">AI Workflow Generator</h3>
              <p className="text-xs text-slate-400">
                Опишите задачу на естественном языке, и движок построит валидный граф сценария
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Тело */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Текстовое поле ввода */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">
              Что должен делать сценарий?
            </label>
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Например: Сделай воркфлоу, который получает курсы валют через HTTP GET, проверяет условие если курс выше 100, и отправляет резюме через узел AI Model."
              className="w-full bg-[#181B2B] text-xs text-slate-200 p-3 rounded-xl border border-white/5 focus:border-purple-500/50 outline-none leading-relaxed"
            />
          </div>

          {/* Быстрые примеры промптов */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-slate-400">Готовые шаблоны:</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                'HTTP запрос к API и анализ данных с помощью LLM',
                'Обработка входящих данных, условие проверки статуса и задержка 5 сек',
                'Пайплайн суммаризации текста: ввод данных, AI Model и результат',
              ].map((tpl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPrompt(tpl)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 transition-colors text-left"
                >
                  {tpl}
                </button>
              ))}
            </div>
          </div>

          {/* Ошибка */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold">Не удалось сгенерировать сценарий</div>
                <div className="text-[11px] text-rose-300/80 leading-relaxed">{error}</div>
                {error.includes('No AI provider') && (
                  <Link
                    href="/settings"
                    className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:underline pt-1"
                  >
                    <Settings className="w-3 h-3" /> Настроить AI провайдер в Settings
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Результат генерации */}
          {generatedResult && (
            <div className="p-4 rounded-xl bg-[#181B2B] border border-purple-500/30 space-y-3">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div>
                  <h4 className="text-xs font-semibold text-white">{generatedResult.name}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{generatedResult.description}</p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-purple-300 px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20">
                  <Layers className="w-3 h-3" />
                  <span>{generatedResult.graph?.nodes?.length || 0} узлов</span>
                </div>
              </div>

              {/* Цепочка шагов */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-slate-300">Сгенерированные шаги:</span>
                <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto pr-1">
                  {(generatedResult.graph?.nodes || []).map((node: any, idx: number) => (
                    <div
                      key={node.id || idx}
                      className="p-2 rounded-lg bg-[#12141F] border border-white/5 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-500 w-4">{idx + 1}.</span>
                        <span className="font-medium text-slate-200">
                          {node.data?.label || node.type}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-white/5">
                          {node.type}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Футер */}
        <div className="p-4 border-t border-white/5 bg-[#0D0E15] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 transition-colors"
          >
            Отмена
          </button>

          <div className="flex items-center gap-2">
            {!generatedResult ? (
              <button
                onClick={handleGenerate}
                disabled={isLoading || !prompt.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Генерация структуры...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Сгенерировать</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleApply}
                disabled={isLoading}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{onApplyGraph ? 'Вставить на холст' : 'Создать сценарий'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
