'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  GitFork,
  Blocks,
  Brain,
  Activity,
  KeyRound,
  Settings,
  Cpu,
  ShieldCheck,
  Globe,
  Target,
} from 'lucide-react';

const navigationItems = [
  { name: 'Overview', href: '/overview', icon: LayoutDashboard },
  { name: 'Missions', href: '/missions', icon: Target },
  { name: 'Workflows', href: '/workflows', icon: GitFork },
  { name: 'Second Brain', href: '/knowledge', icon: Brain },
  { name: 'Browser Sessions', href: '/browser-sessions', icon: Globe },
  { name: 'Integrations', href: '/integrations', icon: Blocks },
  { name: 'Executions', href: '/executions', icon: Activity },
  { name: 'Credentials', href: '/credentials', icon: KeyRound },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-white/10 bg-[#12141F] flex flex-col h-screen select-none shrink-0 z-30">
      {/* Brand Header */}
      <div className="h-14 px-5 border-b border-white/5 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-md shadow-purple-600/30">
          <Cpu className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
            <span>NeuroFlow</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
              v1.0
            </span>
          </div>
          <div className="text-[10px] text-slate-400">Automation Platform</div>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 p-3 space-y-1">
        {navigationItems.map((item) => {
          const isActive = pathname.startsWith(item.href) || (item.href === '/workflows' && pathname === '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-purple-400' : 'text-slate-400'}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-white/5 m-3 rounded-xl bg-[#181B2B]/60 border border-white/5">
        <div className="flex items-center gap-2 mb-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[11px] font-semibold text-slate-200">Self-Hosted</span>
        </div>
        <div className="text-[10px] text-slate-400 leading-normal">
          PostgreSQL • Fastify • Node Engine
        </div>
      </div>
    </aside>
  );
}
