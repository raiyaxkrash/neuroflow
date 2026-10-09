import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  FilesystemSandbox,
  ReadFileNode,
  WriteFileNode,
  ListDirectoryNode,
  FileChangedTriggerNode,
} from '../packages/nodes/src/index.js';

describe('Personal Filesystem Integration & Security Sandbox', () => {
  const testStorageDir = path.resolve('./.data/test_fs_sandbox_' + Date.now());

  beforeAll(async () => {
    if (!fs.existsSync(testStorageDir)) {
      fs.mkdirSync(testStorageDir, { recursive: true });
    }
    // Создаем тестовые файлы
    fs.writeFileSync(path.join(testStorageDir, 'hello.txt'), 'Hello NeuroFlow Personal Filesystem!', 'utf-8');
    fs.writeFileSync(path.join(testStorageDir, 'config.json'), JSON.stringify({ version: '4.0', status: 'ready' }), 'utf-8');
  });

  afterAll(async () => {
    try {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    } catch {
      // Игнорируем
    }
  });

  it('FilesystemSandbox: успешно читает и записывает файлы внутри разрешенного каталога', async () => {
    const sandbox = new FilesystemSandbox([testStorageDir], 10);

    const readRes = await sandbox.readFile('hello.txt');
    expect(readRes.content).toBe('Hello NeuroFlow Personal Filesystem!');
    expect(readRes.size).toBeGreaterThan(0);

    const jsonRes = await sandbox.readFile('config.json', 'json');
    expect(jsonRes.content).toEqual({ version: '4.0', status: 'ready' });

    // Запись нового файла
    const writeRes = await sandbox.writeFile('output.txt', 'Written by Sandbox');
    expect(writeRes.writtenBytes).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(testStorageDir, 'output.txt'))).toBe(true);
  });

  it('FilesystemSandbox: строго блокирует Path Traversal (../) за пределы песочницы', async () => {
    const sandbox = new FilesystemSandbox([testStorageDir], 10);

    // Попытка выхода вверх по директориям
    await expect(sandbox.readFile('../../../package.json')).rejects.toThrow(/Filesystem Sandbox Access Denied/);
    await expect(sandbox.readFile('..\\..\\Windows\\System32\\drivers\\etc\\hosts')).rejects.toThrow(/Filesystem Sandbox Access Denied/);

    // Попытка записи за пределы песочницы
    await expect(sandbox.writeFile('../escape.txt', 'evil data')).rejects.toThrow(/Filesystem Sandbox Access Denied/);
  });

  it('FilesystemSandbox: соблюдает максимальный лимит размера файла', async () => {
    const lowLimitSandbox = new FilesystemSandbox([testStorageDir], 0.0001); // ~100 байт лимит
    const largeContent = 'A'.repeat(500);

    await expect(lowLimitSandbox.writeFile('large.txt', largeContent)).rejects.toThrow(/превышает лимит/);
  });

  it('ReadFileNode & WriteFileNode: работают как узлы графа воркфлоу с интерполяцией', async () => {
    const writeNode = new WriteFileNode();
    const writeOutput = await writeNode.execute({
      nodeId: 'node_write',
      parameters: {
        filePath: 'user_report.txt',
        content: 'Report for {{user.name}} with score {{score}}',
        allowedRoots: [testStorageDir],
      },
      workflowContext: {
        user: { name: 'Alex' },
        score: 100,
      },
    });

    expect(writeOutput.outputData?.success).toBe(true);

    const readNode = new ReadFileNode();
    const readOutput = await readNode.execute({
      nodeId: 'node_read',
      parameters: {
        filePath: 'user_report.txt',
        allowedRoots: [testStorageDir],
      },
    });

    expect(readOutput.outputData?.text).toBe('Report for Alex with score 100');
  });

  it('WriteFileNode: запрашивает Human Approval при флаге requiresApproval = true', async () => {
    const writeNode = new WriteFileNode();
    const output = await writeNode.execute({
      nodeId: 'node_critical_write',
      parameters: {
        filePath: 'critical_system.conf',
        content: 'NEW_CONFIG=ENABLED',
        requiresApproval: true,
        allowedRoots: [testStorageDir],
      },
    });

    expect(output.outputData?.waitingForApproval).toBe(true);
    expect(output.output).toBeNull();
  });

  it('ListDirectoryNode: корректно возвращает список файлов в каталоге', async () => {
    const listNode = new ListDirectoryNode();
    const output = await listNode.execute({
      nodeId: 'node_list',
      parameters: {
        directoryPath: '.',
        allowedRoots: [testStorageDir],
      },
    });

    expect(output.outputData?.total).toBeGreaterThanOrEqual(2);
    expect(output.outputData?.files.some((f: any) => f.name === 'hello.txt')).toBe(true);
  });
});
