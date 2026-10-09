'use client';

import React from 'react';
import { KeyRound, Plus, ShieldCheck } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';

export default function CredentialsPage() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090A0F]">
      <Sidebar />

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 border-b border-white/10 px-8 flex items-center justify-between shrink-0 bg-[#0D0E15]">
          <div>
            <h1 className="text-lg font-semibold text-white tracking-tight">Учетные записи (Credentials)</h1>
            <p className="text-xs text-slate-400">
              Безопасное хранение секретов, токенов авторизации и API ключей
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/25 transition-all">
            <Plus className="w-4 h-4" />
            <span>Добавить ключ</span>
          </button>
        </header>

        <div className="flex-1 p-8 max-w-4xl mx-auto w-full">
          <div className="p-8 rounded-2xl bg-[#12141F] border border-white/5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-4 text-purple-400">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Секреты зашифрованы</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Все добавляемые токены шифруются перед сохранением в PostgreSQL и маскируются в логах запусков.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
