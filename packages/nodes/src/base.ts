import {
  NodeCategory,
  WorkflowPortDefinition,
  NodeDefinitionMeta,
} from '@neuroflow/shared';
import { z } from 'zod';

export interface NodeExecutionContext {
  nodeId: string;
  parameters: Record<string, any>;
  inputData: any;
  workflowContext: Record<string, any>;
  signal?: AbortSignal;
  credentials?: Record<string, any>;
  log?: (message: string, data?: any) => void;
}

export interface NodeExecutionOutput {
  outputData: any;
  output?: any;
  selectedPort?: string; // Для ветвления: 'main', 'true', 'false', etc.
}

export interface INodeDefinition {
  type: string;
  name: string;
  description: string;
  category: NodeCategory;
  icon: string;
  color?: string;
  inputs: WorkflowPortDefinition[];
  outputs: WorkflowPortDefinition[];
  parameterSchema: z.ZodSchema<any>;
  defaultParameters: Record<string, any>;

  getMeta(): NodeDefinitionMeta;
  validateParameters(params: Record<string, any>): { valid: boolean; errors?: string[] };
  execute(context: NodeExecutionContext): Promise<NodeExecutionOutput>;
}

export abstract class BaseNodeDef implements INodeDefinition {
  abstract type: string;
  abstract name: string;
  abstract description: string;
  abstract category: NodeCategory;
  abstract icon: string;
  color?: string;
  abstract inputs: WorkflowPortDefinition[];
  abstract outputs: WorkflowPortDefinition[];
  abstract parameterSchema: z.ZodSchema<any>;
  abstract defaultParameters: Record<string, any>;

  getMeta(): NodeDefinitionMeta {
    return {
      type: this.type,
      name: this.name,
      description: this.description,
      category: this.category,
      icon: this.icon,
      color: this.color,
      inputs: this.inputs,
      outputs: this.outputs,
      parameterSchema: {},
      defaultParameters: this.defaultParameters,
    };
  }

  validateParameters(params: Record<string, any>): { valid: boolean; errors?: string[] } {
    const result = this.parameterSchema.safeParse(params);
    if (result.success) {
      return { valid: true };
    }
    const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
    return { valid: false, errors };
  }

  abstract execute(context: NodeExecutionContext): Promise<NodeExecutionOutput>;
}
