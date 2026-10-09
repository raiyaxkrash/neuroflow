import { INodeDefinition } from './base.js';
import { NodeCategory, NodeDefinitionMeta } from '@neuroflow/shared';
import { ManualTriggerNode } from './definitions/manual-trigger.js';
import { HttpRequestNode } from './definitions/http-request.js';
import { ConditionNode } from './definitions/condition.js';
import { SetDataNode } from './definitions/set-data.js';
import { DelayNode } from './definitions/delay.js';
import { OutputNode } from './definitions/output.js';
import { AIModelNode } from './definitions/ai-model.js';
import { AIAgentNode } from './definitions/ai-agent.js';
import { AgentSupervisorNode } from './definitions/agent-supervisor.js';
import { AgentHandoffNode } from './definitions/agent-handoff.js';
import { AgentMemoryNode } from './definitions/agent-memory.js';
import { ToolExecutorNode } from './definitions/tool-executor.js';
import { HumanApprovalNode } from './definitions/human-approval.js';
import { MCPToolNode } from './definitions/mcp-tool.js';

export class NodeRegistry {
  private nodes = new Map<string, INodeDefinition>();

  constructor() {
    this.registerBuiltInNodes();
  }

  private registerBuiltInNodes(): void {
    this.register(new ManualTriggerNode());
    this.register(new HttpRequestNode());
    this.register(new ConditionNode());
    this.register(new SetDataNode());
    this.register(new DelayNode());
    this.register(new OutputNode());
    this.register(new AIModelNode());
    this.register(new AIAgentNode());
    this.register(new AgentSupervisorNode());
    this.register(new AgentHandoffNode());
    this.register(new AgentMemoryNode());
    this.register(new ToolExecutorNode());
    this.register(new HumanApprovalNode());
    this.register(new MCPToolNode());
  }

  public static getInstance(): NodeRegistry {
    return getNodeRegistry();
  }

  public register(node: INodeDefinition): void {
    if (this.nodes.has(node.type)) {
      throw new Error(`Узел с типом "${node.type}" уже зарегистрирован в NodeRegistry.`);
    }
    this.nodes.set(node.type, node);
  }

  public getNode(type: string): INodeDefinition | undefined {
    return this.nodes.get(type);
  }

  public get(type: string): INodeDefinition | undefined {
    return this.getNode(type);
  }

  public getAll(): INodeDefinition[] {
    return Array.from(this.nodes.values());
  }

  public getAllMeta(): NodeDefinitionMeta[] {
    return this.getAll().map((node) => node.getMeta());
  }

  public getByCategory(category: NodeCategory): INodeDefinition[] {
    return this.getAll().filter((n) => n.category === category);
  }

  public validateNodeParameters(type: string, params: Record<string, any>): { valid: boolean; errors?: string[] } {
    const node = this.getNode(type);
    if (!node) {
      return { valid: false, errors: [`Неизвестный тип узла: ${type}`] };
    }
    return node.validateParameters(params);
  }
}

let defaultRegistryInstance: NodeRegistry | null = null;

export function getNodeRegistry(): NodeRegistry {
  if (!defaultRegistryInstance) {
    defaultRegistryInstance = new NodeRegistry();
  }
  return defaultRegistryInstance;
}
