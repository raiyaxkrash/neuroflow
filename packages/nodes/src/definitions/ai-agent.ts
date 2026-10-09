import { BaseNodeDef, NodeExecutionContext, NodeExecutionOutput } from '../base.js';
import { NodeCategory, WorkflowPortDefinition, AIAgentParametersSchema } from '@neuroflow/shared';
import { AIProviderFactory } from '../ai/provider-factory.js';
import { UniversalToolRegistry } from '../tools/tool-registry.js';
import { getDatabase, aiProviders, mcpServers, agentExecutionLogs, eq } from '@neuroflow/database';

function interpolateAgentPrompt(template: string, inputData: any): string {
  if (!template || typeof template !== 'string') return '';
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, path) => {
    if (path === 'input' || path === 'data' || path === 'json') {
      return typeof inputData === 'object' ? JSON.stringify(inputData) : String(inputData);
    }
    const val = inputData && typeof inputData === 'object' ? inputData[path] : undefined;
    if (val !== undefined) {
      return typeof val === 'object' ? JSON.stringify(val) : String(val);
    }
    return match;
  });
}

export class AIAgentNode extends BaseNodeDef {
  type = 'ai-agent';
  name = 'AI Agent';
  description = 'Автономный AI-агент с циклом ReAct (рассуждения и вызовы инструментов), памятью и лимитами';
  category = NodeCategory.AGENT;
  icon = 'Bot';
  color = '#06B6D4';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Входная задача или контекст' },
  ];

  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Output', type: 'main', description: 'Финальный ответ агента' },
    { id: 'handoff', name: 'Handoff', type: 'main', description: 'Передача управления другому агенту' },
  ];

  parameterSchema = AIAgentParametersSchema;
  defaultParameters = {
    agentName: 'Agent',
    roleDescription: 'Autonomous problem-solving agent',
    systemInstructions: 'You are a specialized agent. Think step by step and use tools when needed.',
    userPrompt: 'Process task: {{input}}',
    providerId: '',
    model: 'default',
    temperature: 0.5,
    allowedTools: [] as string[],
    memoryScope: 'conversation',
    maxIterations: 10,
    maxToolCalls: 20,
    timeoutMs: 60000,
    tokenBudget: 8192,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const inputData = (context as any).inputData ?? (context as any).input ?? {};
    const agentName = params.agentName || this.defaultParameters.agentName;
    const roleDesc = params.roleDescription || this.defaultParameters.roleDescription;
    const maxIterations = Math.min(params.maxIterations || this.defaultParameters.maxIterations, 30);
    const maxToolCalls = Math.min(params.maxToolCalls || this.defaultParameters.maxToolCalls, 50);
    const allowedTools = params.allowedTools || [];

    // 1. Поиск AI провайдера
    let provider: any = undefined;
    const providerKey = params.providerId;

    if (providerKey) {
      provider = AIProviderFactory.getInstance(providerKey);
      if (!provider) {
        try {
          provider = await AIProviderFactory.getInstance().getProvider(providerKey);
        } catch {
          // fallback к БД
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
      throw new Error(`Для агента "${agentName}" не найден активный AI провайдер.`);
    }

    // 2. Получение списка доступных MCP серверов пользователя (для MCP инструментов)
    let activeMCPServers: any[] = [];
    try {
      const db = getDatabase();
      activeMCPServers = await db
        .select()
        .from(mcpServers)
        .where(eq(mcpServers.isEnabled, true));
    } catch {
      // Игнорируем в тестовом окружении без подключенной БД
    }

    const toolRegistry = UniversalToolRegistry.getInstance();
    const allTools = await toolRegistry.listTools(activeMCPServers);
    const agentTools = allTools.filter((t) => toolRegistry.isToolAllowed(allowedTools, t.name));

    // 3. Формирование системного промпта ReAct
    const toolsDescription = agentTools.length > 0
      ? agentTools
          .map((t) => `- ${t.name}: ${t.description} (Args Schema: ${JSON.stringify(t.inputSchema)})`)
          .join('\n')
      : 'No tools available.';

    const systemPrompt = `You are ${agentName}, ${roleDesc}.
System Instructions: ${params.systemInstructions || this.defaultParameters.systemInstructions}

Available Tools:
${toolsDescription}

When you need to use a tool, respond strictly in this format:
Thought: <your reasoning>
Action: <tool_name>
Action Input: <valid JSON arguments object>

When you want to transfer the task to another agent, respond:
Thought: <reason for handoff>
Action: handoff
Action Input: {"targetAgent": "<name or id>", "context": <json>}

When you have the final answer, respond:
Thought: <final reasoning>
Final Answer: <your final answer to the user>

Always think step-by-step. Never fabricate tool results.`;

    const rawUserPrompt = params.userPrompt || this.defaultParameters.userPrompt;
    const initialUserMessage = interpolateAgentPrompt(rawUserPrompt, inputData);

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: initialUserMessage },
    ];

    const steps: Array<{
      stepNumber: number;
      thought?: string;
      action?: string;
      actionInput?: any;
      observation?: any;
    }> = [];

    let toolCallCount = 0;
    let finalAnswer = '';
    let selectedPort = 'main';

    // 4. Цикл ReAct
    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      context.log?.(`[Agent ${agentName}] Шаг ${iteration}/${maxIterations}`);

      const response = await provider.generateText({
        model: params.model || 'default',
        messages,
        temperature: params.temperature ?? 0.5,
        maxTokens: 2048,
      });

      const assistantText = response.text || '';
      messages.push({ role: 'assistant', content: assistantText });

      // Парсинг Thought
      const thoughtMatch = assistantText.match(/Thought:\s*(.*?)(?=\nAction:|\nFinal Answer:|$)/s);
      const thought = thoughtMatch ? thoughtMatch[1].trim() : assistantText;

      // Проверка Final Answer
      const finalMatch = assistantText.match(/Final Answer:\s*([\s\S]*)$/);
      if (finalMatch) {
        finalAnswer = finalMatch[1].trim();
        steps.push({
          stepNumber: iteration,
          thought,
        });
        break;
      }

      // Проверка Action и Action Input
      const actionMatch = assistantText.match(/Action:\s*([a-zA-Z0-9_:\-]+)/);
      const actionInputMatch = assistantText.match(/Action Input:\s*(\{[\s\S]*\}|\[[\s\S]*\])/);

      if (actionMatch) {
        const action = actionMatch[1].trim();
        let actionInput: any = {};

        if (actionInputMatch) {
          try {
            actionInput = JSON.parse(actionInputMatch[1].trim());
          } catch {
            actionInput = { raw: actionInputMatch[1].trim() };
          }
        }

        // Проверка на Handoff
        if (action.toLowerCase() === 'handoff') {
          selectedPort = 'handoff';
          steps.push({
            stepNumber: iteration,
            thought,
            action: 'handoff',
            actionInput,
          });
          finalAnswer = `Управление передано агенту: ${JSON.stringify(actionInput)}`;
          break;
        }

        // Проверка лимита вызовов инструментов
        if (toolCallCount >= maxToolCalls) {
          finalAnswer = `Достигнут максимальный лимит вызова инструментов (${maxToolCalls}).`;
          break;
        }

        toolCallCount++;

        // Вызов инструмента через Registry
        const toolResult = await toolRegistry.executeTool(action, actionInput, {
          allowedTools,
          mcpServers: activeMCPServers,
          context,
        });

        const observation = toolResult.success ? toolResult.data : `Tool Error: ${toolResult.error}`;

        steps.push({
          stepNumber: iteration,
          thought,
          action,
          actionInput,
          observation,
        });

        // Возвращаем наблюдение модели в диалог
        messages.push({
          role: 'user',
          content: `Observation: ${typeof observation === 'object' ? JSON.stringify(observation) : String(observation)}`,
        });
      } else {
        // Если модель не следовала строгому формату, но дала содержательный ответ
        finalAnswer = assistantText;
        steps.push({
          stepNumber: iteration,
          thought: assistantText,
        });
        break;
      }
    }

    if (!finalAnswer) {
      finalAnswer = `Агент ${agentName} завершил выполнение по достижении максимального числа итераций (${maxIterations}).`;
    }

    // Сохранение трейса выполнения агента в БД (если доступна)
    try {
      const db = getDatabase();
      if ((context as any).executionId) {
        await db.insert(agentExecutionLogs).values({
          executionId: (context as any).executionId,
          nodeId: context.nodeId,
          agentId: agentName,
          eventType: 'agent_react_run',
          payload: {
            steps,
            finalAnswer,
            selectedPort,
            toolCalls: toolCallCount,
          },
          durationMs: 0,
        });
      }
    } catch {
      // Игнорируем в тестах
    }

    return {
      outputData: {
        agentName,
        role: roleDesc,
        finalAnswer,
        steps,
        totalIterations: steps.length,
        toolCalls: toolCallCount,
      },
      output: finalAnswer,
      selectedPort,
    };
  }
}
