'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  Play,
  Globe,
  GitBranch,
  Database,
  Clock,
  CheckCircle2,
  Copy,
  Trash2,
  AlertCircle,
  Loader2,
  Sparkles,
  Bot,
  Network,
  ArrowRightLeft,
  Brain,
  Wrench,
  ShieldAlert,
  Plug,
} from 'lucide-react';
import { useWorkflowStore } from '@/store/workflow-store';

const iconMap: Record<string, React.ReactNode> = {
  'manual-trigger': <Play className="w-4 h-4 text-purple-400" />,
  'http-request': <Globe className="w-4 h-4 text-cyan-400" />,
  'condition': <GitBranch className="w-4 h-4 text-amber-400" />,
  'set-data': <Database className="w-4 h-4 text-emerald-400" />,
  'delay': <Clock className="w-4 h-4 text-indigo-400" />,
  'output': <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  'ai-model': <Sparkles className="w-4 h-4 text-pink-400" />,
  'ai-agent': <Bot className="w-4 h-4 text-cyan-400" />,
  'agent-supervisor': <Network className="w-4 h-4 text-blue-400" />,
  'agent-handoff': <ArrowRightLeft className="w-4 h-4 text-amber-400" />,
  'agent-memory': <Brain className="w-4 h-4 text-emerald-400" />,
  'tool-executor': <Wrench className="w-4 h-4 text-pink-400" />,
  'human-approval': <ShieldAlert className="w-4 h-4 text-rose-400" />,
  'mcp-tool': <Plug className="w-4 h-4 text-indigo-400" />,
};

const categoryLabels: Record<string, string> = {
  'manual-trigger': 'Trigger',
  'http-request': 'Action',
  'condition': 'Logic',
  'set-data': 'Data',
  'delay': 'Utility',
  'output': 'Result',
  'ai-model': 'AI / LLM',
  'ai-agent': 'AI Agent',
  'agent-supervisor': 'Supervisor',
  'agent-handoff': 'Handoff',
  'agent-memory': 'Memory',
  'tool-executor': 'Tool',
  'human-approval': 'Approval',
  'mcp-tool': 'MCP Tool',
};

