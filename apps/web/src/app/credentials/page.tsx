'use client';

import React from 'react';
import { KeyRound, Plus, ShieldCheck, Lock, ExternalLink } from 'lucide-react';

export default function CredentialsPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Безопасность · Vault & Keystore
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Учетные записи & API Ключи
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Безопасное аппаратное и программное хранение секретов, токенов авторизации и ключей AI-провайдеров.
          </p>
        </div>

        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold shadow-sm transition-opacity self-start md:self-auto">
          <Plus className="w-3.5 h-3.5" />
          <span>Добавить ключ</span>
        </button>
      </div>

      {/* Основной контент */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="p-8 rounded-xl bg-card border border-border text-center shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Секреты зашифрованы алгоритмом AES-256-GCM</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              Все добавляемые токены (OpenAI, Anthropic, Gemini, Telegram Bot Token, GitHub Personal Access Token) шифруются мастер-ключом перед сохранением в PostgreSQL и строго маскируются в логах выполнения.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-card border border-border space-y-3 shadow-sm">
            <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
              <ShieldCheck className="w-4 h-4 text-status-success" />
              <span>Безопасность окружения</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Ключи доступны только локальному процессу NeuroFlow. Никакие данные не передаются на сторонние серверы телеметрии.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
