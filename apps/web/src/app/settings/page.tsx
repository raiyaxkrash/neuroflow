'use client';

import React from 'react';
import { Settings, Shield, Server, Database } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';

export default function SettingsPage() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090A0F]">
      <Sidebar />

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 border-b border-white/10 px-8 flex items-center justify-between shrink-0 bg-[#0D0E15]">
          <div>
            <h1 className="text-lg font-semibold text-white tracking-tight">Настройки системы</h1>
            <p className="text-xs text-slate-400">
              Конфигурация сервера NeuroFlow, базы данных и ограничений безопасности
            </p>
          </div>
        </header>

        <div className="flex-1 p-8 max-w-4xl mx-auto w-full space-y-4">
          <div className="p-5 rounded-2xl bg-[#12141F] border border-white/5 space-y-3">
            <div className="flex items-center gap-2.5 text-slate-200 font-semibold text-sm">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Безопасность сетевых запросов (SSRF Guard)</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Защита от SSRF активна: блокируются обращения к 127.0.0.1, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, metadata сервисам облачных платформ и приватным DNS адресам.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#12141F] border border-white/5 space-y-3">
            <div className="flex items-center gap-2.5 text-slate-200 font-semibold text-sm">
              <Database className="w-4 h-4 text-purple-400" />
              <span>Хранилище данных</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Drizzle ORM с PostgreSQL и автоматическими миграциями. Поддержка внешнего PostgreSQL и встроенного zero-setup режима.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