export const CustomNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeType = (data.type as string) || 'manual-trigger';
  const label = (data.label as string) || 'Node';
  const isTrigger = nodeType === 'manual-trigger';
  const isCondition = nodeType === 'condition';

  const nodeExecState = useWorkflowStore((s) => s.nodeExecStates[id]);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);

  const status = nodeExecState?.status;
  const durationMs = nodeExecState?.durationMs;

  let statusRingClass = 'border-white/10 hover:border-white/20';
  if (selected) {
    statusRingClass = 'border-purple-500 ring-2 ring-purple-500/20 shadow-lg shadow-purple-500/10';
  }

  if (status === 'waiting_for_approval') {
    statusRingClass = 'border-amber-500 ring-2 ring-amber-500/30 shadow-lg shadow-amber-500/20 animate-pulse';
  } else if (status === 'running') {
    statusRingClass = 'border-cyan-500 ring-2 ring-cyan-500/30 shadow-lg shadow-cyan-500/20 animate-pulse';
  } else if (status === 'success') {
    statusRingClass = 'border-emerald-500/80 shadow-md shadow-emerald-500/10';
  } else if (status === 'failed') {
    statusRingClass = 'border-rose-500 shadow-md shadow-rose-500/20';
  } else if (status === 'skipped') {
    statusRingClass = 'border-zinc-700/60 opacity-60';
  }

  return (
    <div
      className={`relative min-w-[240px] max-w-[280px] rounded-xl bg-[#12141F] border backdrop-blur-md p-3 transition-all duration-150 ${statusRingClass}`}
    >
      {/* Входной Handle слева (если не триггер) */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Left}
          id="main"
          className="!w-3 !h-3 !bg-purple-500 !border-2 !border-[#0D0E15] hover:!scale-125 transition-transform"
        />
      )}

      {/* Шапка узла */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#181B2B] flex items-center justify-center border border-white/5">
            {iconMap[nodeType] || <Play className="w-4 h-4 text-purple-400" />}
          </div>
          <div className="truncate">
            <div className="text-xs font-semibold text-slate-100 truncate">{label}</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">
              {categoryLabels[nodeType] || 'Node'}
            </div>
          </div>
        </div>

        {/* Быстрые действия при выделении */}
        {selected && (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                duplicateNode(id);
              }}
              title="Дублировать (Ctrl+D)"
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteNode(id);
              }}
              title="Удалить (Del)"
              className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Инфо бейдж для AI узла */}
      {nodeType === 'ai-model' && (
        <div className="mb-2 px-2 py-1 rounded bg-[#181B2B] border border-white/5 flex items-center justify-between text-[10px]">
          <span className="text-pink-300 font-mono truncate max-w-[130px]">
            {((data.parameters as any)?.model) || 'gpt-4o-mini'}
          </span>
          <span className="text-slate-400 uppercase text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5">
            {((data.parameters as any)?.provider) || 'openai'}
          </span>
        </div>
      )}

      {/* Статус выполнения блока */}
      {status && (
        <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5">
            {status === 'waiting_for_approval' && (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                <span className="text-amber-400 font-medium">Waiting Approval</span>
              </>
            )}
            {status === 'running' && (
              <>
                <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
                <span className="text-cyan-400 font-medium">Running...</span>
              </>
            )}
            {status === 'success' && (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-emerald-400 font-medium">Success</span>
              </>
            )}
            {status === 'failed' && (
              <>
                <AlertCircle className="w-3 h-3 text-rose-400" />
                <span className="text-rose-400 font-medium">Failed</span>
              </>
            )}
            {status === 'skipped' && (
              <>
                <div className="w-2 h-2 rounded-full bg-zinc-500" />
                <span className="text-zinc-400">Skipped</span>
              </>
            )}
          </div>

          {durationMs !== undefined && (
            <span className="text-[10px] text-slate-400 font-mono">{durationMs}ms</span>
          )}
        </div>
      )}

      {/* Выходные Handles справа */}
      {isCondition ? (
        <>
          {/* Порт True */}
          <div className="absolute -right-3 top-4 flex items-center gap-1">
            <span className="text-[9px] font-mono font-bold text-emerald-400 -ml-7 select-none">TRUE</span>
            <Handle
              type="source"
              position={Position.Right}
              id="true"
              className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-[#0D0E15] hover:!scale-125 transition-transform"
            />
          </div>
          {/* Порт False */}
          <div className="absolute -right-3 bottom-4 flex items-center gap-1">
            <span className="text-[9px] font-mono font-bold text-rose-400 -ml-9 select-none">FALSE</span>
            <Handle
              type="source"
              position={Position.Right}
              id="false"
              className="!w-3 !h-3 !bg-rose-500 !border-2 !border-[#0D0E15] hover:!scale-125 transition-transform"
            />
          </div>
        </>
      ) : nodeType === 'human-approval' ? (
        <>
          {/* Порт Approved */}
          <div className="absolute -right-3 top-4 flex items-center gap-1">
            <span className="text-[9px] font-mono font-bold text-emerald-400 -ml-12 select-none">APPROVE</span>
            <Handle
              type="source"
              position={Position.Right}
              id="approved"
              className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-[#0D0E15] hover:!scale-125 transition-transform"
            />
          </div>
          {/* Порт Rejected */}
          <div className="absolute -right-3 bottom-4 flex items-center gap-1">
            <span className="text-[9px] font-mono font-bold text-rose-400 -ml-10 select-none">REJECT</span>
            <Handle
              type="source"
              position={Position.Right}
              id="rejected"
              className="!w-3 !h-3 !bg-rose-500 !border-2 !border-[#0D0E15] hover:!scale-125 transition-transform"
            />
          </div>
        </>
      ) : nodeType === 'ai-agent' ? (
        <>
          {/* Порт Main */}
          <div className="absolute -right-3 top-4 flex items-center gap-1">
            <span className="text-[9px] font-mono text-cyan-400 -ml-8 select-none">OUT</span>
            <Handle
              type="source"
              position={Position.Right}
              id="main"
              className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-[#0D0E15] hover:!scale-125 transition-transform"
            />
          </div>
          {/* Порт Handoff */}
          <div className="absolute -right-3 bottom-4 flex items-center gap-1">
            <span className="text-[9px] font-mono text-amber-400 -ml-12 select-none">HANDOFF</span>
            <Handle
              type="source"
              position={Position.Right}
              id="handoff"
              className="!w-3 !h-3 !bg-amber-500 !border-2 !border-[#0D0E15] hover:!scale-125 transition-transform"
            />
          </div>
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          id="main"
          className="!w-3 !h-3 !bg-purple-500 !border-2 !border-[#0D0E15] hover:!scale-125 transition-transform"
        />
      )}
    </div>
  );
});

CustomNode.displayName = 'CustomNode';
