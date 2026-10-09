import { describe, it, expect } from 'vitest';
import { WorkflowGenerator } from '../packages/workflow-engine/src/ai/workflow-generator.js';
import { WorkflowValidator } from '../packages/workflow-engine/src/validator.js';
import { MockAIProvider } from '../packages/nodes/src/ai/mock-provider.js';
import { ProviderFactory } from '../packages/nodes/src/ai/provider-factory.js';

describe('AI Workflow Generator Service', () => {
  it('должен генерировать валидный DAG-граф сценария на основе NodeRegistry', async () => {
    const mock = new MockAIProvider();
    ProviderFactory.getInstance().registerProvider('mock-generator-test', mock, true);

    const generator = new WorkflowGenerator(mock);

    const result = await generator.generateWorkflow({
      prompt: 'Сделай сценарий, который делает HTTP GET запрос и затем передает данные в AI Model',
    });

    expect(result.name).toBeDefined();
    expect(result.graph).toBeDefined();
    expect(result.graph.nodes.length).toBeGreaterThanOrEqual(2);
    expect(result.graph.edges.length).toBeGreaterThanOrEqual(1);

    // Проверяем валидность графа через стандартный WorkflowValidator движка
    const validator = new WorkflowValidator();
    const validationResult = validator.validate({
      id: 'generated-wf-1',
      name: result.name,
      graph: result.graph,
    });

    expect(validationResult.valid).toBe(true);
    expect(validationResult.errors).toHaveLength(0);
  });

  it('должен отсекать галлюцинированные типы узлов, которых нет в реестре', async () => {
    // Создаем провайдер, который возвращает несуществующий блок 'send-magic-telepathy'
    const hallucinatedGraph = {
      name: 'Hallucinated Workflow',
      description: 'Test invalid nodes',
      graph: {
        nodes: [
          { id: 't1', type: 'manual-trigger', label: 'Start' },
          { id: 'm1', type: 'send-magic-telepathy', label: 'Magic' }, // Несуществующий узел!
          { id: 'o1', type: 'output', label: 'End' },
        ],
        edges: [
          { id: 'e1', source: 't1', target: 'm1' },
          { id: 'e2', source: 'm1', target: 'o1' },
        ],
      },
    };

    const mock = new MockAIProvider({
      cannedResponses: {
        'Test prompt': JSON.stringify(hallucinatedGraph),
      },
    });

    const generator = new WorkflowGenerator(mock);
    const result = await generator.generateWorkflow({
      prompt: 'Test prompt',
    });

    // Несуществующий узел 'send-magic-telepathy' должен быть отфильтрован
    const nodeTypes = result.graph.nodes.map((n) => n.type);
    expect(nodeTypes).not.toContain('send-magic-telepathy');
    expect(nodeTypes).toContain('manual-trigger');
  });

  it('auto-layout должен расставлять координаты узлов без нулевых или одинаковых позиций', async () => {
    const mock = new MockAIProvider();
    const generator = new WorkflowGenerator(mock);

    const result = await generator.generateWorkflow({
      prompt: 'Триггер, условие и два выхода',
    });

    const positions = result.graph.nodes.map((n) => n.position);
    for (const pos of positions) {
      expect(pos).toBeDefined();
      expect(typeof pos.x).toBe('number');
      expect(typeof pos.y).toBe('number');
    }

    // Проверяем, что узлы не слипаются в точку (0,0)
    const distinctX = new Set(positions.map((p) => p.x));
    expect(distinctX.size).toBeGreaterThan(1);
  });
});
