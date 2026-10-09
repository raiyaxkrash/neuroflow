'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const mainNavItems: NavItem[] = [
  { name: 'Обзор', href: '/overview', icon: LayoutDashboard },
  { name: 'Миссии и Агенты', href: '/missions', icon: Target },
  { name: 'Сценарии', href: '/workflows', icon: GitFork },
  { name: 'Второй мозг (RAG)', href: '/knowledge', icon: Brain },
  { name: 'Браузерные сессии', href: '/browser-sessions', icon: Globe },
  { name: 'MCP Hub', href: '/integrations', icon: Blocks },
  { name: 'Журнал выполнений', href: '/executions', icon: Activity },
];

const systemNavItems: NavItem[] = [
  { name: 'Учетные данные', href: '/credentials', icon: KeyRound },
  { name: 'Настройки', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  const isItemActive = (href: string) => {
    if (href === '/overview' && (pathname === '/' || pathname === '/overview')) return true;
    if (href === '/workflows' && pathname.startsWith('/workflows') && !pathname.startsWith('/workflows/')) return true;
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-64 border-r border-sidebar-border bg-sidebar flex-col h-screen select-none shrink-0 z-30 hidden md:flex transition-colors">
      {/* Brand Header */}
      <div className="h-16 px-5 border-b border-sidebar-border flex items-center justify-between">
        <Link href="/overview" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-sidebar-hover border border-sidebar-border flex items-center justify-center font-mono font-bold text-sm text-highlight group-hover:border-highlight/50 transition-colors shadow-sm">
            N
          </div>
          <div>
            <div className="font-semibold text-sm tracking-tight text-sidebar-foreground flex items-center gap-1.5">
              <span>NeuroFlow</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-highlight/10 text-highlight border border-highlight/20">
                Studio
              </span>
            </div>
            <div className="text-[11px] text-sidebar-muted font-medium">Local Node · v1.0</div>
          </div>
        </Link>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
            Рабочее пространство
          </div>
          <nav className="space-y-1">
            {mainNavItems.map((item) => {
              const active = isItemActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? 'bg-sidebar-active text-sidebar-foreground border-l-2 border-highlight shadow-sm'
                      : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-hover'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${active ? 'text-highlight' : 'text-sidebar-muted'}`} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sidebar-hover text-sidebar-muted">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div>
          <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
            Система и безопасность
          </div>
          <nav className="space-y-1">
            {systemNavItems.map((item) => {
              const active = isItemActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? 'bg-sidebar-active text-sidebar-foreground border-l-2 border-highlight shadow-sm'
                      : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-hover'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${active ? 'text-highlight' : 'text-sidebar-muted'}`} />
                    <span>{item.name}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer System Status */}
      <div className="p-3 border-t border-sidebar-border bg-sidebar-hover/40">
        <div className="p-2.5 rounded-lg border border-sidebar-border bg-sidebar/80">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-semibold text-sidebar-foreground">Локальный узел</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400">12ms</span>
          </div>
          <div className="text-[10px] text-sidebar-muted flex items-center justify-between font-mono">
            <span>127.0.0.1:4000</span>
            <span className="text-[9px] uppercase tracking-wider">Fastify</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
