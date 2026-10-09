import { NodeExecutionStatus } from '@neuroflow/shared';

export class WorkflowExecutionContext {
  public executionId: string;
  public workflowId: string;
  public initialPayload: any;
  private nodeOutputs = new Map<string, any>();
  private nodeStatuses = new Map<string, NodeExecutionStatus>();
  private lastExecutedNodeId: string | null = null;
  public finalOutput: any = null;

  constructor(executionId: string, workflowId: string, initialPayload: any = {}) {
    this.executionId = executionId;
    this.workflowId = workflowId;
    this.initialPayload = initialPayload;
  }

  public setNodeResult(nodeId: string, output: any, status: NodeExecutionStatus = NodeExecutionStatus.SUCCESS): void {
    this.nodeOutputs.set(nodeId, output);
    this.nodeStatuses.set(nodeId, status);
    this.lastExecutedNodeId = nodeId;
  }

  public getNodeOutput(nodeId: string): any {
    return this.nodeOutputs.get(nodeId);
  }

  public getNodeStatus(nodeId: string): NodeExecutionStatus {
    return this.nodeStatuses.get(nodeId) || NodeExecutionStatus.PENDING;
  }

  public getLastOutput(): any {
    if (!this.lastExecutedNodeId) return this.initialPayload;
    return this.nodeOutputs.get(this.lastExecutedNodeId);
  }

  public getAllOutputs(): Record<string, any> {
    const res: Record<string, any> = {};
    for (const [key, val] of this.nodeOutputs.entries()) {
      res[key] = val;
    }
    return res;
  }

  public toJSON(): Record<string, any> {
    return {
      executionId: this.executionId,
      workflowId: this.workflowId,
      initialPayload: this.initialPayload,
      outputs: this.getAllOutputs(),
      finalOutput: this.finalOutput,
    };
  }
}
