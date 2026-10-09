import { WorkflowGraph } from './types.js';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'telegram' | 'github' | 'schedule' | 'filesystem' | 'ai';
  requiredCredentials: string[];
  graph: WorkflowGraph;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'telegram-ai-assistant',
    name: 'Telegram AI Assistant',
    description: 'Интеллектуальный персональный ассистент в Telegram: принимает сообщение, обрабатывает через AI Agent и отправляет ответ.',
    category: 'telegram',
    requiredCredentials: ['telegram', 'ai-provider'],
    graph: {
      nodes: [
        {
          id: 'tg_trigger',
          type: 'telegram-message-trigger',
          position: { x: 100, y: 150 },
          data: {
            label: 'Входящее сообщение Telegram',
            type: 'telegram-message-trigger',
            parameters: {
              chatTypes: ['private'],
              requireText: true,
            },
          },
        },
        {
          id: 'ai_agent',
          type: 'ai-agent',
          position: { x: 450, y: 150 },
          data: {
            label: 'AI Ассистент (ReAct)',
            type: 'ai-agent',
            parameters: {
              agentName: 'Telegram Assistant',
              systemInstructions: 'Ты дружелюбный и точный персональный AI-ассистент в Telegram. Отвечай кратко, емко и вежливо. Используй форматирование Markdown.',
              userPrompt: 'Запрос пользователя: {{tg_trigger.text}}',
              model: 'default',
              temperature: 0.7,
              maxIterations: 5,
              allowedTools: ['calculator', 'web_fetch'],
            },
          },
        },
        {
          id: 'tg_reply',
          type: 'telegram-send-message',
          position: { x: 800, y: 150 },
          data: {
            label: 'Ответ в Telegram',
            type: 'telegram-send-message',
            parameters: {
              chatId: '{{tg_trigger.chatId}}',
              replyToMessageId: '{{tg_trigger.messageId}}',
              text: '{{ai_agent.response}}',
              parseMode: 'Markdown',
            },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'tg_trigger', target: 'ai_agent' },
        { id: 'e2', source: 'ai_agent', target: 'tg_reply' },
      ],
    },
  },
  {
    id: 'github-monitor',
    name: 'GitHub Monitor',
    description: 'Мониторинг репозитория: при создании issue или pull request генерирует краткое резюме через AI и отправляет в Telegram.',
    category: 'github',
    requiredCredentials: ['github', 'telegram', 'ai-provider'],
    graph: {
      nodes: [
        {
          id: 'gh_event',
          type: 'github-event-trigger',
          position: { x: 100, y: 150 },
          data: {
            label: 'GitHub Webhook Event',
            type: 'github-event-trigger',
            parameters: {
              events: ['issues', 'pull_request'],
            },
          },
        },
        {
          id: 'ai_summarizer',
          type: 'ai-model',
          position: { x: 450, y: 150 },
          data: {
            label: 'Анализ события нейросетью',
            type: 'ai-model',
            parameters: {
              modelId: 'gpt-4o-mini',
              systemPrompt: 'Ты ассистент инженера. Проанализируй входящее событие GitHub (Issue или Pull Request) и составь краткую сводку на русском языке с ключевыми пунктами.',
              prompt: 'Данные события: {{gh_event.payload}}',
              temperature: 0.3,
            },
          },
        },
        {
          id: 'tg_notify',
          type: 'telegram-send-message',
          position: { x: 800, y: 150 },
          data: {
            label: 'Уведомление в Telegram',
            type: 'telegram-send-message',
            parameters: {
              text: '🔔 *GitHub Уведомление*\n\n{{ai_summarizer.text}}',
              parseMode: 'Markdown',
            },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'gh_event', target: 'ai_summarizer' },
        { id: 'e2', source: 'ai_summarizer', target: 'tg_notify' },
      ],
    },
  },
  {
    id: 'daily-ai-summary',
    name: 'Daily AI Summary',
    description: 'Ежедневная утренняя сводка: по расписанию получает данные из внешнего API, формирует дайджест и отправляет владельцу в Telegram.',
    category: 'schedule',
    requiredCredentials: ['telegram', 'ai-provider'],
    graph: {
      nodes: [
        {
          id: 'schedule_morning',
          type: 'schedule-trigger',
          position: { x: 100, y: 150 },
          data: {
            label: 'Каждое утро (09:00)',
            type: 'schedule-trigger',
            parameters: {
              mode: 'daily',
              timeOfDay: '09:00',
              timezone: 'Europe/Moscow',
            },
          },
        },
        {
          id: 'fetch_news',
          type: 'http-request',
          position: { x: 380, y: 150 },
          data: {
            label: 'Запрос свежих данных',
            type: 'http-request',
            parameters: {
              url: 'https://hacker-news.firebaseio.com/v0/topstories.json?limit=5',
              method: 'GET',
            },
          },
        },
        {
          id: 'ai_digest',
          type: 'ai-agent',
          position: { x: 680, y: 150 },
          data: {
            label: 'Составление дайджеста',
            type: 'ai-agent',
            parameters: {
              agentName: 'Morning Digest Agent',
              systemPrompt: 'Ты личный аналитик. Составь структурированный утренний дайджест для владельца системы.',
              modelId: 'gpt-4o-mini',
              temperature: 0.5,
            },
          },
        },
        {
          id: 'send_digest',
          type: 'telegram-send-message',
          position: { x: 980, y: 150 },
          data: {
            label: 'Отправка в Telegram',
            type: 'telegram-send-message',
            parameters: {
              text: '☕ *Доброе утро! Твой персональный дайджест:*\n\n{{ai_digest.response}}',
              parseMode: 'Markdown',
            },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'schedule_morning', target: 'fetch_news' },
        { id: 'e2', source: 'fetch_news', target: 'ai_digest' },
        { id: 'e3', source: 'ai_digest', target: 'send_digest' },
      ],
    },
  },
  {
    id: 'personal-document-processor',
    name: 'Personal Document Processor',
    description: 'Обработка документов в локальной папке: при появлении нового файла читает содержимое, обрабатывает через AI и сохраняет результат.',
    category: 'filesystem',
    requiredCredentials: ['filesystem', 'ai-provider'],
    graph: {
      nodes: [
        {
          id: 'file_changed',
          type: 'file-changed-trigger',
          position: { x: 100, y: 150 },
          data: {
            label: 'Отслеживание файлов',
            type: 'file-changed-trigger',
            parameters: {
              directoryPath: './data/storage/inbox',
              events: ['add', 'change'],
            },
          },
        },
        {
          id: 'read_doc',
          type: 'read-file',
          position: { x: 380, y: 150 },
          data: {
            label: 'Чтение файла',
            type: 'read-file',
            parameters: {
              filePath: '{{file_changed.filePath}}',
              encoding: 'utf-8',
            },
          },
        },
        {
          id: 'ai_extract',
          type: 'ai-model',
          position: { x: 680, y: 150 },
          data: {
            label: 'Извлечение данных AI',
            type: 'ai-model',
            parameters: {
              modelId: 'gpt-4o-mini',
              systemPrompt: 'Ты эксперт по структурированию документов. Извлеки ключевые факты и подготовь JSON-резюме документа.',
              prompt: 'Текст документа: {{read_doc.content}}',
            },
          },
        },
        {
          id: 'save_summary',
          type: 'write-file',
          position: { x: 980, y: 150 },
          data: {
            label: 'Сохранение результата',
            type: 'write-file',
            parameters: {
              filePath: './data/storage/processed/summary.md',
              content: '{{ai_extract.text}}',
              mode: 'overwrite',
            },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'file_changed', target: 'read_doc' },
        { id: 'e2', source: 'read_doc', target: 'ai_extract' },
        { id: 'e3', source: 'ai_extract', target: 'save_summary' },
      ],
    },
  },
];
