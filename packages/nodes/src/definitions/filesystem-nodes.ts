import { BaseNodeDef, NodeExecutionContext, NodeExecutionOutput } from '../base.js';
import {
  NodeCategory,
  WorkflowPortDefinition,
  ReadFileParametersSchema,
  WriteFileParametersSchema,
  ListDirectoryParametersSchema,
  FileChangedTriggerParametersSchema,
} from '@neuroflow/shared';
import { FilesystemSandbox } from '../integrations/filesystem-sandbox.js';

function getSandbox(context: NodeExecutionContext): FilesystemSandbox {
  const allowedRoots =
    (context.parameters as any)?.allowedRoots ||
    (context.workflowContext as any)?.filesystemAllowedRoots ||
    ['./data/storage'];
  const maxMb = (context.parameters as any)?.maxFileSizeMb || 25;
  return new FilesystemSandbox(allowedRoots, maxMb);
}

function interpolateString(template: string, data: Record<string, any>): string {
  if (!template || typeof template !== 'string') return template;
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const trimmed = key.trim();
    const parts = trimmed.split('.');
    let val: any = data;
    for (const part of parts) {
      if (val && typeof val === 'object' && part in val) {
        val = val[part];
      } else {
        return `{{${trimmed}}}`;
      }
    }
    return val !== undefined ? String(val) : '';
  });
}

// 1. Read File Node
export class ReadFileNode extends BaseNodeDef {
  type = 'read-file';
  name = 'Read File';
  description = 'Безопасное чтение файлов (JSON, TXT, Markdown, CSV, Base64) из разрешенной песочницы';
  category = NodeCategory.FILESYSTEM;
  icon = 'FileText';
  color = '#10B981';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Входящие параметры пути' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'File Content', type: 'main', description: 'Содержимое прочитанного файла' },
  ];

  parameterSchema = ReadFileParametersSchema;
  defaultParameters = {
    filePath: '',
    encoding: 'utf-8' as const,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const input = (context as any).inputData ?? (context as any).input ?? {};
    const fullContext = { ...context.workflowContext, ...input };

    const rawPath = params.filePath || input.filePath || input.path;
    const filePath = interpolateString(rawPath || '', fullContext);

    if (!filePath) {
      throw new Error('[Read File] Не указан путь к файлу.');
    }

    const sandbox = getSandbox(context);
    const result = await sandbox.readFile(filePath, params.encoding || this.defaultParameters.encoding);

    context.log?.(`[Filesystem] Прочитан файл "${filePath}" (${result.size} байт)`);

    const outputData = {
      filePath: result.path,
      content: result.content,
      text: typeof result.content === 'string' ? result.content : JSON.stringify(result.content),
      sizeBytes: result.size,
    };

    return {
      outputData,
      output: outputData,
      selectedPort: 'main',
    };
  }
}

// 2. Write File Node
export class WriteFileNode extends BaseNodeDef {
  type = 'write-file';
  name = 'Write File';
  description = 'Безопасная запись или дозапись файла в песочнице с защитой от Path Traversal';
  category = NodeCategory.FILESYSTEM;
  icon = 'FileSignature';
  color = '#10B981';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Данные для записи' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Write Result', type: 'main', description: 'Результат операции записи' },
  ];

  parameterSchema = WriteFileParametersSchema;
  defaultParameters = {
    filePath: '',
    content: '',
    mode: 'overwrite' as const,
    requiresApproval: false,
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const input = (context as any).inputData ?? (context as any).input ?? {};
    const fullContext = { ...context.workflowContext, ...input };

    const rawPath = params.filePath || input.filePath || input.path;
    const filePath = interpolateString(rawPath || '', fullContext);

    if (!filePath) {
      throw new Error('[Write File] Не указан путь к файлу.');
    }

    const rawContent = params.content ?? input.content ?? input.text ?? input.response;
    const content = typeof rawContent === 'string' ? interpolateString(rawContent, fullContext) : rawContent;

    if (params.requiresApproval) {
      return {
        outputData: {
          waitingForApproval: true,
          actionTitle: `Запись в файл: ${filePath}`,
          consequences: `Файл будет ${params.mode === 'append' ? 'дополнен' : 'перезаписан'} новыми данными.`,
          payload: { filePath, mode: params.mode, size: typeof content === 'string' ? content.length : undefined },
        },
        output: null,
        selectedPort: 'main',
      };
    }

    const sandbox = getSandbox(context);
    const result = await sandbox.writeFile(filePath, content, {
      mode: params.mode || this.defaultParameters.mode,
      createParentDirs: true,
    });

    context.log?.(`[Filesystem] Записан файл "${result.path}" (${result.writtenBytes} байт)`);

    const outputData = {
      success: true,
      filePath: result.path,
      writtenBytes: result.writtenBytes,
      mode: params.mode || this.defaultParameters.mode,
    };

    return {
      outputData,
      output: outputData,
      selectedPort: 'main',
    };
  }
}

// 3. List Directory Node
export class ListDirectoryNode extends BaseNodeDef {
  type = 'list-directory';
  name = 'List Directory';
  description = 'Просмотр списка файлов и папок в разрешенной директории';
  category = NodeCategory.FILESYSTEM;
  icon = 'Folder';
  color = '#10B981';

  inputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Input', type: 'main', description: 'Параметры директории' },
  ];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'Files List', type: 'main', description: 'Список найденных файлов' },
  ];

  parameterSchema = ListDirectoryParametersSchema;
  defaultParameters = {
    directoryPath: '.',
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const params = context.parameters || {};
    const input = (context as any).inputData ?? (context as any).input ?? {};
    const fullContext = { ...context.workflowContext, ...input };

    const rawPath = params.directoryPath || input.directoryPath || '.';
    const dirPath = interpolateString(rawPath, fullContext);

    const sandbox = getSandbox(context);
    const files = await sandbox.listDirectory(dirPath);

    const outputData = {
      directory: dirPath,
      total: files.length,
      files,
    };

    return {
      outputData,
      output: outputData,
      selectedPort: 'main',
    };
  }
}

// 4. File Changed Trigger Node
export class FileChangedTriggerNode extends BaseNodeDef {
  type = 'file-changed-trigger';
  name = 'File Changed Trigger';
  description = 'Срабатывает при создании, изменении или удалении файлов в отслеживаемой папке';
  category = NodeCategory.FILESYSTEM;
  icon = 'FolderSync';
  color = '#10B981';

  inputs: WorkflowPortDefinition[] = [];
  outputs: WorkflowPortDefinition[] = [
    { id: 'main', name: 'File Event', type: 'main', description: 'Данные события файла' },
  ];

  parameterSchema = FileChangedTriggerParametersSchema;
  defaultParameters = {
    directoryPath: './data/storage',
    events: ['add', 'change'] as ('add' | 'change' | 'unlink')[],
  };

  async execute(context: NodeExecutionContext): Promise<NodeExecutionOutput> {
    const input = (context as any).inputData ?? (context as any).input ?? {};
    const params = context.parameters || {};

    const eventType = input.eventType || input.event || 'change';
    const allowedEvents = params.events || this.defaultParameters.events;

    if (allowedEvents.length > 0 && !allowedEvents.includes(eventType)) {
      return { outputData: null, output: null, selectedPort: 'main' };
    }

    const payload = {
      eventType,
      filePath: input.filePath || input.path,
      fileName: input.fileName,
      size: input.size,
      timestamp: input.timestamp || new Date().toISOString(),
      raw: input,
    };

    return {
      outputData: payload,
      output: payload,
      selectedPort: 'main',
    };
  }
}
