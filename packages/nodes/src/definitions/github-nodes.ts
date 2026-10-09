import { BaseNodeDef, NodeExecutionContext, NodeExecutionOutput } from '../base.js';
import {
  NodeCategory,
  WorkflowPortDefinition,
  GitHubEventTriggerParametersSchema,
  GitHubGetIssueParametersSchema,
  GitHubCreateIssueParametersSchema,
} from '@neuroflow/shared';
import { GitHubApi, verifyGitHubWebhookSignature } from '../integrations/github-adapter.js';
import { getDatabase, credentials, eq, decryptData } from '@neuroflow/database';

async function resolveGitHubToken(context: NodeExecutionContext): Promise<string> {
  const credentialsId = (context as any).credentialsId || (context.parameters as any)?.credentialsId;
  if (credentialsId) {
    try {
      const db = getDatabase();
      const [cred] = await db.select().from(credentials).where(eq(credentials.id, credentialsId)).limit(1);
      if (cred) {
        const decrypted = decryptData(cred.dataEncrypted);
        const parsed = JSON.parse(decrypted);
        return parsed.personalAccessToken || parsed.token || '';
      }
    } catch {
      // Игнорируем в тестах
    }
  }

  return (
    (context.parameters as any)?.token ||
    (context.workflowContext as any)?.githubToken ||
    process.env.GITHUB_TOKEN ||
    ''
  );
}

function interpolateString(template: string, data: Record<string, any>): string {
  if (!template || typeof template !== 'string') return template;
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const trimmed = key.trim();
    const parts = trimmed.split('.');
    let val: any = data;
    for (const part of parts) {
      if (val && typeof val === 'object' && part in val) {
        val = val[part];
      } else {
        return `{{${trimmed}}}`;
      }
    }
    return val !== undefined ? String(val) : '';
  });
}

// 1. GitHub Event Trigger Node
export class GitHubEventTriggerNode extends BaseNodeDef {
  type = 'github-event-trigger';
  name = 'GitHub Event Trigger';
  description = 'Прием Webhook событий от GitHub (push, issue, pull_request) с проверкой HMAC SHA-256';
  category = NodeCategory.GITHUB;
  icon = 'Github';
  color = '#24292E';

  inputs: WorkflowPortDefinition[] = [];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Event', type: 'main', description: 'Распарсенное событие GitHub' },
  ];

  parameterSchema = GitHubEventTriggerParametersSchema;
  defaultParameters = {
    events: ['issues', 'pull_request', 'push'],
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const input = (context as any).inputData ?? (context as any).input ?? {};
    const params = context.parameters || {};

    const rawPayload = input.rawBody || JSON.stringify(input.body || input);
    const signature = input.headers?.['x-hub-signature-256'] || input.signature;
    const webhookSecret = (context.parameters as any)?.webhookSecret || process.env.GITHUB_WEBHOOK_SECRET;

    // Если задан секрет webhook, проверяем подпись
    if (webhookSecret && signature) {
      const isValid = verifyGitHubWebhookSignature(rawPayload, signature, webhookSecret);
      if (!isValid) {
        throw new Error('[GitHub Security] Недействительная подпись Webhook X-Hub-Signature-256. Запрос отклонен.');
      }
    }

    const eventName = input.headers?.['x-github-event'] || input.event || 'unknown';
    const allowedEvents = params.events || this.defaultParameters.events;

    if (allowedEvents.length > 0 && !allowedEvents.includes(eventName)) {
      context.log?.(`[GitHub Trigger] Пропущено событие "${eventName}" (не входит в список: ${allowedEvents.join(', ')})`);
      return { outputData: null, output: null, selectedPort: 'main' };
    }

    const body = input.body || input;
    const payload = {
      event: eventName,
      repository: body.repository?.full_name,
      sender: body.sender?.login,
      action: body.action,
      issue: body.issue,
      pullRequest: body.pull_request,
      commits: body.commits,
      payload: body,
    };

    return {
      outputData: payload,
      output: payload,
      selectedPort: 'main',
    };
  }
}

// 2. GitHub Get Issue Node
export class GitHubGetIssueNode extends BaseNodeDef {
  type = 'github-get-issue';
  name = 'GitHub Get Issue';
  description = 'Получение информации о задаче (issue) из репозитория GitHub';
  category = NodeCategory.GITHUB;
  icon = 'CircleDot';
  color = '#24292E';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Данные запроса' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Issue', type: 'main', description: 'Данные задачи' },
  ];

  parameterSchema = GitHubGetIssueParametersSchema;
  defaultParameters = {
    owner: '',
    repo: '',
    issueNumber: 1,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const input = (context as any).inputData ?? (context as any).input ?? {};
    const fullContext = { ...context.workflowContext, ...input };

    const token = await resolveGitHubToken(context);
    if (!token) {
      throw new Error('[GitHub Get Issue] Отсутствует токен доступа GitHub.');
    }

    const owner = interpolateString(params.owner || input.owner, fullContext);
    const repo = interpolateString(params.repo || input.repo, fullContext);
    const issueNumber = Number(params.issueNumber || input.issueNumber || 1);

    if (!owner || !repo) {
      throw new Error('[GitHub Get Issue] Необходимо указать owner и repo.');
    }

    const api = new GitHubApi(token);
    const issue = await api.getIssue(owner, repo, issueNumber);

    return {
      outputData: issue,
      output: issue,
      selectedPort: 'main',
    };
  }
}

// 3. GitHub Create Issue Node
export class GitHubCreateIssueNode extends BaseNodeDef {
  type = 'github-create-issue';
  name = 'GitHub Create Issue';
  description = 'Создание новой задачи (issue) в репозитории GitHub';
  category = NodeCategory.GITHUB;
  icon = 'PlusCircle';
  color = '#24292E';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Данные новой задачи' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Created Issue', type: 'main', description: 'Созданная задача' },
  ];

  parameterSchema = GitHubCreateIssueParametersSchema;
  defaultParameters = {
    owner: '',
    repo: '',
    title: '',
    requiresApproval: false,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const input = (context as any).inputData ?? (context as any).input ?? {};
    const fullContext = { ...context.workflowContext, ...input };

    const token = await resolveGitHubToken(context);
    if (!token) {
      throw new Error('[GitHub Create Issue] Отсутствует токен доступа GitHub.');
    }

    const owner = interpolateString(params.owner || input.owner, fullContext);
    const repo = interpolateString(params.repo || input.repo, fullContext);
    const title = interpolateString(params.title || input.title, fullContext);
    const body = params.body ? interpolateString(params.body, fullContext) : input.body;

    if (!owner || !repo || !title) {
      throw new Error('[GitHub Create Issue] Необходимо указать owner, repo и title задачи.');
    }

    // Если требуется подтверждение человека
    if (params.requiresApproval) {
      return {
        outputData: {
          waitingForApproval: true,
          actionTitle: `Создание Issue в ${owner}/${repo}: "${title}"`,
          consequences: 'В репозитории GitHub будет создана новая публичная или приватная задача.',
          payload: { owner, repo, title, body },
        },
        output: null,
        selectedPort: 'main',
      };
    }

    const api = new GitHubApi(token);
    const created = await api.createIssue(owner, repo, {
      title,
      body,
      labels: params.labels || input.labels,
    });

    context.log?.(`[GitHub] Создана задача #${created.number}: ${created.html_url}`);

    return {
      outputData: created,
      output: created,
      selectedPort: 'main',
    };
  }
}
