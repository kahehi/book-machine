export interface StorageProvider {
  write(filePath: string, data: unknown): Promise<void>;
  read<T>(filePath: string): Promise<T>;
  readJson<T>(filePath: string): Promise<T | null>;
  readText(filePath: string): Promise<string | null>;
  exists(filePath: string): Promise<boolean>;
  ensureDir(dirPath: string): Promise<void>;
}
