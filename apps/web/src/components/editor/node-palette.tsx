'use client';

import React, { useState } from 'react';
import {
  Play,
  Globe,
  GitBranch,
  Database,
  Clock,
  CheckCircle2,
  Search,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useWorkflowStore } from '@/store/workflow-store';

interface NodeItem {
  type: string;
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  color: string;
}

const availableNodes: NodeItem[] = [
  {
    type: 'manual-trigger',
    name: 'Manual Trigger',
    description: 'Ручной запуск сценария',
    category: 'trigger',
    icon: <Play className="w-4 h-4 text-purple-400" />,
    color: '#8B5CF6',
  },
  {
    type: 'http-request',
    name: 'HTTP Request',
    description: 'Безопасный HTTP запрос с защитой от SSRF',
    category: 'action',
    icon: <Globe className="w-4 h-4 text-cyan-400" />,
    color: '#06B6D4',
  },
  {
    type: 'condition',
    name: 'Condition',
    description: 'Разветвление на ветки True и False',
    category: 'logic',
    icon: <GitBranch className="w-4 h-4 text-amber-400" />,
    color: '#F59E0B',
  },
  {
    type: 'set-data',
    name: 'Set Data',
    description: 'Создание и модификация JSON полей',
    category: 'data',
    icon: <Database className="w-4 h-4 text-emerald-400" />,
    color: '#10B981',
  },
  {
    type: 'delay',
    name: 'Delay',
    description: 'Неблокирующая задержка по таймеру',
    category: 'utility',
    icon: <Clock className="w-4 h-4 text-indigo-400" />,
    color: '#6366F1',
  },
  {
    type: 'output',
    name: 'Output',
    description: 'Фиксация и просмотр результата',
    category: 'data',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    color: '#10B981',
  },
  {
    type: 'ai-model',
    name: 'AI Model',
    description: 'Интеллектуальная обработка и LLM (OpenAI, Gemini, Anthropic, Ollama, REST)',
    category: 'ai',
    icon: <Sparkles className="w-4 h-4 text-pink-400" />,
    color: '#EC4899',
  },
];

const categories = [
  { id: 'all', label: 'Все' },
  { id: 'ai', label: 'AI' },
  { id: 'trigger', label: 'Триггеры' },
  { id: 'action', label: 'Действия' },
  { id: 'logic', label: 'Логика' },
  { id: 'data', label: 'Данные' },
];

export function NodePalette() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const addNode = useWorkflowStore((s) => s.addNode);
  const setActiveInspectorTab = useWorkflowStore((s) => s.setActiveInspectorTab);

  const filteredNodes = availableNodes.filter((n) => {
    const matchesSearch =
      n.name.toLowerCase().includes(search.toLowerCase()) ||
      n.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || n.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/neuroflow-node', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-72 border-r border-white/10 bg-[#12141F] flex flex-col h-full select-none z-10">
      <div className="p-4 border-b border-white/5 space-y-3">
        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Библиотека узлов
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Поиск блоков..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#181B2B] text-xs text-slate-200 pl-8 pr-3 py-1.5 rounded-lg border border-white/5 focus:border-purple-500/50 outline-none transition-colors"
          />
        </div>

        {/* Фильтры категорий */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Список узлов */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredNodes.map((node) => (
          <div
            key={node.type}
            draggable
            onDragStart={(e) => onDragStart(e, node.type)}
            onClick={() => addNode(node.type)}
            className="group flex items-start gap-3 p-2.5 rounded-xl bg-[#181B2B]/60 hover:bg-[#181B2B] border border-white/5 hover:border-purple-500/30 cursor-grab active:cursor-grabbing transition-all hover:shadow-md"
          >
            <div className="w-8 h-8 rounded-lg bg-[#12141F] border border-white/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              {node.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-100 group-hover:text-purple-300 transition-colors">
                  {node.name}
                </span>
                <Plus className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                {node.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* AI Copilot активатор */}
      <div
        onClick={() => setActiveInspectorTab('copilot')}
        className="p-3 m-3 rounded-xl bg-purple-950/20 hover:bg-purple-950/40 border border-purple-500/20 hover:border-purple-500/40 cursor-pointer transition-all"
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300 mb-1">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>AI Workflow Copilot</span>
        </div>
        <p className="text-[10px] text-slate-400 leading-normal">
          Нажмите, чтобы открыть чат с ассистентом для модификации и объяснения графа.
        </p>
      </div>
    </aside>
  );
}
