'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Search, Sun, Moon, Bell } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';

interface TopbarProps {
  onOpenCommandPalette: () => void;
}

const routeTitleMap: Record<string, string> = {
  '/overview': 'Обзор системы',
  '/missions': 'Миссии и Агенты',
  '/workflows': 'Сценарии',
  '/knowledge': 'Второй мозг (RAG)',
  '/browser-sessions': 'Браузерные сессии',
  '/integrations': 'MCP Hub & Интеграции',
  '/executions': 'Журнал выполнений',
  '/credentials': 'Учетные данные',
  '/settings': 'Настройки',
};

export function Topbar({ onOpenCommandPalette }: TopbarProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  // Определяем название раздела по pathname
  const currentTitle =
    Object.entries(routeTitleMap).find(([route]) => pathname.startsWith(route))?.[1] ||
    (pathname === '/' ? 'Обзор системы' : 'Раздел');

  return (
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between shrink-0 select-none transition-colors">
      {/* Хлебные крошки */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground font-medium">NeuroFlow</span>
        <span className="text-muted-foreground/60">/</span>
        <span className="font-semibold text-foreground">{currentTitle}</span>
      </div>

      {/* Правая панель действий */}
      <div className="flex items-center gap-2.5">
        {/* Кнопка вызова Command Palette */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-3 px-3 py-1.5 rounded-lg border border-border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground text-xs transition-colors"
          aria-label="Открыть палитру команд"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Поиск и команды</span>
          </div>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground">
            ⌘K
          </kbd>
        </button>

        {/* Переключатель темы */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
          aria-label="Переключить тему оформления"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>

        {/* Уведомления */}
        <button
          className="p-2 rounded-lg border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors relative"
          title="Системные уведомления"
          aria-label="Уведомления"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-card" />
        </button>

        {/* Аватар владельца */}
        <div
          className="w-8 h-8 rounded-lg bg-primary text-primary-foreground font-mono font-semibold text-xs flex items-center justify-center border border-border shadow-sm cursor-pointer select-none"
          title="Владелец: Professional (Self-Hosted)"
        >
          P
        </div>
      </div>
    </header>
  );
}
