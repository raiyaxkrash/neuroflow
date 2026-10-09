import { describe, it, expect } from 'vitest';
import { AICopilotService } from '../packages/workflow-engine/src/ai/copilot-service.js';
import { AIDebuggerService } from '../packages/workflow-engine/src/ai/debugger-service.js';
import { MockAIProvider } from '../packages/nodes/src/ai/mock-provider.js';

describe('AI Copilot & AI Debugger Services', () => {
  it('AICopilotService должен возвращать ответ и структурированные действия (actions)', async () => {
    const mock = new MockAIProvider();
    const copilot = new AICopilotService(mock);

    const currentGraph = {
      nodes: [
        {
          id: 'n_start',
          type: 'manual-trigger',
          label: 'Start',
          position: { x: 100, y: 100 },
          data: { type: 'manual-trigger', label: 'Start' },
        },
      ],
      edges: [],
    };

    const res = await copilot.processChat({
      message: 'Добавь блок AI Model и соедини его со стартом',
      currentGraph,
    });

    expect(res.reply).toBeDefined();
    expect(res.actions).toBeDefined();
    expect(Array.isArray(res.actions)).toBe(true);
    expect(res.actions.length).toBeGreaterThan(0);

    const actionTypes = res.actions.map((a) => a.action);
    expect(actionTypes).toContain('add_node');
  });

  it('AIDebuggerService должен анализировать ошибку и маскировать секреты', async () => {
    const mock = new MockAIProvider({
      cannedResponses: {
        'Debug failed execution': JSON.stringify({
          summary: 'HTTP запрос завершился ошибкой 401 Unauthorized',
          rootCause: 'Невалидный токен авторизации Bearer',
          recommendations: ['Проверьте Bearer токен в настройках заголовков'],
          suggestedNodePatch: { headers: { Authorization: 'Bearer [NEW_TOKEN]' } },
        }),
      },
    });

    const debuggerService = new AIDebuggerService(mock);

    const sensitiveLog =
      'Request to https://api.test/resource with Authorization: Bearer secret-token-xyz-12345 failed with status 401';

    const debugResult = await debuggerService.debugExecution({
      executionId: 'exec_fail_1',
      workflowName: 'Sync Users',
      error: sensitiveLog,
      failedNode: {
        id: 'node_http_1',
        type: 'http-request',
        parameters: {
          url: 'https://api.test/resource',
          apiKey: 'secret-token-xyz-12345',
        },
      },
    });

    expect(debugResult.rootCause).toBeDefined();
    expect(debugResult.recommendations).toBeDefined();
    expect(debugResult.recommendations.length).toBeGreaterThan(0);

    // Проверяем, что исходный неотфильтрованный секретный токен не светится в чистом виде
    const jsonStr = JSON.stringify(debugResult);
    expect(jsonStr).not.toContain('secret-token-xyz-12345');
  });
});
