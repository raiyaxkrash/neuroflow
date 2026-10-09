import {
  WorkflowGraph,
  AICopilotMessage,
  AICopilotAction,
  AICopilotResponse,
  WorkflowGraphSchema,
} from '@neuroflow/shared';
import { getNodeRegistry, IAIProvider } from '@neuroflow/nodes';
import { WorkflowValidator } from '../validator.js';
import { autoLayoutGraph } from './workflow-generator.js';

export class AICopilotService {
  constructor(private aiProvider?: IAIProvider) {}

  public async processChat(options: {
    message: string;
    currentGraph: WorkflowGraph;
    history?: { role: 'user' | 'assistant'; content: string }[];
    model?: string;
  }): Promise<AICopilotResponse> {
    const msgs: AICopilotMessage[] = [
      ...(options.history || []).map((h) => ({ role: h.role as any, content: h.content })),
      { role: 'user', content: options.message },
    ];
    return AICopilotService.processMessage({
      messages: msgs,
      currentGraph: options.currentGraph,
      aiProvider: this.aiProvider!,
      model: options.model,
    });
  }

  /**
   * Интеллектуальная обработка команд в чате Copilot
   */
  public static async processMessage(options: {
    messages: AICopilotMessage[];
    currentGraph: WorkflowGraph;
    aiProvider: IAIProvider;
    model?: string;
  }): Promise<AICopilotResponse> {
    const { messages, currentGraph, aiProvider, model } = options;
    const registry = getNodeRegistry();

    const availableNodes = registry.getAllMeta().map((m) => ({
      type: m.type,
      name: m.name,
      description: m.description,
      inputs: m.inputs.map((p) => p.id),
      outputs: m.outputs.map((p) => p.id),
    }));

    const systemPrompt = `You are NeuroFlow AI Copilot, a collaborative assistant embedded in the workflow editor.
The user is working on an interactive canvas. You can inspect the current graph, answer questions, explain logic, and propose atomic modifications.

CURRENT WORKFLOW GRAPH ON CANVAS:
${JSON.stringify(currentGraph, null, 2)}

ALLOWED NODE REGISTRY:
${JSON.stringify(availableNodes, null, 2)}

CAPABILITIES:
1. If the user asks a question or for explanation/optimization, provide a helpful answer in Russian.
2. If the user asks to modify the workflow (add node, connect nodes, delete node, optimize, branch), produce a list of proposed actions AND the resulting full updated graph.
3. Every modification must result in a valid Directed Acyclic Graph (DAG) using only allowed node types.

OUTPUT FORMAT (Respond ONLY with valid JSON):
{
  "reply": "Your message to the user in Russian explaining what you analyzed or changed",
  "hasModifications": true|false,
  "actions": [
    {
      "type": "add_node|remove_node|connect_nodes|update_parameters|replace_graph",
      "description": "Short human-readable summary of action in Russian",
      "payload": {}
    }
  ],
  "proposedGraph": { ...optional full updated WorkflowGraph if modifications were requested... }
}`;

    // Формируем диалог
    const recentMessages = messages.slice(-8);
    const lastUserMessage = recentMessages[recentMessages.length - 1]?.content || 'Analyze this workflow.';

    const dialogContext = recentMessages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    const { data: rawJson } = await aiProvider.generateStructuredOutput<any>({
      systemPrompt,
      userPrompt: `CONVERSATION HISTORY:\n${dialogContext}\n\nLATEST REQUEST: "${lastUserMessage}"`,
      model,
      temperature: 0.3,
      responseFormat: 'json',
    });

    const reply = rawJson?.reply || 'Анализ завершен.';
    const actions: AICopilotAction[] = Array.isArray(rawJson?.actions) ? rawJson.actions : [];
    let proposedGraph: WorkflowGraph | undefined = undefined;

    if (rawJson?.hasModifications && rawJson?.proposedGraph?.nodes) {
      const parsed = WorkflowGraphSchema.safeParse(rawJson.proposedGraph);
      if (parsed.success) {
        // Проверка узлов
        let validTypes = true;
        for (const n of parsed.data.nodes) {
          if (!registry.getNode(n.type)) {
            validTypes = false;
            break;
          }
        }

        if (validTypes) {
          const layouted = autoLayoutGraph(parsed.data);
          const val = WorkflowValidator.validate(layouted);
          if (val.valid) {
            proposedGraph = layouted;
          }
        }
      }
    }

    const assistantMessage: AICopilotMessage = {
      role: 'assistant',
      content: reply,
      timestamp: new Date().toISOString(),
      actions: actions.length > 0 ? actions : undefined,
    };

    return {
      reply,
      message: assistantMessage,
      proposedGraph,
      actions,
      explanation: reply,
    };
  }
}
