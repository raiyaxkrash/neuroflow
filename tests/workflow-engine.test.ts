import { describe, it, expect } from 'vitest';
import { getNodeRegistry } from '../packages/nodes/src/registry.js';
import { WorkflowValidator } from '../packages/workflow-engine/src/validator.js';
import { WorkflowExecutor } from '../packages/workflow-engine/src/executor.js';
import { ExecutionStatus, NodeExecutionStatus, ConditionOperator } from '../packages/shared/src/enums.js';
import { WorkflowGraph } from '../packages/shared/src/types.js';

describe('Workflow Engine & Node System', () => {
  it('должен регистрировать все 6 обязательных узлов первой фазы', () => {
    const registry = getNodeRegistry();
    const nodes = registry.getAll();

    expect(nodes.length).toBeGreaterThanOrEqual(6);

    const types = nodes.map((n) => n.type);
    expect(types).toContain('manual-trigger');
    expect(types).toContain('http-request');
    expect(types).toContain('condition');
    expect(types).toContain('set-data');
    expect(types).toContain('delay');
    expect(types).toContain('output');
  });

  it('должен выявлять недопустимые циклы в графе (Cycle Detection)', () => {
    const cyclicGraph: WorkflowGraph = {
      nodes: [
        { id: 'node_1', type: 'manual-trigger', position: { x: 0, y: 0 }, data: { label: 'Start', type: 'manual-trigger', parameters: {} } },
        { id: 'node_2', type: 'set-data', position: { x: 100, y: 0 }, data: { label: 'Set', type: 'set-data', parameters: {} } },
        { id: 'node_3', type: 'delay', position: { x: 200, y: 0 }, data: { label: 'Delay', type: 'delay', parameters: { seconds: 1 } } },
      ],
      edges: [
        { id: 'e1', source: 'node_1', target: 'node_2' },
        { id: 'e2', source: 'node_2', target: 'node_3' },
        { id: 'e3', source: 'node_3', target: 'node_2' }, // Цикл: 2 -> 3 -> 2
      ],
    };

    const validation = WorkflowValidator.validate(cyclicGraph);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((err) => err.includes('цикл'))).toBe(true);
  });

  it('должен валидировать корректный ациклический граф (DAG)', () => {
    const validGraph: WorkflowGraph = {
      nodes: [
        { id: 'trigger', type: 'manual-trigger', position: { x: 0, y: 0 }, data: { label: 'Trigger', type: 'manual-trigger', parameters: {} } },
        { id: 'output', type: 'output', position: { x: 200, y: 0 }, data: { label: 'Output', type: 'output', parameters: {} } },
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'output' },
      ],
    };

    const validation = WorkflowValidator.validate(validGraph);
    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  it('должен выполнять реальный сценарий с ветвлением Condition, Set Data и Output', async () => {
    const scenarioGraph: WorkflowGraph = {
      nodes: [
        // 1. Trigger
        {
          id: 'n_trigger',
          type: 'manual-trigger',
          position: { x: 0, y: 0 },
          data: { label: 'Trigger', type: 'manual-trigger', parameters: {} },
        },
        // 2. Set Data
        {
          id: 'n_set_data',
          type: 'set-data',
          position: { x: 200, y: 0 },
          data: {
            label: 'Set Order Data',
            type: 'set-data',
            parameters: {
              operations: [
                { targetKey: 'order.status', sourceValue: 'approved', valueType: 'string' },
                { targetKey: 'order.total', sourceValue: '150', valueType: 'number' },
              ],
            },
          },
        },
        // 3. Condition
        {
          id: 'n_condition',
          type: 'condition',
          position: { x: 400, y: 0 },
          data: {
            label: 'Check Status',
            type: 'condition',
            parameters: {
              leftValue: 'order.status',
              operator: ConditionOperator.EQUALS,
              rightValue: 'approved',
            },
          },
        },
        // 4. Output True Branch
        {
          id: 'n_out_true',
          type: 'output',
          position: { x: 600, y: -100 },
          data: {
            label: 'Success Output',
            type: 'output',
            parameters: { customKey: 'approvedResult' },
          },
        },
        // 5. Output False Branch
        {
          id: 'n_out_false',
          type: 'output',
          position: { x: 600, y: 100 },
          data: {
            label: 'Rejected Output',
            type: 'output',
            parameters: { customKey: 'rejectedResult' },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'n_trigger', target: 'n_set_data' },
        { id: 'e2', source: 'n_set_data', target: 'n_condition' },
        { id: 'e3', source: 'n_condition', target: 'n_out_true', sourceHandle: 'true' },
        { id: 'e4', source: 'n_condition', target: 'n_out_false', sourceHandle: 'false' },
      ],
    };

    const completedNodes: string[] = [];
    const skippedNodes: string[] = [];

    const result = await WorkflowExecutor.execute({
      executionId: 'test_exec_001',
      workflowId: 'test_wf_001',
      graph: scenarioGraph,
      initialPayload: { initialPing: true },
      saveToDatabase: false, // In-memory для unit теста
      events: {
        onNodeComplete: (nodeId) => {
          completedNodes.push(nodeId);
        },
        onNodeSkipped: (nodeId) => {
          skippedNodes.push(nodeId);
        },
      },
    });

    expect(result.status).toBe(ExecutionStatus.SUCCESS);
    expect(completedNodes).toContain('n_trigger');
    expect(completedNodes).toContain('n_set_data');
    expect(completedNodes).toContain('n_condition');
    expect(completedNodes).toContain('n_out_true');

    // Проверяем, что неактивная ветка (False) была пропущена!
    expect(completedNodes).not.toContain('n_out_false');
    expect(skippedNodes).toContain('n_out_false');

    // Проверяем результат
    expect(result.finalOutput).toBeDefined();
    expect(result.finalOutput.approvedResult).toBeDefined();
    expect(result.finalOutput.approvedResult.order.status).toBe('approved');
    expect(result.finalOutput.approvedResult.order.total).toBe(150);
  });
});
