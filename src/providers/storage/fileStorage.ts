import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import type { StorageProvider } from './storage.js';

export class FileStorage implements StorageProvider {
  constructor(private readonly baseDir: string) {}

  async write(filePath: string, data: unknown): Promise<void> {
    const fullPath = join(this.baseDir, filePath);
    await fs.mkdir(dirname(fullPath), { recursive: true });
    const content =
      typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  async read<T>(filePath: string): Promise<T> {
    const fullPath = join(this.baseDir, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    try {
      return JSON.parse(content) as T;
    } catch {
      return content as unknown as T;
    }
  }

  async readJson<T>(filePath: string): Promise<T | null> {
    try {
      const fullPath = join(this.baseDir, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  async readText(filePath: string): Promise<string | null> {
    try {
      const fullPath = join(this.baseDir, filePath);
      return await fs.readFile(fullPath, 'utf-8');
    } catch {
      return null;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    const fullPath = join(this.baseDir, filePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async ensureDir(dirPath: string): Promise<void> {
    const fullPath = join(this.baseDir, dirPath);
    await fs.mkdir(fullPath, { recursive: true });
  }
}
