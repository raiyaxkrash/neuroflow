import fs from 'node:fs';
import path from 'node:path';

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  modifiedAt: Date;
  extension: string;
}

export class FilesystemSandbox {
  private allowedRoots: string[];
  private maxFileSizeMb: number;

  constructor(allowedRoots: string[] = ['./data/storage'], maxFileSizeMb = 25) {
    this.allowedRoots = allowedRoots.map((r) => path.resolve(r));
    this.maxFileSizeMb = maxFileSizeMb;

    // Гарантируем существование хотя бы одной базовой директории
    for (const root of this.allowedRoots) {
      try {
        if (!fs.existsSync(root)) {
          fs.mkdirSync(root, { recursive: true });
        }
      } catch {
        // Игнорируем ошибки создания в read-only окружениях
      }
    }
  }

  /**
   * Проверка и валидация безопасного пути внутри разрешенных корневых директорий.
   * Блокирует Path Traversal (../) и Symbolic Link Escape.
   */
  public resolveSafePath(userPath: string, allowMissing = false): string {
    if (!userPath || typeof userPath !== 'string') {
      throw new Error('[Filesystem Sandbox] Не указан путь к файлу.');
    }

    // Если передан относительный путь, разрешаем его относительно первого разрешенного корня
    const resolvedPath = path.isAbsolute(userPath)
      ? path.resolve(userPath)
      : path.resolve(this.allowedRoots[0] || process.cwd(), userPath);

    // Проверяем принадлежность к разрешенным директориям
    const isUnderAllowedRoot = this.allowedRoots.some((root) => {
      const relative = path.relative(root, resolvedPath);
      return !relative.startsWith('..') && !path.isAbsolute(relative);
    });

    if (!isUnderAllowedRoot) {
      throw new Error(
        `[Filesystem Sandbox Access Denied] Путь "${userPath}" выходит за пределы разрешенных директорий (${this.allowedRoots.join(', ')}). Выполнение заблокировано.`
      );
    }

    // Проверка символических ссылок для существующих файлов
    if (fs.existsSync(resolvedPath)) {
      const realPath = fs.realpathSync(resolvedPath);
      const isRealUnderRoot = this.allowedRoots.some((root) => {
        const realRoot = fs.existsSync(root) ? fs.realpathSync(root) : root;
        const relative = path.relative(realRoot, realPath);
        return !relative.startsWith('..') && !path.isAbsolute(relative);
      });

      if (!isRealUnderRoot) {
        throw new Error(
          `[Filesystem Sandbox Symlink Alert] Обнаружена символическая ссылка на путь вне песочницы: "${realPath}". Доступ запрещен.`
        );
      }
    } else if (!allowMissing) {
      throw new Error(`[Filesystem Sandbox] Файл или директория не найдена: "${userPath}"`);
    }

    return resolvedPath;
  }

  /**
   * Безопасное чтение файла с контролем лимита размера
   */
  public async readFile(
    userPath: string,
    encoding: 'utf-8' | 'json' | 'base64' = 'utf-8'
  ): Promise<{ content: any; size: number; path: string }> {
    const safePath = this.resolveSafePath(userPath);
    const stat = await fs.promises.stat(safePath);

    if (stat.isDirectory()) {
      throw new Error(`[Filesystem Sandbox] Указанный путь является директорией, а не файлом: "${userPath}"`);
    }

    const maxBytes = this.maxFileSizeMb * 1024 * 1024;
    if (stat.size > maxBytes) {
      throw new Error(
        `[Filesystem Sandbox] Размер файла (${(stat.size / 1024 / 1024).toFixed(2)} MB) превышает лимит ${this.maxFileSizeMb} MB.`
      );
    }

    if (encoding === 'base64') {
      const buffer = await fs.promises.readFile(safePath);
      return {
        content: buffer.toString('base64'),
        size: stat.size,
        path: safePath,
      };
    }

    const textContent = await fs.promises.readFile(safePath, 'utf-8');
    if (encoding === 'json') {
      try {
        return {
          content: JSON.parse(textContent),
          size: stat.size,
          path: safePath,
        };
      } catch (err: any) {
        throw new Error(`[Filesystem Sandbox] Ошибка парсинга JSON из файла "${userPath}": ${err.message}`);
      }
    }

    return {
      content: textContent,
      size: stat.size,
      path: safePath,
    };
  }

  /**
   * Безопасная запись файла
   */
  public async writeFile(
    userPath: string,
    content: string | Buffer | object,
    options: { mode?: 'overwrite' | 'append'; createParentDirs?: boolean } = {}
  ): Promise<{ writtenBytes: number; path: string }> {
    const safePath = this.resolveSafePath(userPath, true);
    const mode = options.mode || 'overwrite';

    const dir = path.dirname(safePath);
    if (!fs.existsSync(dir)) {
      if (options.createParentDirs !== false) {
        await fs.promises.mkdir(dir, { recursive: true });
      } else {
        throw new Error(`[Filesystem Sandbox] Родительская директория не существует: "${dir}"`);
      }
    }

    let dataToWrite: string | Buffer;
    if (Buffer.isBuffer(content)) {
      dataToWrite = content;
    } else if (typeof content === 'object') {
      dataToWrite = JSON.stringify(content, null, 2);
    } else {
      dataToWrite = String(content);
    }

    const dataLength = Buffer.byteLength(dataToWrite);
    const maxBytes = this.maxFileSizeMb * 1024 * 1024;
    if (dataLength > maxBytes) {
      throw new Error(
        `[Filesystem Sandbox] Объем записываемых данных (${(dataLength / 1024 / 1024).toFixed(2)} MB) превышает лимит ${this.maxFileSizeMb} MB.`
      );
    }

    if (mode === 'append') {
      await fs.promises.appendFile(safePath, dataToWrite);
    } else {
      await fs.promises.writeFile(safePath, dataToWrite);
    }

    return {
      writtenBytes: dataLength,
      path: safePath,
    };
  }

  /**
   * Просмотр содержимого директории
   */
  public async listDirectory(userPath: string = '.'): Promise<FileInfo[]> {
    const safePath = this.resolveSafePath(userPath);
    const stat = await fs.promises.stat(safePath);

    if (!stat.isDirectory()) {
      throw new Error(`[Filesystem Sandbox] Указанный путь не является директорией: "${userPath}"`);
    }

    const entries = await fs.promises.readdir(safePath, { withFileTypes: true });
    const results: FileInfo[] = [];

    for (const entry of entries) {
      const fullChildPath = path.join(safePath, entry.name);
      try {
        const itemStat = await fs.promises.stat(fullChildPath);
        results.push({
          name: entry.name,
          path: fullChildPath,
          size: itemStat.size,
          isDirectory: itemStat.isDirectory(),
          modifiedAt: itemStat.mtime,
          extension: path.extname(entry.name).toLowerCase(),
        });
      } catch {
        // Игнорируем файлы с недоступными правами
      }
    }

    return results;
  }
}
