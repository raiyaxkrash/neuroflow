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
import { AiGeneratorModal } from './ai-generator-modal';

export function EditorToolbar() {
  const [isAiModalOpen, setIsAiModalOpen] = React.useState(false);
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
  const setGraph = useWorkflowStore((s) => s.setGraph);
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
    <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between z-20 text-card-foreground shadow-sm transition-colors">
      {/* Левая часть: кнопка назад и имя */}
      <div className="flex items-center gap-3">
        <Link
          href="/workflows"
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Все сценарии"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="bg-transparent font-medium text-foreground hover:bg-muted/50 focus:bg-background px-2 py-1 rounded-md text-sm border border-transparent focus:border-border outline-none transition-colors"
          />
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
            v{workflowVersion}
          </span>
        </div>

        {/* Статус автосохранения */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-2">
          {isSaving ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
              <span>Сохранение...</span>
            </>
          ) : isDirty ? (
            <span className="text-status-warning">• Не сохранено</span>
          ) : (
            <>
              <Check className="w-3 h-3 text-status-success" />
              <span>Сохранено</span>
            </>
          )}
        </div>
      </div>

      {/* Правая часть: действия */}
      <div className="flex items-center gap-2">
        {/* Undo / Redo */}
        <div className="flex items-center bg-muted/60 border border-border rounded-lg p-0.5">
          <button
            onClick={undo}
            disabled={past.length === 0}
            className="p-1.5 rounded hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Отменить (Ctrl+Z)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={redo}
            disabled={future.length === 0}
            className="p-1.5 rounded hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Повторить (Ctrl+Y)"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* AI Генератор воркфлоу */}
        <button
          onClick={() => setIsAiModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:opacity-90 border border-border text-foreground text-xs font-medium transition-opacity cursor-pointer shadow-sm"
          title="Сгенерировать воркфлоу с помощью ИИ"
        >
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>AI Генератор</span>
        </button>

        {/* Кнопка сохранения */}
        <button
          onClick={handleSave}
          disabled={isSaving || !isDirty}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 border border-border text-xs font-medium text-foreground disabled:opacity-50 transition-colors shadow-sm"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Сохранить</span>
        </button>

        {/* Кнопка запуска Execute */}
        <button
          onClick={handleExecute}
          disabled={isExecuting}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold shadow-sm disabled:opacity-60 transition-opacity cursor-pointer"
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

      {/* Модальное окно генератора сценариев */}
      <AiGeneratorModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onApplyGraph={(graph, name) => {
          if (name) setWorkflowName(name);
          const newNodes = (graph.nodes || []).map((n: any) => ({
            id: n.id,
            type: 'custom',
            position: n.position || { x: 150, y: 150 },
            data: {
              ...n.data,
              type: n.type,
            },
          }));
          const newEdges = (graph.edges || []).map((e: any) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle || null,
            targetHandle: e.targetHandle || null,
            type: 'smoothstep',
            animated: false,
          }));
          setGraph(newNodes, newEdges);
        }}
      />
    </header>
  );
}
