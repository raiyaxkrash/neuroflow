const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('neuroflow_token') || window.localStorage.getItem('token')
      : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      errorMsg = errJson.message || errJson.error || errorMsg;
    } catch {
      // Игнорируем ошибку парсинга
    }
    throw new Error(errorMsg);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Workflows
  getWorkflows: () => fetchApi<{ workflows: any[]; total: number }>('/api/workflows'),
  getWorkflow: (id: string) => fetchApi<any>(`/api/workflows/${id}`),
  createWorkflow: (data: { name: string; description?: string; graph?: any }) =>
    fetchApi<any>('/api/workflows', { method: 'POST', body: JSON.stringify(data) }),
  updateWorkflow: (id: string, data: any) =>
    fetchApi<any>(`/api/workflows/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWorkflow: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/workflows/${id}`, { method: 'DELETE' }),
  executeWorkflow: (id: string, payload?: any) =>
    fetchApi<any>(`/api/workflows/${id}/execute`, { method: 'POST', body: JSON.stringify(payload || {}) }),
  validateWorkflow: (graph: any) =>
    fetchApi<{ valid: boolean; errors: string[]; warnings: string[] }>('/api/workflows/validate', {
      method: 'POST',
      body: JSON.stringify(graph),
    }),

  // Nodes
  getNodes: () => fetchApi<{ nodes: any[]; total: number }>('/api/nodes'),
  getNodeMeta: (type: string) => fetchApi<any>(`/api/nodes/${type}`),

  // Executions
  getExecutions: (workflowId?: string) =>
    fetchApi<{ executions: any[]; total: number }>(
      workflowId ? `/api/executions?workflowId=${workflowId}` : '/api/executions'
    ),
  getExecution: (id: string) => fetchApi<any>(`/api/executions/${id}`),
  cancelExecution: (id: string) =>
    fetchApi<any>(`/api/executions/${id}/cancel`, { method: 'POST' }),

  // AI Providers & Intelligent Features
  getAIProviders: () => fetchApi<{ providers: any[]; total: number }>('/api/ai/providers'),
  createAIProvider: (data: any) =>
    fetchApi<any>('/api/ai/providers', { method: 'POST', body: JSON.stringify(data) }),
  updateAIProvider: (id: string, data: any) =>
    fetchApi<any>(`/api/ai/providers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAIProvider: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/ai/providers/${id}`, { method: 'DELETE' }),
  testAIConnection: (data: any) =>
    fetchApi<any>('/api/ai/providers/test', { method: 'POST', body: JSON.stringify(data) }),
  testAIProvider: (id: string) =>
    fetchApi<any>(`/api/ai/providers/${id}/test`, { method: 'POST' }),
  getAIModels: (providerId: string) =>
    fetchApi<{ models: any[]; total: number }>(`/api/ai/providers/${providerId}/models`),
  generateWorkflow: (data: { prompt: string; providerId?: string; model?: string; contextGraph?: any }) =>
    fetchApi<any>('/api/ai/generate-workflow', { method: 'POST', body: JSON.stringify(data) }),
  copilot: (data: {
    workflowId?: string;
    message?: string;
    history?: any[];
    selectedNodeId?: string;
    messages?: any[];
    currentGraph: any;
    providerId?: string;
    model?: string;
  }) => fetchApi<any>('/api/ai/copilot', { method: 'POST', body: JSON.stringify(data) }),
  debugExecution: (data: string | { executionId: string; failedNodeId?: string; providerId?: string }) => {
    const payload = typeof data === 'string' ? { executionId: data } : data;
    return fetchApi<any>('/api/ai/debug', { method: 'POST', body: JSON.stringify(payload) });
  },

  // MCP Servers & Tools (Phase 3)
  getMCPServers: () => fetchApi<any[]>('/api/mcp/servers'),
  createMCPServer: (data: any) =>
    fetchApi<any>('/api/mcp/servers', { method: 'POST', body: JSON.stringify(data) }),
  deleteMCPServer: (id: string) =>
    fetchApi<any>(`/api/mcp/servers/${id}`, { method: 'DELETE' }),
  testMCPServer: (id: string) =>
    fetchApi<any>(`/api/mcp/servers/${id}/test`, { method: 'POST' }),
  callMCPTool: (serverId: string, data: { toolName: string; arguments?: Record<string, any> }) =>
    fetchApi<any>(`/api/mcp/servers/${serverId}/tools/call`, { method: 'POST', body: JSON.stringify(data) }),

  // Human Approvals (Phase 3)
  getApprovals: () => fetchApi<any[]>('/api/approvals'),
  reviewApproval: (id: string, decision: 'approved' | 'rejected', reason?: string) =>
    fetchApi<any>(`/api/approvals/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, reason }),
    }),

  // Agent Memory (Phase 3)
  getMemories: (scope: string = 'user', query?: string) =>
    fetchApi<{ items: any[] }>(`/api/memories?scope=${scope}${query ? `&query=${encodeURIComponent(query)}` : ''}`),
  setMemory: (data: { scope: string; key: string; value: any; ttlSeconds?: number }) =>
    fetchApi<any>('/api/memories', { method: 'POST', body: JSON.stringify(data) }),
};

