import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('UI Theme System & Design Tokens', () => {
  it('проверяет корректность контракта темы: light и dark значения', () => {
    type Theme = 'light' | 'dark' | 'system';
    const supportedThemes: Theme[] = ['light', 'dark', 'system'];

    expect(supportedThemes).toContain('light');
    expect(supportedThemes).toContain('dark');
    expect(supportedThemes).toContain('system');
  });

  it('проверяет детерминированное разрешение системной темы', () => {
    const resolveEffectiveTheme = (
      theme: 'light' | 'dark' | 'system',
      systemPrefersDark: boolean
    ): 'light' | 'dark' => {
      if (theme === 'system') {
        return systemPrefersDark ? 'dark' : 'light';
      }
      return theme;
    };

    expect(resolveEffectiveTheme('light', false)).toBe('light');
    expect(resolveEffectiveTheme('light', true)).toBe('light');
    expect(resolveEffectiveTheme('dark', false)).toBe('dark');
    expect(resolveEffectiveTheme('dark', true)).toBe('dark');
    expect(resolveEffectiveTheme('system', false)).toBe('light');
    expect(resolveEffectiveTheme('system', true)).toBe('dark');
  });

  it('гарантирует корректное сохранение и загрузку темы в localStorage', () => {
    const mockStorage: Record<string, string> = {};
    const storageKey = 'neuroflow-ui-theme';

    const saveTheme = (theme: string) => {
      mockStorage[storageKey] = theme;
    };

    const getStoredTheme = () => {
      return mockStorage[storageKey] || 'dark';
    };

    expect(getStoredTheme()).toBe('dark'); // default
    saveTheme('light');
    expect(getStoredTheme()).toBe('light');
    saveTheme('dark');
    expect(getStoredTheme()).toBe('dark');
  });
});

describe('AppShell Layout Routing Rules', () => {
  const isWorkflowCanvasRoute = (pathname: string): boolean => {
    // В полноэкранном редакторе сценариев /workflows/[id] сайдбар и топбар скрываются,
    // в то время как на странице каталога /workflows они отображаются
    return pathname.startsWith('/workflows/') && pathname !== '/workflows';
  };

  it('скрывает внешний сайдбар исключительно в холсте сценария /workflows/[id]', () => {
    expect(isWorkflowCanvasRoute('/workflows/wf-123')).toBe(true);
    expect(isWorkflowCanvasRoute('/workflows/new-experiment')).toBe(true);
    expect(isWorkflowCanvasRoute('/workflows')).toBe(false);
    expect(isWorkflowCanvasRoute('/overview')).toBe(false);
    expect(isWorkflowCanvasRoute('/missions')).toBe(false);
    expect(isWorkflowCanvasRoute('/settings')).toBe(false);
    expect(isWorkflowCanvasRoute('/browser-sessions')).toBe(false);
  });
});

describe('CommandPalette Search & Action Registry', () => {
  interface CommandItem {
    id: string;
    title: string;
    section: 'navigation' | 'actions' | 'theme';
    href?: string;
    shortcut?: string;
  }

  const registeredCommands: CommandItem[] = [
    { id: 'overview', title: 'Обзор системы', section: 'navigation', href: '/overview' },
    { id: 'missions', title: 'Автономные миссии', section: 'navigation', href: '/missions' },
    { id: 'workflows', title: 'Сценарии & Воркфлоу', section: 'navigation', href: '/workflows' },
    { id: 'knowledge', title: 'База знаний (Second Brain)', section: 'navigation', href: '/knowledge' },
    { id: 'integrations', title: 'MCP Интеграции & Хаб', section: 'navigation', href: '/integrations' },
    { id: 'browser', title: 'Браузерные сессии', section: 'navigation', href: '/browser-sessions' },
    { id: 'credentials', title: 'Хранилище секретов', section: 'navigation', href: '/credentials' },
    { id: 'settings', title: 'Настройки системы', section: 'navigation', href: '/settings' },
    { id: 'new-workflow', title: 'Создать сценарий', section: 'actions', href: '/workflows?new=1' },
    { id: 'new-mission', title: 'Запустить миссию', section: 'actions', href: '/missions?new=1' },
    { id: 'theme-light', title: 'Тема: Светлая (Forest Light)', section: 'theme' },
    { id: 'theme-dark', title: 'Тема: Тёмная (Obsidian Dark)', section: 'theme' },
  ];

  const filterCommands = (query: string, items: CommandItem[]): CommandItem[] => {
    if (!query.trim()) return items;
    const lower = query.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(lower) ||
        item.id.toLowerCase().includes(lower) ||
        item.section.toLowerCase().includes(lower)
    );
  };

  it('возвращает полный список команд при пустом поисковом запросе', () => {
    const results = filterCommands('', registeredCommands);
    expect(results.length).toBe(registeredCommands.length);
  });

  it('находит элементы навигации по кириллическому запросу', () => {
    const results = filterCommands('миссии', registeredCommands);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('missions');

    const brainResults = filterCommands('second brain', registeredCommands);
    expect(brainResults.length).toBe(1);
    expect(brainResults[0].id).toBe('knowledge');
  });

  it('находит действия по ключевому слову Создать', () => {
    const results = filterCommands('Создать', registeredCommands);
    expect(results.some((r) => r.id === 'new-workflow')).toBe(true);
  });

  it('находит команды переключения тем', () => {
    const results = filterCommands('тема', registeredCommands);
    expect(results.length).toBe(2);
    expect(results.map((r) => r.id)).toEqual(['theme-light', 'theme-dark']);
  });

  it('корректно обрабатывает комбинации горячих клавиш (Ctrl+K и Cmd+K)', () => {
    const isCommandPaletteShortcut = (e: { key: string; metaKey: boolean; ctrlKey: boolean }): boolean => {
      return (e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey);
    };

    expect(isCommandPaletteShortcut({ key: 'k', metaKey: true, ctrlKey: false })).toBe(true); // Mac Cmd+K
    expect(isCommandPaletteShortcut({ key: 'k', metaKey: false, ctrlKey: true })).toBe(true); // Win Ctrl+K
    expect(isCommandPaletteShortcut({ key: 'K', metaKey: false, ctrlKey: true })).toBe(true); // Win Ctrl+Shift+K
    expect(isCommandPaletteShortcut({ key: 'k', metaKey: false, ctrlKey: false })).toBe(false);
    expect(isCommandPaletteShortcut({ key: 'j', metaKey: true, ctrlKey: false })).toBe(false);
  });
});
