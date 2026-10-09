'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { CommandPalette } from './command-palette';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // Глобальное перехватывание Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Если мы в полноэкранном редакторе сценария (/workflows/[id]), рендерим без внешнего сайдбара
  const isWorkflowEditor =
    pathname.startsWith('/workflows/') &&
    pathname !== '/workflows' &&
    pathname !== '/workflows/new';

  if (isWorkflowEditor) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
        {children}
        <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground transition-colors">
      {/* Главный сайдбар */}
      <Sidebar />

      {/* Основная рабочая область */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        <Topbar onOpenCommandPalette={() => setIsPaletteOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-background transition-colors">
          {children}
        </main>
      </div>

      {/* Командная палитра */}
      <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} />
    </div>
  );
}
