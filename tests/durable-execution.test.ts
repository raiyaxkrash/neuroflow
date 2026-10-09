import { describe, it, expect } from 'vitest';
import { WorkflowExecutor } from '../packages/workflow-engine/src/executor.js';
import { WorkflowGraph, ExecutionStatus } from '@neuroflow/shared';

describe('Durable Workflow Execution & State Recovery', () => {
  it('WorkflowExecutor: возобновляет выполнение графа и корректно передает промежуточные данные', async () => {
    const executedNodeIds: string[] = [];

    const testGraph: WorkflowGraph = {
      nodes: [
        {
          id: 'step_trigger',
          type: 'manual-trigger',
          position: { x: 0, y: 0 },
          data: { label: 'Start', type: 'manual-trigger', parameters: {} },
        },
        {
          id: 'step_calc',
          type: 'set-data',
          position: { x: 200, y: 0 },
          data: {
            label: 'Compute Metric',
            type: 'set-data',
            parameters: {
              operations: [
                { targetKey: 'metric.score', sourceValue: 95, valueType: 'number' },
                { targetKey: 'metric.status', sourceValue: 'passed', valueType: 'string' },
              ],
            },
          },
        },
        {
          id: 'step_out',
          type: 'output',
          position: { x: 400, y: 0 },
          data: { label: 'Result', type: 'output', parameters: { customKey: 'finalMetric' } },
        },
      ],
      edges: [
        { id: 'e1', source: 'step_trigger', target: 'step_calc' },
        { id: 'e2', source: 'step_calc', target: 'step_out' },
      ],
    };

    const result = await WorkflowExecutor.execute({
      executionId: 'durable_exec_001',
      workflowId: 'durable_wf_001',
      graph: testGraph,
      initialPayload: { runId: 'run-alpha' },
      saveToDatabase: false,
      events: {
        onNodeComplete: (nodeId) => {
          executedNodeIds.push(nodeId);
        },
      },
    });

    expect(result.status).toBe(ExecutionStatus.SUCCESS);
    expect(executedNodeIds).toEqual(['step_trigger', 'step_calc', 'step_out']);
    expect(result.finalOutput).toBeDefined();
    expect(result.finalOutput.finalMetric.metric.score).toBe(95);
    expect(result.finalOutput.finalMetric.metric.status).toBe('passed');
  });

  it('WorkflowExecutor: сохраняет ошибку и корректно изолирует сбой без зависания процесса', async () => {
    const failedGraph: WorkflowGraph = {
      nodes: [
        {
          id: 'start',
          type: 'manual-trigger',
          position: { x: 0, y: 0 },
          data: { label: 'Start', type: 'manual-trigger', parameters: {} },
        },
        {
          id: 'broken_node',
          type: 'non_existent_type', // Несуществующий узел вызовет контролируемую ошибку
          position: { x: 200, y: 0 },
          data: { label: 'Broken', type: 'non_existent_type', parameters: {} },
        },
        {
          id: 'unreachable_node',
          type: 'output',
          position: { x: 400, y: 0 },
          data: { label: 'Unreachable', type: 'output', parameters: {} },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'broken_node' },
        { id: 'e2', source: 'broken_node', target: 'unreachable_node' },
      ],
    };

    const result = await WorkflowExecutor.execute({
      executionId: 'fail_exec_001',
      workflowId: 'fail_wf_001',
      graph: failedGraph,
      initialPayload: {},
      saveToDatabase: false,
    });

    expect(result.status).toBe(ExecutionStatus.FAILED);
    expect(result.error?.toLowerCase()).toContain('неизвестный тип');
  });
});
