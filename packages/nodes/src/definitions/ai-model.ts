import { BaseNodeDef, NodeExecutionContext, NodeExecutionOutput } from '../base.js';
import { NodeCategory, WorkflowPortDefinition } from '@neuroflow/shared';
import { AIModelParametersSchema } from '@neuroflow/shared';
import { AIProviderFactory } from '../ai/provider-factory.js';
import { getDatabase, aiProviders, eq } from '@neuroflow/database';

/**
 * Безопасное получение значения по dot-нотации из объекта
 */
function getNestedValue(obj: any, path: string): any {
  if (!obj || typeof obj !== 'object' || !path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Защита от prompt injection: нейтрализует разделители системных инструкций
 */
function sanitizeInputDataForPrompt(val: any): string {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);

  // Обезвреживаем разделители LLM (OpenAI ChatML, Llama prompt tokens, Claude tags)
  return str
    .replace(/<\|im_start\|>/g, '[im_start]')
    .replace(/<\|im_end\|>/g, '[im_end]')
    .replace(/\[INST\]/g, '[_INST_]')
    .replace(/\[\/INST\]/g, '[_/INST_]')
    .replace(/###\s*(System|Instruction|Human|Assistant):/gi, '--- $1:');
}

/**
 * Безопасная подстановка плейсхолдеров типа {{order.id}}
 */
function interpolatePrompt(template: string, inputData: any): string {
  if (!template || typeof template !== 'string') return '';

  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, path) => {
    // Если передан {{json}} или {{input}}
    if (path === 'input' || path === 'data' || path === 'json') {
      return sanitizeInputDataForPrompt(inputData);
    }

    const val = getNestedValue(inputData, path);
    if (val !== undefined) {
      return sanitizeInputDataForPrompt(val);
    }
    return match; // Оставляем без изменений если ключ не найден
  });
}

export class AIModelNode extends BaseNodeDef {
  type = 'ai-model';
  name = 'AI Model';
  description = 'Генерация текста и структурированного JSON через LLM (OpenAI, Gemini, Claude, Ollama, Custom)';
  category = NodeCategory.AI;
  icon = 'Sparkles';
  color = '#8B5CF6';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Данные от предыдущего узла для промпта' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Output', type: 'main', description: 'Ответ модели (текст и JSON)' },
  ];

  parameterSchema = AIModelParametersSchema;
  defaultParameters = {
    providerId: '',
    model: 'default',
    systemPrompt: 'You are a helpful automation assistant. Provide concise and accurate answers.',
    userPrompt: 'Process the following input: {{input}}',
    temperature: 0.7,
    maxTokens: 2048,
    responseFormat: 'text',
    timeoutMs: 30000,
    retryCount: 2,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const inputData = (context as any).inputData ?? (context as any).input ?? {};

    // 1. Подстановка и санитизация промптов
    const rawUserPrompt = params.userPrompt || this.defaultParameters.userPrompt;
    const interpolatedUserPrompt = interpolatePrompt(rawUserPrompt, inputData);

    const rawSystemPrompt = params.systemPrompt !== undefined ? params.systemPrompt : this.defaultParameters.systemPrompt;
    const interpolatedSystemPrompt = interpolatePrompt(rawSystemPrompt, inputData);

    // 2. Получение провайдера (с приоритетом зарегистрированного в памяти мока/инстанса)
    const providerKey = params.providerId || params.provider;
    let provider: any = undefined;

    if (providerKey) {
      provider = AIProviderFactory.getInstance(providerKey);
      if (!provider) {
        try {
          provider = await AIProviderFactory.getInstance().getProvider(providerKey);
        } catch {
          // Игнорируем
        }
      }
    }

    // Если экземпляр не найден в памяти, пытаемся загрузить из БД
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

    // Если провайдер всё еще не выбран, берем дефолтный из БД
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
        } else {
          // Берем первый активный
          const [firstActive] = await db
            .select()
            .from(aiProviders)
            .where(eq(aiProviders.isEnabled, true))
            .limit(1);
          if (firstActive) {
            provider = AIProviderFactory.createProvider(firstActive);
          }
        }
      } catch {
        // Игнорируем
      }
    }

    // Fallback: зарегистрированные провайдеры в фабрике
    if (!provider) {
      try {
        provider = await AIProviderFactory.getInstance().getDefaultProvider();
      } catch {
        // Игнорируем
      }
    }

    if (!provider) {
      provider = AIProviderFactory.getInstance('default') || AIProviderFactory.getInstance('mock-provider');
    }

    if (!provider) {
      throw new Error(
        'Не найден активный AI провайдер. Пожалуйста, добавьте API ключ в настройках (Settings -> AI Providers).'
      );
    }

    // 3. Выполнение запроса с retry policy
    const retryCount = params.retryCount ?? 2;
    let lastError: any = null;
    let result: any = null;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        if (attempt > 0) {
          // Exponential backoff
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise((r) => setTimeout(r, delayMs));
        }

        result = await provider.generateText({
          model: params.model !== 'default' && params.model ? params.model : undefined,
          systemPrompt: interpolatedSystemPrompt,
          userPrompt: interpolatedUserPrompt,
          prompt: interpolatedUserPrompt,
          temperature: params.temperature,
          maxTokens: params.maxTokens,
          responseFormat: params.responseFormat,
          signal: context.signal,
        });

        break; // Успешно!
      } catch (err: any) {
        lastError = err;
        if (context.signal?.aborted) {
          throw err;
        }
      }
    }

    if (!result) {
      throw new Error(`Ошибка вызова AI Model (${provider.name}): ${lastError?.message || 'Не удалось получить ответ'}`);
    }

    if (params.responseFormat === 'json' && result.json === undefined && result.text) {
      try {
        result.json = JSON.parse(result.text);
      } catch {
        const clean = result.text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
        try {
          result.json = JSON.parse(clean);
        } catch {}
      }
    }

    const outputData = {
      text: result.text,
      json: result.json,
      data: result.json,
      model: result.model,
      usage: result.usage,
      durationMs: result.durationMs,
      metadata: {
        provider: providerKey || provider.id || provider.name || 'ai-provider',
        model: result.model,
      },
      prompt: {
        user: interpolatedUserPrompt,
        system: interpolatedSystemPrompt,
      },
    };

    return {
      outputData,
      output: outputData,
      selectedPort: 'main',
    };
  }
}
