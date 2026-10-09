import { AIDebugResponse } from '@neuroflow/shared';
import { IAIProvider } from '@neuroflow/nodes';

/**
 * Маскирование токенов и секретов в текстовых логах/ошибках
 */
export function maskSensitiveString(str: string): string {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/(bearer\s+)([a-zA-Z0-9_\-\.]{6,})/gi, '$1[MASKED_SECRET]')
    .replace(/(api[_-]?key[:=\s]+["']?)([a-zA-Z0-9_\-\.]{6,})(["']?)/gi, '$1[MASKED_SECRET]$3')
    .replace(/(token[:=\s]+["']?)([a-zA-Z0-9_\-\.]{6,})(["']?)/gi, '$1[MASKED_SECRET]$3')
    .replace(/(secret-token-[a-zA-Z0-9_\-\.]+)/gi, '[MASKED_SECRET]');
}

/**
 * Рекурсивное удаление и маскирование секретов из данных перед отправкой в LLM
 */
function maskSensitiveData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') return maskSensitiveString(data);
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item));
  }

  const sensitiveKeys = ['password', 'secret', 'token', 'apikey', 'api_key', 'authorization', 'bearer'];
  const sanitized: Record<string, any> = {};

  for (const [key, val] of Object.entries(data)) {
    const isSensitive = sensitiveKeys.some((s) => key.toLowerCase().includes(s));
    if (isSensitive && typeof val === 'string') {
      sanitized[key] = '[MASKED_SECRET]';
    } else {
      sanitized[key] = maskSensitiveData(val);
    }
  }

  return sanitized;
}

export class AIDebuggerService {
  constructor(private aiProvider?: IAIProvider) {}

  public async debugExecution(options: {
    executionId: string;
    workflowName?: string;
    error: string;
    failedNode?: { id: string; type: string; parameters?: Record<string, any> };
    input?: any;
    model?: string;
  }): Promise<{
    summary: string;
    rootCause: string;
    explanation: string;
    recommendations: string[];
    suggestedNodePatch?: Record<string, any>;
  }> {
    const res: any = await AIDebuggerService.explainFailure({
      workflowName: options.workflowName,
      nodeType: options.failedNode?.type || 'action',
      nodeParameters: options.failedNode?.parameters || {},
      errorMessage: options.error,
      inputData: options.input || {},
      aiProvider: this.aiProvider!,
      model: options.model,
    });

    const recs = Array.isArray(res.recommendations) && res.recommendations.length > 0
      ? res.recommendations
      : [res.suggestedFix].filter(Boolean);

    return {
      summary: maskSensitiveString(res.summary),
      rootCause: maskSensitiveString(res.rootCause),
      explanation: maskSensitiveString(res.explanation),
      recommendations: recs.map((r: string) => maskSensitiveString(r)),
      suggestedNodePatch: res.suggestedNodePatch || res.proposedNodeParameters,
    };
  }

  /**
   * Анализ ошибки выполнения узла с предложением исправления
   */
  public static async explainFailure(options: {
    workflowName?: string;
    nodeType: string;
    nodeParameters: Record<string, any>;
    errorMessage: string;
    inputData: any;
    previousNodeOutputs?: Record<string, any>;
    aiProvider: IAIProvider;
    model?: string;
  }): Promise<AIDebugResponse> {
    const {
      workflowName,
      nodeType,
      nodeParameters,
      errorMessage,
      inputData,
      previousNodeOutputs,
      aiProvider,
      model,
    } = options;

    const safeParams = maskSensitiveData(nodeParameters);
    const safeInput = maskSensitiveData(inputData);
    const safeOutputs = maskSensitiveData(previousNodeOutputs);
    const safeErrorMessage = maskSensitiveString(errorMessage);

    const systemPrompt = `You are a Senior Debugging Engineer for NeuroFlow workflows.
An automated workflow step failed with an error. Analyze the root cause and provide a clear, actionable fix in Russian.

OUTPUT FORMAT (Reply ONLY with valid JSON):
{
  "summary": "One sentence summary of what went wrong in Russian",
  "rootCause": "Technical explanation of the exact failure cause in Russian",
  "explanation": "Clear friendly explanation for the user with context in Russian",
  "suggestedFix": "Step-by-step instructions on how to fix this in Russian",
  "recommendations": ["Actionable step 1", "Actionable step 2"],
  "proposedNodeParameters": { ...optional corrected node parameters object if applicable... }
}`;

    const contextPayload = {
      failedNodeType: nodeType,
      errorMessage: safeErrorMessage,
      configuredParameters: safeParams,
      inputDataReceived: safeInput,
      previousStepsOutputs: safeOutputs,
    };

    const userPrompt = `Debug failed execution (${workflowName || 'workflow'}):\nEXECUTION FAILURE CONTEXT:\n${JSON.stringify(contextPayload, null, 2)}`;

    const { data: rawJson } = await aiProvider.generateStructuredOutput<any>({
      systemPrompt,
      userPrompt,
      model,
      temperature: 0.2,
      responseFormat: 'json',
    });

    const recs = Array.isArray(rawJson?.recommendations)
      ? rawJson.recommendations
      : [rawJson?.suggestedFix || 'Проверьте входные параметры и сетевую доступность'];

    return {
      summary: maskSensitiveString(rawJson?.summary || `Ошибка в блоке ${nodeType}`),
      rootCause: maskSensitiveString(rawJson?.rootCause || safeErrorMessage),
      explanation: maskSensitiveString(rawJson?.explanation || 'Произошла ошибка при выполнении узла.'),
      suggestedFix: maskSensitiveString(rawJson?.suggestedFix || recs[0]),
      recommendations: recs.map((r: string) => maskSensitiveString(r)),
      proposedNodeParameters: rawJson?.proposedNodeParameters || rawJson?.suggestedNodePatch,
      suggestedNodePatch: rawJson?.suggestedNodePatch || rawJson?.proposedNodeParameters,
    } as any;
  }
}
