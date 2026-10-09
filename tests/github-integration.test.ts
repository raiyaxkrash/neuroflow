import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import {
  verifyGitHubWebhookSignature,
  GitHubEventTriggerNode,
  GitHubCreateIssueNode,
} from '../packages/nodes/src/index.js';

describe('GitHub Integration & Webhook HMAC Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('verifyGitHubWebhookSignature: строго проверяет HMAC SHA-256 подпись события', () => {
    const secret = 'my-super-webhook-secret-token';
    const payload = JSON.stringify({ action: 'opened', issue: { number: 42, title: 'Bug report' } });

    // Генерируем валидную подпись
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const validSignature = `sha256=${hmac.digest('hex')}`;

    // Валидная подпись принимается
    expect(verifyGitHubWebhookSignature(payload, validSignature, secret)).toBe(true);

    // Поддельная подпись отклоняется
    expect(verifyGitHubWebhookSignature(payload, 'sha256=invalidhash1234567890', secret)).toBe(false);

    // Подпись с другим секретом отклоняется
    expect(verifyGitHubWebhookSignature(payload, validSignature, 'wrong-secret')).toBe(false);

    // Отсутствующая подпись отклоняется
    expect(verifyGitHubWebhookSignature(payload, undefined, secret)).toBe(false);
  });

  it('GitHubEventTriggerNode: пропускает только разрешенные типы событий', async () => {
    const trigger = new GitHubEventTriggerNode();

    // 1. Неразрешенное событие
    const skipOutput = await trigger.execute({
      nodeId: 'gh_event',
      parameters: { events: ['issues', 'pull_request'] },
      inputData: {
        event: 'fork',
        body: { repository: { full_name: 'owner/repo' } },
      },
    });
    expect(skipOutput.outputData).toBeNull();

    // 2. Разрешенное событие
    const matchOutput = await trigger.execute({
      nodeId: 'gh_event',
      parameters: { events: ['issues', 'pull_request'] },
      inputData: {
        event: 'issues',
        body: {
          action: 'opened',
          repository: { full_name: 'neuroflow/core' },
          issue: { number: 10, title: 'Add Telegram node' },
        },
      },
    });
    expect(matchOutput.outputData?.event).toBe('issues');
    expect(matchOutput.outputData?.repository).toBe('neuroflow/core');
  });

  it('GitHubCreateIssueNode: запрашивает Human Approval при флаге безопасности requiresApproval = true', async () => {
    const createIssueNode = new GitHubCreateIssueNode();
    const output = await createIssueNode.execute({
      nodeId: 'node_create_issue',
      parameters: {
        token: 'ghp_fake_token_for_test',
        owner: 'my-org',
        repo: 'prod-service',
        title: 'Critical bug detected by AI Agent',
        requiresApproval: true,
      },
    });

    expect(output.outputData?.waitingForApproval).toBe(true);
    expect(output.output).toBeNull();
  });
});
