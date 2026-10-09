import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { WorkflowGraph, ExecutionStatus } from '@neuroflow/shared';
import { WorkflowExecutor } from '../executor.js';
import { EventEmitter } from 'node:events';

export interface WorkflowExecutionJobData {
  executionId: string;
  workflowId: string;
  graph: WorkflowGraph;
  initialPayload?: any;
  triggerNodeId?: string;
}

export interface IWorkflowQueue {
  addJob(data: WorkflowExecutionJobData): Promise<void>;
  cancelJob(executionId: string): Promise<boolean>;
  onEvent(callback: (event: { type: string; executionId: string; payload: any }) => void): void;
}

export class MemoryWorkflowQueue extends EventEmitter implements IWorkflowQueue {
  private activeControllers = new Map<string, AbortController>();

  constructor() {
    super();
  }

  async addJob(data: WorkflowExecutionJobData): Promise<void> {
    const controller = new AbortController();
    this.activeControllers.set(data.executionId, controller);

    // Асинхронный запуск выполнения
    setImmediate(async () => {
      try {
        await WorkflowExecutor.execute({
          executionId: data.executionId,
          workflowId: data.workflowId,
          graph: data.graph,
          initialPayload: data.initialPayload,
          triggerNodeId: data.triggerNodeId,
          signal: controller.signal,
          events: {
            onExecutionStart: (id) => {
              this.emit('event', { type: 'execution:start', executionId: id, payload: {} });
            },
            onNodeStart: (nodeId, nodeType) => {
              this.emit('event', { type: 'node:start', executionId: data.executionId, payload: { nodeId, nodeType } });
            },
            onNodeComplete: (nodeId, nodeType, output, durationMs, selectedPort) => {
              this.emit('event', {
                type: 'node:complete',
                executionId: data.executionId,
                payload: { nodeId, nodeType, output, durationMs, selectedPort },
              });
            },
            onNodeFailed: (nodeId, nodeType, error, durationMs) => {
              this.emit('event', {
                type: 'node:failed',
                executionId: data.executionId,
                payload: { nodeId, nodeType, error, durationMs },
              });
            },
            onNodeSkipped: (nodeId, nodeType, reason) => {
              this.emit('event', {
                type: 'node:skipped',
                executionId: data.executionId,
                payload: { nodeId, nodeType, reason },
              });
            },
            onExecutionComplete: (id, status, finalOutput, durationMs, error) => {
              this.emit('event', {
                type: 'execution:complete',
                executionId: id,
                payload: { status, finalOutput, durationMs, error },
              });
            },
          },
        });
      } catch (err: any) {
        this.emit('event', {
          type: 'execution:complete',
          executionId: data.executionId,
          payload: { status: ExecutionStatus.FAILED, error: err.message },
        });
      } finally {
        this.activeControllers.delete(data.executionId);
      }
    });
  }

  async cancelJob(executionId: string): Promise<boolean> {
    const controller = this.activeControllers.get(executionId);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(executionId);
      return true;
    }
    return false;
  }

  onEvent(callback: (event: { type: string; executionId: string; payload: any }) => void): void {
    this.on('event', callback);
  }
}

export class BullMQWorkflowQueue extends EventEmitter implements IWorkflowQueue {
  private queue: Queue;
  private redisConnection: Redis;
  private activeControllers = new Map<string, AbortController>();

  constructor(redisUrl: string) {
    super();
    this.redisConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue('neuroflow-executions', { connection: this.redisConnection });
  }

  async addJob(data: WorkflowExecutionJobData): Promise<void> {
    await this.queue.add('execute-workflow', data, {
      jobId: data.executionId,
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  async cancelJob(executionId: string): Promise<boolean> {
    const job = await this.queue.getJob(executionId);
    if (job) {
      await job.discard();
      return true;
    }
    return false;
  }

  onEvent(callback: (event: { type: string; executionId: string; payload: any }) => void): void {
    this.on('event', callback);
  }
}

let queueInstance: IWorkflowQueue | null = null;

export function getWorkflowQueue(): IWorkflowQueue {
  if (queueInstance) return queueInstance;

  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl && (redisUrl.startsWith('redis://') || redisUrl.startsWith('rediss://'))) {
    try {
      queueInstance = new BullMQWorkflowQueue(redisUrl);
      return queueInstance;
    } catch {
      // Fallback
    }
  }

  queueInstance = new MemoryWorkflowQueue();
  return queueInstance;
}
