export type MCPTransportType = 'http' | 'sse' | 'stdio';

export type MCPAuthType = 'none' | 'bearer' | 'api-key-header' | 'custom-headers';

export interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type?: string;
    properties?: Record<string, any>;
    required?: string[];
    [key: string]: any;
  };
  serverId?: string;
  serverName?: string;
  requiresApproval?: boolean;
}

export interface MCPResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  serverId?: string;
  serverName?: string;
}

export interface MCPPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface MCPPromptDefinition {
  name: string;
  description?: string;
  arguments?: MCPPromptArgument[];
  serverId?: string;
  serverName?: string;
}

export interface MCPCapabilities {
  tools?: boolean;
  resources?: boolean;
  prompts?: boolean;
  logging?: boolean;
}

export interface MCPServerDto {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  transport: MCPTransportType;
  serverUrl?: string | null;
  command?: string | null;
  args?: string[] | null;
  authType: MCPAuthType;
  apiKeyMasked?: string | null;
  customHeadersMasked?: Record<string, string> | null;
  timeoutMs: number;
  capabilities: MCPCapabilities;
  discoveredTools: MCPToolDefinition[];
  discoveredResources: MCPResourceDefinition[];
  discoveredPrompts: MCPPromptDefinition[];
  isEnabled: boolean;
  lastConnectedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMCPServerDto {
  name: string;
  description?: string;
  transport: MCPTransportType;
  serverUrl?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  authType?: MCPAuthType;
  apiKey?: string;
  customHeaders?: Record<string, string>;
  timeoutMs?: number;
  isEnabled?: boolean;
}

export interface UpdateMCPServerDto extends Partial<CreateMCPServerDto> {}

export interface CallMCPToolRequest {
  serverId: string;
  toolName: string;
  arguments: Record<string, any>;
}

export interface CallMCPToolResult {
  content: Array<{
    type: string;
    text?: string;
    data?: any;
    [key: string]: any;
  }>;
  isError?: boolean;
  durationMs: number;
}
