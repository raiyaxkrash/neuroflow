'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Target,
  GitFork,
  Brain,
  Globe,
  Blocks,
  Activity,
  KeyRound,
  Settings,
  Sun,
  Moon,
  Plus,
  Search,
  ArrowRight,
} from 'lucide-react';
import { useTheme } from '@/components/theme-provider';

interface CommandItem {
  id: string;
  title: string;
  category: 'Навигация' | 'Действия';
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: CommandItem[] = useMemo(() => [
    {
      id: 'nav-overview',
      title: 'Обзор системы (Dashboard)',
      category: 'Навигация',
      icon: LayoutDashboard,
      shortcut: 'G O',
      action: () => {
        router.push('/overview');
        onClose();
      },
    },
    {
      id: 'nav-missions',
      title: 'Миссии и Агенты (Autonomous Missions)',
      category: 'Навигация',
      icon: Target,
      shortcut: 'G M',
      action: () => {
        router.push('/missions');
        onClose();
      },
    },
    {
      id: 'nav-workflows',
      title: 'Сценарии и Воркфлоу (Workflows)',
      category: 'Навигация',
      icon: GitFork,
      shortcut: 'G W',
      action: () => {
        router.push('/workflows');
        onClose();
      },
    },
    {
      id: 'nav-knowledge',
      title: 'Second Brain (База знаний и RAG)',
      category: 'Навигация',
      icon: Brain,
      shortcut: 'G K',
      action: () => {
        router.push('/knowledge');
        onClose();
      },
    },
    {
      id: 'nav-browser',
      title: 'Браузерные сессии (Playwright Agent)',
      category: 'Навигация',
      icon: Globe,
      shortcut: 'G B',
      action: () => {
        router.push('/browser-sessions');
        onClose();
      },
    },
    {
      id: 'nav-integrations',
      title: 'MCP Hub и Интеграции (Model Context Protocol)',
      category: 'Навигация',
      icon: Blocks,
      shortcut: 'G I',
      action: () => {
        router.push('/integrations');
        onClose();
      },
    },
    {
      id: 'nav-executions',
      title: 'Журнал выполнений и логи (Executions & Logs)',
      category: 'Навигация',
      icon: Activity,
      shortcut: 'G E',
      action: () => {
        router.push('/executions');
        onClose();
      },
    },
    {
      id: 'nav-credentials',
      title: 'Учетные данные и API ключи (Credentials)',
      category: 'Навигация',
      icon: KeyRound,
      shortcut: 'G C',
      action: () => {
        router.push('/credentials');
        onClose();
      },
    },
    {
      id: 'nav-settings',
      title: 'Системные настройки (Settings)',
      category: 'Навигация',
      icon: Settings,
      shortcut: 'G S',
      action: () => {
        router.push('/settings');
        onClose();
      },
    },
    {
      id: 'act-new-workflow',
      title: 'Создать новый сценарий',
      category: 'Действия',
      icon: Plus,
      action: () => {
        router.push('/workflows');
        onClose();
      },
    },
    {
      id: 'act-toggle-theme',
      title: `Переключить тему (${theme === 'dark' ? 'Включить светлую' : 'Включить тёмную'})`,
      category: 'Действия',
      icon: theme === 'dark' ? Sun : Moon,
      shortcut: '⌘T',
      action: () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
        onClose();
      },
    },
  ], [router, onClose, theme, setTheme]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return commands;
    return commands.filter((c) =>
      c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open handled by caller or state
        }
      }
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, filtered, selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-card border border-border shadow-2xl rounded-2xl overflow-hidden text-card-foreground"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Командная строка и навигация"
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-muted/40">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти раздел, команду или действие..."
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none border-none focus:ring-0"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Ничего не найдено по запросу &laquo;{query}&raquo;
            </div>
          ) : (
            filtered.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left text-xs transition-colors ${
                    isSelected
                      ? 'bg-secondary text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate">
                      <span className="text-foreground">{item.title}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground">
                        {item.category}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.shortcut && (
                      <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground border border-border/60">
                        {item.shortcut}
                      </kbd>
                    )}
                    {isSelected && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 py-2.5 bg-muted/30 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>↑↓ Навигация</span>
            <span>↵ Выбор</span>
            <span>ESC Закрыть</span>
          </div>
          <span className="font-mono text-[10px]">NeuroFlow Studio</span>
        </div>
      </div>
    </div>
  );
}
