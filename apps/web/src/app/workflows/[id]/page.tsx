'use client';

import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ReactFlowProvider } from '@xyflow/react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useWorkflowStore } from '@/store/workflow-store';
import { EditorToolbar } from '@/components/editor/toolbar';
import { NodePalette } from '@/components/editor/node-palette';
import { WorkflowCanvas } from '@/components/canvas/workflow-canvas';
import { Inspector } from '@/components/editor/inspector';

export default function WorkflowEditorPage() {
  const params = useParams();
  const id = params?.id as string;

  const setWorkflow = useWorkflowStore((s) => s.setWorkflow);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);

  const { data: workflow, isLoading, error } = useQuery({
    queryKey: ['workflow', id],
    queryFn: () => api.getWorkflow(id),
    enabled: !!id,
  });

  useEffect(() => {
    if (workflow) {
      setWorkflow(workflow);
    }
  }, [workflow, setWorkflow]);

  // Глобальные горячие клавиши
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Игнорируем клавиши при вводе в текстовые поля
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedNodeId) {
        e.preventDefault();
        duplicateNode(selectedNodeId);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
        e.preventDefault();
        deleteNode(selectedNodeId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, undo, redo, duplicateNode, deleteNode]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="text-sm font-medium">Загрузка редактора сценария...</span>
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
        <div className="text-center p-8 bg-card rounded-2xl border border-border max-w-md shadow-xl">
          <div className="text-status-error font-semibold mb-2">Не удалось открыть воркфлоу</div>
          <p className="text-xs text-muted-foreground mb-4">
            {(error as any)?.message || 'Сценарий не найден или был удален'}
          </p>
          <a
            href="/workflows"
            className="px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground rounded-lg text-xs font-semibold"
          >
            Вернуться к списку
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground">
      <EditorToolbar />

      <div className="flex-1 flex overflow-hidden relative">
        <ReactFlowProvider>
          {/* Левая панель: библиотека блоков */}
          <NodePalette />

          {/* Холст графа */}
          <main className="flex-1 h-full relative">
            <WorkflowCanvas />
          </main>

          {/* Правая панель: инспектор выбранного узла */}
          <Inspector />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
