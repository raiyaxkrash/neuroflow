import crypto from 'node:crypto';

export interface GitHubUser {
  login: string;
  id: number;
  name?: string;
  email?: string;
  avatar_url?: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  html_url: string;
  user: GitHubUser;
  labels: Array<{ name: string; color?: string }>;
  created_at: string;
}

export class GitHubApi {
  private baseUrl = 'https://api.github.com';

  constructor(private token: string) {
    if (!token) {
      throw new Error('[GitHub API] Не указан токен доступа GitHub.');
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'NeuroFlow-Automation-Platform',
    };
  }

  /**
   * Проверка токена и получение профиля пользователя
   */
  public async getUser(): Promise<GitHubUser> {
    const res = await fetch(`${this.baseUrl}/user`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`[GitHub getUser Error ${res.status}] ${err}`);
    }

    return await res.json() as GitHubUser;
  }

  /**
   * Получение деталей Issue
   */
  public async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    const res = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`[GitHub getIssue Error ${res.status}] ${err}`);
    }

    return await res.json() as GitHubIssue;
  }

  /**
   * Создание нового Issue
   */
  public async createIssue(
    owner: string,
    repo: string,
    params: { title: string; body?: string; labels?: string[]; assignees?: string[] }
  ): Promise<GitHubIssue> {
    const res = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`[GitHub createIssue Error ${res.status}] ${err}`);
    }

    return await res.json() as GitHubIssue;
  }
}

/**
 * Криптографическая проверка подлинности Webhook от GitHub (X-Hub-Signature-256)
 * Защищена от атак по времени (Timing-Safe Comparison).
 */
export function verifyGitHubWebhookSignature(
  rawPayload: string | Buffer,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return false;
  }

  const expectedHash = parts[1];
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(typeof rawPayload === 'string' ? Buffer.from(rawPayload, 'utf-8') : rawPayload);
  const calculatedHash = hmac.digest('hex');

  try {
    const bufExpected = Buffer.from(expectedHash, 'hex');
    const bufCalculated = Buffer.from(calculatedHash, 'hex');

    if (bufExpected.length !== bufCalculated.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufExpected, bufCalculated);
  } catch {
    return false;
  }
}
