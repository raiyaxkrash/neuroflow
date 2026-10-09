'use client';

import React from 'react';
import {
  Play,
  RotateCcw,
  RotateCw,
  Save,
  Check,
  Loader2,
  ArrowLeft,
  Settings,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useWorkflowStore } from '@/store/workflow-store';
import { api } from '@/lib/api-client';

export function EditorToolbar() {
  const workflowId = useWorkflowStore((s) => s.workflowId);
  const workflowName = useWorkflowStore((s) => s.workflowName);
  const workflowVersion = useWorkflowStore((s) => s.workflowVersion);
  const setWorkflowName = useWorkflowStore((s) => s.setWorkflowName);
  const isSaving = useWorkflowStore((s) => s.isSaving);
  const isDirty = useWorkflowStore((s) => s.isDirty);
  const isExecuting = useWorkflowStore((s) => s.isExecuting);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const past = useWorkflowStore((s) => s.past);
  const future = useWorkflowStore((s) => s.future);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const setIsSaving = useWorkflowStore((s) => s.setIsSaving);
  const setIsExecuting = useWorkflowStore((s) => s.setIsExecuting);
  const setNodeExecutionState = useWorkflowStore((s) => s.setNodeExecutionState);
  const resetExecutionState = useWorkflowStore((s) => s.resetExecutionState);

  // Ручное сохранение
  const handleSave = async () => {
    if (!workflowId) return;
    setIsSaving(true);
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

      await api.updateWorkflow(workflowId, {
        name: workflowName,
        graph,
      });
      useWorkflowStore.setState({ isDirty: false });
    } catch (err: any) {
      alert(`Ошибка при сохранении: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Запуск воркфлоу
  const handleExecute = async () => {
    if (!workflowId || isExecuting) return;

    // Сначала автосохраняем при наличии несохраненных правок
    if (isDirty) {
      await handleSave();
    }

    resetExecutionState();
    setIsExecuting(true);

    try {
      const result = await api.executeWorkflow(workflowId);
      const executionId = result.executionId;

      // Подключаемся к SSE стриму или опрашиваем статус
      const eventSource = new EventSource(`/api/executions/${executionId}/stream`);

      eventSource.addEventListener('node:start', (e: any) => {
        const payload = JSON.parse(e.data);
        setNodeExecutionState(payload.nodeId, { status: 'running' });
      });

      eventSource.addEventListener('node:complete', (e: any) => {
        const payload = JSON.parse(e.data);
        setNodeExecutionState(payload.nodeId, {
          status: 'success',
          output: payload.output,
          durationMs: payload.durationMs,
          selectedPort: payload.selectedPort,
        });
      });

      eventSource.addEventListener('node:failed', (e: any) => {
        const payload = JSON.parse(e.data);
        setNodeExecutionState(payload.nodeId, {
          status: 'failed',
          error: payload.error,
          durationMs: payload.durationMs,
        });
      });

      eventSource.addEventListener('node:skipped', (e: any) => {
        const payload = JSON.parse(e.data);
        setNodeExecutionState(payload.nodeId, {
          status: 'skipped',
        });
      });

      eventSource.addEventListener('execution:complete', (e: any) => {
        setIsExecuting(false);
        eventSource.close();
      });

      eventSource.onerror = () => {
        setIsExecuting(false);
        eventSource.close();
      };
    } catch (err: any) {
      alert(`Ошибка при запуске воркфлоу: ${err.message}`);
      setIsExecuting(false);
    }
  };

  return (
    <header className="h-14 border-b border-white/10 bg-[#12141F] px-4 flex items-center justify-between z-20">
      {/* Левая часть: кнопка назад и имя */}
      <div className="flex items-center gap-3">
        <Link
          href="/workflows"
          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          title="Все сценарии"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="bg-transparent font-medium text-slate-100 hover:bg-white/5 focus:bg-[#181B2B] px-2 py-1 rounded-md text-sm border border-transparent focus:border-purple-500/50 outline-none transition-colors"
          />
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/5">
            v{workflowVersion}
          </span>
        </div>

        {/* Статус автосохранения */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 pl-2">
          {isSaving ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
              <span>Сохранение...</span>
            </>
          ) : isDirty ? (
            <span className="text-amber-400/80">• Не сохранено</span>
          ) : (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-slate-400">Сохранено</span>
            </>
          )}
        </div>
      </div>

      {/* Правая часть: действия */}
      <div className="flex items-center gap-2">
        {/* Undo / Redo */}
        <div className="flex items-center bg-[#181B2B] border border-white/5 rounded-lg p-0.5">
          <button
            onClick={undo}
            disabled={past.length === 0}
            className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Отменить (Ctrl+Z)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={redo}
            disabled={future.length === 0}
            className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Повторить (Ctrl+Y)"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Кнопка сохранения */}
        <button
          onClick={handleSave}
          disabled={isSaving || !isDirty}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181B2B] border border-white/10 text-xs font-medium text-slate-200 hover:bg-white/10 disabled:opacity-50 transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Сохранить</span>
        </button>

        {/* Кнопка запуска Execute */}
        <button
          onClick={handleExecute}
          disabled={isExecuting}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 disabled:opacity-60 transition-all cursor-pointer"
        >
          {isExecuting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Выполнение...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Запустить</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
