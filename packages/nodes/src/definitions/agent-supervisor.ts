import { BaseNodeDef, NodeExecutionContext, NodeExecutionOutput } from '../base.js';
import { NodeCategory, WorkflowPortDefinition, AgentSupervisorParametersSchema } from '@neuroflow/shared';
import { AIProviderFactory } from '../ai/provider-factory.js';
import { getDatabase, aiProviders, eq } from '@neuroflow/database';

export class AgentSupervisorNode extends BaseNodeDef {
  type = 'agent-supervisor';
  name = 'Agent Supervisor';
  description = 'Оркестратор команды агентов: декомпозиция задач, делегирование и синтез результатов';
  category = NodeCategory.AGENT;
  icon = 'Network';
  color = '#3B82F6';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Task Input', type: 'main', description: 'Составная задача от пользователя' },
  ];

  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Final Result', type: 'main', description: 'Синтезированный результат работы команды' },
    { id: 'worker1', name: 'Worker 1', type: 'main', description: 'Делегирование воркеру 1' },
    { id: 'worker2', name: 'Worker 2', type: 'main', description: 'Делегирование воркеру 2' },
    { id: 'worker3', name: 'Worker 3', type: 'main', description: 'Делегирование воркеру 3' },
  ];

  parameterSchema = AgentSupervisorParametersSchema;
  defaultParameters = {
    supervisorName: 'Supervisor',
    strategy: 'hierarchical',
    systemInstructions: 'You are a team supervisor. Deconstruct user tasks, delegate to specialized worker agents, and synthesize final answers.',
    userGoal: 'Coordinate team to solve: {{input}}',
    workerAgentIds: [] as string[],
    providerId: '',
    model: 'default',
    maxRounds: 5,
    timeoutMs: 120000,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const inputData = (context as any).inputData ?? (context as any).input ?? {};
    const supervisorName = params.supervisorName || this.defaultParameters.supervisorName;
    const strategy = params.strategy || this.defaultParameters.strategy;

    // 1. Поиск AI провайдера
    let provider: any = undefined;
    const providerKey = params.providerId;

    if (providerKey) {
      provider = AIProviderFactory.getInstance(providerKey);
      if (!provider) {
        try {
          provider = await AIProviderFactory.getInstance().getProvider(providerKey);
        } catch {
          // fallback
        }
      }
    }

    if (!provider && providerKey) {
      try {
        const db = getDatabase();
        const [row] = await db.select().from(aiProviders).where(eq(aiProviders.id, providerKey)).limit(1);
        if (row && row.isEnabled) {
          provider = AIProviderFactory.createProvider(row);
        }
      } catch {
        // Игнорируем
      }
    }

    if (!provider) {
      try {
        const db = getDatabase();
        const [defaultRow] = await db
          .select()
          .from(aiProviders)
          .where(eq(aiProviders.isDefault, true))
          .limit(1);
        if (defaultRow && defaultRow.isEnabled) {
          provider = AIProviderFactory.createProvider(defaultRow);
        }
      } catch {
        // Игнорируем
      }
    }

    if (!provider) {
      try {
        provider = await AIProviderFactory.getInstance().getDefaultProvider();
      } catch {
        // Игнорируем
      }
    }

    if (!provider) {
      throw new Error(`Для супервизора "${supervisorName}" не найден активный AI провайдер.`);
    }

    const taskText = typeof inputData === 'object' ? JSON.stringify(inputData, null, 2) : String(inputData);
    const workers = params.workerAgentIds?.length > 0 ? params.workerAgentIds.join(', ') : 'worker1, worker2, worker3';

    // 2. Промпт планирования и оркестрации
    const planPrompt = `Task: ${taskText}

You are ${supervisorName}, orchestrating a team with strategy "${strategy}".
Available Worker Channels: ${workers}

Analyze this task:
1. Deconstruct the problem into clear subtasks.
2. Select which worker channel should handle the primary subtask or route (e.g., worker1, worker2, worker3, or main if complete).
3. Provide the synthesized coordination plan and action.

Respond strictly in valid JSON format:
{
  "analysis": "Short analysis of user goal",
  "plan": ["Step 1", "Step 2"],
  "selectedRoute": "worker1", 
  "delegatedTask": "Specific instruction for the selected worker or final answer",
  "finalSynthesis": "Summary or completed result if no further delegation needed"
}`;

    const planResponse = await provider.generateStructuredOutput({
      model: params.model || 'default',
      messages: [
        {
          role: 'system',
          content: params.systemInstructions || this.defaultParameters.systemInstructions,
        },
        { role: 'user', content: planPrompt },
      ],
      responseSchema: {
        type: 'object',
        properties: {
          analysis: { type: 'string' },
          plan: { type: 'array', items: { type: 'string' } },
          selectedRoute: { type: 'string' },
          delegatedTask: { type: 'string' },
          finalSynthesis: { type: 'string' },
        },
        required: ['analysis', 'selectedRoute', 'delegatedTask'],
      },
    });

    const parsedPlan = planResponse.data || {};
    let selectedRoute = parsedPlan.selectedRoute || 'main';

    // Проверяем, существует ли такой порт
    const validPorts = ['main', 'worker1', 'worker2', 'worker3'];
    if (!validPorts.includes(selectedRoute)) {
      selectedRoute = 'main';
    }

    return {
      outputData: {
        supervisor: supervisorName,
        strategy,
        analysis: parsedPlan.analysis,
        plan: parsedPlan.plan || [],
        delegatedTask: parsedPlan.delegatedTask,
        finalSynthesis: parsedPlan.finalSynthesis || parsedPlan.delegatedTask,
        rawInput: inputData,
      },
      output: parsedPlan.finalSynthesis || parsedPlan.delegatedTask,
      selectedPort: selectedRoute,
    };
  }
}
