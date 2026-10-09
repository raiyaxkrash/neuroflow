const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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
};
