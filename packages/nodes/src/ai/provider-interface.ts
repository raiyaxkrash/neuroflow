import {
  AIProviderType,
  AIModelMeta,
  AIProviderCapabilities,
  GenerateTextOptions,
  GenerateTextResult,
  TestConnectionResult,
} from '@neuroflow/shared';

export interface IAIProvider {
  id: string;
  name: string;
  type: AIProviderType;
  capabilities: AIProviderCapabilities;

  /**
   * Список известных или обнаруженных моделей
   */
  getModels(): Promise<AIModelMeta[]>;

  /**
   * Тестирование доступности подключения и модели
   */
  testConnection(model?: string): Promise<TestConnectionResult>;

  /**
   * Генерация текста / ответа модели
   */
  generateText(options: GenerateTextOptions): Promise<GenerateTextResult>;

  /**
   * Структурированный вывод (JSON) с валидацией
   */
  generateStructuredOutput<T = any>(
    options: GenerateTextOptions,
    validator?: (data: any) => { valid: boolean; data?: T; error?: string }
  ): Promise<{ data: T; rawResult: GenerateTextResult }>;
}
