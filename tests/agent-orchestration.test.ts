import { describe, it, expect, beforeEach } from 'vitest';
import { NodeRegistry } from '../packages/nodes/src/registry.js';
import { AIAgentNode } from '../packages/nodes/src/definitions/ai-agent.js';
import { AgentHandoffNode } from '../packages/nodes/src/definitions/agent-handoff.js';
import { AgentMemoryNode } from '../packages/nodes/src/definitions/agent-memory.js';
import { AgentSupervisorNode } from '../packages/nodes/src/definitions/agent-supervisor.js';
import { MockAIProvider } from '../packages/nodes/src/ai/mock-provider.js';
import { ProviderFactory } from '../packages/nodes/src/ai/provider-factory.js';

describe('Multi-Agent Orchestration & ReAct Engine', () => {
  beforeEach(() => {
    ProviderFactory.clearInstances();
  });

  it('узлы агентов должны быть корректно зарегистрированы в NodeRegistry', () => {
    const registry = NodeRegistry.getInstance();
    expect(registry.get('ai-agent')).toBeDefined();
    expect(registry.get('agent-supervisor')).toBeDefined();
    expect(registry.get('agent-handoff')).toBeDefined();
    expect(registry.get('agent-memory')).toBeDefined();
    expect(registry.get('tool-executor')).toBeDefined();
    expect(registry.get('human-approval')).toBeDefined();
    expect(registry.get('mcp-tool')).toBeDefined();
  });

  it('AIAgentNode: выполняет ReAct цикл с вызовом инструмента calculator и формирует Final Answer', async () => {
    // Мокируем провайдер, который сначала вызывает инструмент, а затем дает финальный ответ
    let callCount = 0;
    const dynamicMock = new MockAIProvider();
    dynamicMock.generateText = async (options: any) => {
      callCount++;
      if (callCount === 1) {
        return {
          text: 'Thought: Мне нужно посчитать 42 * 2.\nAction: calculator\nAction Input: {"expression": "42 * 2"}',
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        };
      } else {
        return {
          text: 'Thought: Вычисление завершено.\nFinal Answer: Результат вычисления: 84.',
          finishReason: 'stop',
          usage: { promptTokens: 35, completionTokens: 15, totalTokens: 50 },
        };
      }
    };

    ProviderFactory.getInstance().registerProvider('test-react-provider', dynamicMock, true);

    const agentNode = new AIAgentNode();
    const result = await agentNode.execute({
      nodeId: 'agent_react_1',
      parameters: {
        providerId: 'test-react-provider',
        agentName: 'MathAgent',
        roleDescription: 'Математический ассистент',
        allowedTools: ['calculator'],
        userPrompt: 'Посчитай 42 * 2',
        maxIterations: 5,
      },
      input: { query: '42 * 2' },
      workflowContext: {},
      context: {
        executionId: 'exec_agent_1',
        workflowId: 'wf_agent_1',
        variables: {},
        env: {},
        logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
      },
    } as any);

    expect(result.output).toBe('Результат вычисления: 84.');
    expect(result.outputData.finalAnswer).toBe('Результат вычисления: 84.');
    expect(result.outputData.steps.length).toBe(2);
    // Первый шаг — вызов calculator
    expect(result.outputData.steps[0].action).toBe('calculator');
    expect(result.outputData.steps[0].observation.result).toBe(84);
    // Второй шаг — Final Answer
    expect(result.outputData.steps[1].thought).toContain('Вычисление завершено');
    expect(result.selectedPort).toBe('main');
  });

  it('AIAgentNode: переключается на порт handoff при передаче управления другому агенту', async () => {
    const handoffMock = new MockAIProvider({
      defaultResponse: 'Thought: Для этой задачи требуется специалист по безопасности.\nAction: handoff\nAction Input: {"targetAgent": "SecuritySpecialist", "reason": "Проверка прав доступа"}',
    });

    ProviderFactory.getInstance().registerProvider('test-handoff-provider', handoffMock, true);

    const agentNode = new AIAgentNode();
    const result = await agentNode.execute({
      nodeId: 'agent_handoff_source',
      parameters: {
        providerId: 'test-handoff-provider',
        agentName: 'TriageAgent',
        roleDescription: 'Маршрутизатор запросов',
        allowedTools: [],
        userPrompt: 'Проверь безопасность системы',
      },
      input: { task: 'Проверка прав' },
      workflowContext: {},
      context: {
        executionId: 'exec_handoff_1',
        workflowId: 'wf_handoff_1',
        variables: {},
        env: {},
        logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
      },
    } as any);

    expect(result.selectedPort).toBe('handoff');
    expect(result.outputData.steps[0].action).toBe('handoff');
    expect(result.outputData.steps[0].actionInput.targetAgent).toBe('SecuritySpecialist');
  });

  it('AgentHandoffNode: блокирует циклические передачи при превышении maxHandoffDepth', async () => {
    const handoffNode = new AgentHandoffNode();
    const sharedWorkflowContext: Record<string, any> = {};

    // Шаги 1, 2, 3 проходят успешно при maxDepth = 3
    for (let step = 1; step <= 3; step++) {
      const res = await handoffNode.execute({
        nodeId: `handoff_node_${step}`,
        parameters: {
          targetAgentId: `Agent_${step + 1}`,
          handoffReason: `Передача шага ${step}`,
          maxHandoffDepth: 3,
        },
        input: { data: 'task' },
        workflowContext: sharedWorkflowContext,
        context: {
          executionId: 'exec_loop_test',
          workflowId: 'wf_loop_test',
          variables: {},
          env: {},
          logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
        },
      } as any);

      expect(res.outputData.__handoffMetadata.hop).toBe(step);
    }

    // 4-й шаг должен выбросить ошибку детектирования цикла
    await expect(
      handoffNode.execute({
        nodeId: 'handoff_node_4',
        parameters: {
          targetAgentId: 'Agent_5',
          handoffReason: 'Превышение лимита',
          maxHandoffDepth: 3,
        },
        input: { data: 'task' },
        workflowContext: sharedWorkflowContext,
        context: {
          executionId: 'exec_loop_test',
          workflowId: 'wf_loop_test',
          variables: {},
          env: {},
          logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
        },
      } as any)
    ).rejects.toThrow('Agent Handoff Cycle Detected');
  });

  it('AgentMemoryNode: запись, чтение и поиск в изолированном контексте выполнения', async () => {
    const memoryNode = new AgentMemoryNode();
    const sharedWorkflowContext: Record<string, any> = {};

    // 1. Запись в память
    const writeResult = await memoryNode.execute({
      nodeId: 'mem_write',
      parameters: {
        operation: 'write',
        scope: 'execution',
        key: 'user_preferred_language',
        value: 'TypeScript',
      },
      input: {},
      workflowContext: sharedWorkflowContext,
      context: { executionId: 'exec_mem_1', workflowId: 'wf_mem_1', variables: {}, env: {} },
    } as any);

    expect(writeResult.outputData.success).toBe(true);

    // 2. Чтение из памяти
    const readResult = await memoryNode.execute({
      nodeId: 'mem_read',
      parameters: {
        operation: 'read',
        scope: 'execution',
        key: 'user_preferred_language',
      },
      input: {},
      workflowContext: sharedWorkflowContext,
      context: { executionId: 'exec_mem_1', workflowId: 'wf_mem_1', variables: {}, env: {} },
    } as any);

    expect(readResult.outputData.found).toBe(true);
    expect(readResult.outputData.value).toBe('TypeScript');

    // 3. Поиск в памяти
    const searchResult = await memoryNode.execute({
      nodeId: 'mem_search',
      parameters: {
        operation: 'search',
        scope: 'execution',
        searchQuery: 'Script',
      },
      input: {},
      workflowContext: sharedWorkflowContext,
      context: { executionId: 'exec_mem_1', workflowId: 'wf_mem_1', variables: {}, env: {} },
    } as any);

    expect(searchResult.outputData.items.length).toBe(1);
    expect(searchResult.outputData.items[0].key).toBe('user_preferred_language');
    expect(searchResult.outputData.items[0].value).toBe('TypeScript');
  });

  it('AgentSupervisorNode: анализирует задачу и делегирует её указанному воркеру', async () => {
    const supervisorMock = new MockAIProvider({
      defaultResponse: JSON.stringify({
        analysis: 'Декомпозиция задачи: обработка финансовых данных',
        plan: ['Вычислить баланс'],
        selectedRoute: 'worker1',
        delegatedTask: 'Вычислить итоговый баланс транзакций',
      }),
    });

    ProviderFactory.getInstance().registerProvider('test-supervisor-provider', supervisorMock, true);

    const supervisorNode = new AgentSupervisorNode();
    const result = await supervisorNode.execute({
      nodeId: 'supervisor_1',
      parameters: {
        providerId: 'test-supervisor-provider',
        supervisorName: 'ChiefOrchestrator',
        strategy: 'hierarchical',
        workerAgentIds: ['worker1', 'worker2'],
      },
      input: { transactions: [100, -25, 300] },
      workflowContext: {},
      context: {
        executionId: 'exec_super_1',
        workflowId: 'wf_super_1',
        variables: {},
        env: {},
        logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
      },
    } as any);

    expect(result.selectedPort).toBe('worker1');
    expect(result.outputData.delegatedTask).toBe('Вычислить итоговый баланс транзакций');
  });
});
