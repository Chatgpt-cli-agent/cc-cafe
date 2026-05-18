'use client';

import { concurrentMap, getSuccessful } from '@/lib/utils/concurrencyPool';
import { getCompatStorageItem } from '@/lib/utils/storageCompat';

const SETTINGS_PASSWORD = 'cccafe-settings';
const MODS_PATH_KEY = 'cccafe_mods_path';
const DEFAULT_CONCURRENCY = 6;
const IGNORED_FILENAMES = new Set(['.ds_store', 'thumbs.db']);
const D1_PREFIX = /^\[D\d+\]\s*/i;

export interface FilesystemToolFile {
  path: string;
  name: string;
}

export interface FilesystemDuplicateGroup {
  key: string;
  items: FilesystemToolFile[];
}

export interface EmptyFolderEntry {
  path: string;
}

export interface D1RenameError {
  sourcePath: string;
  targetPath: string;
  error: string;
}

export interface D1RenameResult {
  renamed: number;
  skipped: number;
  errors: D1RenameError[];
}

interface DirectoryScanResult {
  files: FilesystemToolFile[];
  emptyFolders: string[];
}

class FilesystemToolsService {
  private modsPathCache: string | null | undefined;

  async getModsPath(): Promise<string | null> {
    if (this.modsPathCache !== undefined) {
      return this.modsPathCache;
    }

    const encryptedModsPath = this.getLocalSetting(MODS_PATH_KEY);
    if (!encryptedModsPath) {
      this.modsPathCache = null;
      return null;
    }

    this.modsPathCache = await this.decryptData(encryptedModsPath);
    return this.modsPathCache;
  }

  clearCache(): void {
    this.modsPathCache = undefined;
  }

  async scanExactDuplicates(rootPath: string): Promise<FilesystemDuplicateGroup[]> {
    const { files } = await this.collectDirectoryTree(rootPath);
    const hashResults = await this.hashFiles(files);

    const grouped = new Map<string, FilesystemToolFile[]>();
    hashResults.forEach(({ hash, file }) => {
      const group = grouped.get(hash) ?? [];
      group.push(file);
      grouped.set(hash, group);
    });

    return Array.from(grouped.entries())
      .filter(([, items]) => items.length > 1)
      .map(([key, items]) => ({ key, items }))
      .sort((a, b) => b.items.length - a.items.length || a.key.localeCompare(b.key));
  }

  async scanDuplicateFilenames(rootPath: string): Promise<FilesystemDuplicateGroup[]> {
    const { files } = await this.collectDirectoryTree(rootPath);
    const grouped = new Map<string, FilesystemToolFile[]>();

    for (const file of files) {
      const key = file.name.trim().toLowerCase();
      const group = grouped.get(key) ?? [];
      group.push(file);
      grouped.set(key, group);
    }

    return Array.from(grouped.entries())
      .filter(([, items]) => items.length > 1)
      .map(([key, items]) => ({ key, items }))
      .sort((a, b) => b.items.length - a.items.length || a.key.localeCompare(b.key));
  }

  async scanEmptyFolders(rootPath: string): Promise<EmptyFolderEntry[]> {
    const { emptyFolders } = await this.collectDirectoryTree(rootPath);
    return emptyFolders
      .map((path) => ({ path }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  async scanD1Candidates(rootPath: string): Promise<FilesystemToolFile[]> {
    const { files } = await this.collectDirectoryTree(rootPath);
    return files
      .filter((file) => D1_PREFIX.test(file.name))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  async revertD1FileNames(rootPath: string): Promise<D1RenameResult> {
    const candidates = await this.scanD1Candidates(rootPath);
    const plannedTargets = new Set<string>();
    const errors: D1RenameError[] = [];
    let renamed = 0;
    let skipped = 0;

    for (const file of candidates) {
      const newName = file.name.replace(D1_PREFIX, '');
      if (!newName || newName === file.name) {
        skipped++;
        continue;
      }

      const directory = this.getDirectoryName(file.path);
      if (!directory) {
        skipped++;
        continue;
      }

      const targetPath = await this.joinPath(directory, newName);
      const targetKey = targetPath.toLowerCase();

      if (plannedTargets.has(targetKey)) {
        skipped++;
        continue;
      }

      plannedTargets.add(targetKey);

      const targetExists = await this.exists(targetPath);
      if (targetExists) {
        skipped++;
        continue;
      }

      try {
        await window.electron.ipcRenderer.invoke('fs:rename', file.path, targetPath);
        renamed++;
      } catch (error: any) {
        errors.push({
          sourcePath: file.path,
          targetPath,
          error: error?.message || 'Failed to rename file',
        });
      }
    }

    return { renamed, skipped, errors };
  }

  private async collectDirectoryTree(rootPath: string): Promise<DirectoryScanResult> {
    const files: FilesystemToolFile[] = [];
    const emptyFolders: string[] = [];

    const walk = async (currentPath: string): Promise<void> => {
      let entries: Array<{ name: string; isDirectory: boolean; isFile: boolean }>;
      try {
        entries = await window.electron.ipcRenderer.invoke('fs:readDir', currentPath);
      } catch {
        return;
      }

      const visibleEntries = entries.filter((entry) => !IGNORED_FILENAMES.has(entry.name.toLowerCase()));

      if (visibleEntries.length === 0) {
        emptyFolders.push(currentPath);
        return;
      }

      for (const entry of visibleEntries) {
        const fullPath = await this.joinPath(currentPath, entry.name);
        if (entry.isDirectory) {
          await walk(fullPath);
        } else if (entry.isFile) {
          files.push({ path: fullPath, name: entry.name });
        }
      }
    };

    await walk(rootPath);
    return { files, emptyFolders };
  }

  private async hashFiles(files: FilesystemToolFile[]): Promise<{ file: FilesystemToolFile; hash: string }[]> {
    const settled = await concurrentMap(
      files,
      async (file) => {
        const hash = await window.electron.ipcRenderer.invoke('crypto:hashFile', file.path);
        return { file, hash };
      },
      DEFAULT_CONCURRENCY
    );

    return getSuccessful(settled);
  }

  private getLocalSetting(key: string): string | null {
    if (typeof window === 'undefined') {
      return null;
    }
    return getCompatStorageItem(key);
  }

  private async decryptData(encryptedData: string): Promise<string | null> {
    try {
      const encoder = new TextEncoder();
      const passwordEncoded = encoder.encode(SETTINGS_PASSWORD);

      const hashBuffer = await crypto.subtle.digest('SHA-256', passwordEncoded);
      const key = await crypto.subtle.importKey('raw', hashBuffer, 'AES-GCM', false, ['decrypt']);

      const binaryString = atob(encryptedData);
      const combined = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        combined[i] = binaryString.charCodeAt(i);
      }

      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('[FilesystemToolsService] Failed to decrypt setting:', error);
      return null;
    }
  }

  private async joinPath(...parts: string[]): Promise<string> {
    return window.electron.ipcRenderer.invoke('path:join', ...parts);
  }

  private async exists(filePath: string): Promise<boolean> {
    return window.electron.ipcRenderer.invoke('fs:exists', filePath);
  }

  private getDirectoryName(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    const index = normalized.lastIndexOf('/');
    return index >= 0 ? normalized.slice(0, index) : '';
  }
}

export const filesystemToolsService = new FilesystemToolsService();
