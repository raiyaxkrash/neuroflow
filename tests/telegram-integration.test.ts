import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TelegramMessageTriggerNode,
  TelegramCommandTriggerNode,
  TelegramSendMessageNode,
  TelegramApi,
  isAuthorizedTelegramSender,
  TelegramPollingManager,
} from '../packages/nodes/src/index.js';

describe('Telegram Bot Integration & Allowlist Security', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    TelegramPollingManager.stopAll();
  });

  it('isAuthorizedTelegramSender: блокирует неавторизованных пользователей и чаты', () => {
    const allowedUsers = ['111222', '333444'];
    const allowedChats = ['-100999888'];

    // Разрешенный пользователь
    expect(isAuthorizedTelegramSender('111222', '123', allowedUsers, [])).toBe(true);
    // Запрещенный пользователь
    expect(isAuthorizedTelegramSender('999999', '123', allowedUsers, [])).toBe(false);

    // Разрешенный чат
    expect(isAuthorizedTelegramSender('999999', '-100999888', allowedUsers, allowedChats)).toBe(true);

    // Если allowlist пустой, разрешается доступ владельцу
    expect(isAuthorizedTelegramSender('ANY', 'ANY', [], [])).toBe(true);
  });

  it('TelegramMessageTriggerNode: фильтрует входящие сообщения по белому списку пользователей', async () => {
    const trigger = new TelegramMessageTriggerNode();

    // 1. Посторонний отправитель
    const rejectedOutput = await trigger.execute({
      nodeId: 'tg_msg',
      parameters: {
        allowedUserIds: ['12345'],
      },
      inputData: {
        message: {
          message_id: 1,
          from: { id: 99999, first_name: 'Attacker' },
          chat: { id: 99999, type: 'private' },
          text: 'Hello from hacker',
        },
      },
    });
    expect(rejectedOutput.outputData).toBeNull();

    // 2. Авторизованный отправитель (владелец)
    const allowedOutput = await trigger.execute({
      nodeId: 'tg_msg',
      parameters: {
        allowedUserIds: ['12345'],
      },
      inputData: {
        message: {
          message_id: 2,
          from: { id: 12345, first_name: 'Owner', username: 'owner_bot' },
          chat: { id: 12345, type: 'private' },
          text: 'Запусти отчет по серверам',
          date: 1770000000,
        },
      },
    });
    expect(allowedOutput.outputData).toBeDefined();
    expect(allowedOutput.outputData?.text).toBe('Запусти отчет по серверам');
    expect(allowedOutput.outputData?.fromId).toBe(12345);
  });

  it('TelegramCommandTriggerNode: реагирует только на совпадающую команду', async () => {
    const commandNode = new TelegramCommandTriggerNode();

    // Другая команда -> пропуск
    const skipOutput = await commandNode.execute({
      nodeId: 'cmd_start',
      parameters: { command: '/start' },
      inputData: {
        message: { text: '/help and args', chat: { id: 1 } },
      },
    });
    expect(skipOutput.outputData).toBeNull();

    // Совпадающая команда -> успешное срабатывание и парсинг аргументов
    const matchOutput = await commandNode.execute({
      nodeId: 'cmd_start',
      parameters: { command: '/ask' },
      inputData: {
        message: { text: '/ask какая погода сегодня?', chat: { id: 1 }, from: { id: 1 } },
      },
    });
    expect(matchOutput.outputData).toBeDefined();
    expect(matchOutput.outputData?.command).toBe('/ask');
    expect(matchOutput.outputData?.commandArgs).toBe('какая погода сегодня?');
  });

  it('TelegramSendMessageNode: корректно подставляет шаблоны и отправляет сообщение', async () => {
    // Мокаем глобальный fetch
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url: any, opts: any) => {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            message_id: 101,
            chat: { id: 98765 },
            text: 'Привет, Alex!',
            date: 1770000000,
          },
        }),
      } as any;
    });

    const sendNode = new TelegramSendMessageNode();
    const output = await sendNode.execute({
      nodeId: 'send_tg',
      parameters: {
        botToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
        chatId: '{{chatId}}',
        text: 'Привет, {{user.name}}!',
        parseMode: 'Markdown',
      },
      workflowContext: {
        chatId: 98765,
        user: { name: 'Alex' },
      },
    });

    expect(fetchSpy).toHaveBeenCalled();
    expect(output.outputData?.sentMessageId).toBe(101);
    expect(output.outputData?.chatId).toBe(98765);
  });
});
