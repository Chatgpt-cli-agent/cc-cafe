'use client';

import { concurrentMap, getFailed, getSuccessful } from '@/lib/utils/concurrencyPool';
import { resolveAppDataPath } from './AppPaths';

const DEFAULT_CONCURRENCY = 4;
const IGNORED_FILENAMES = new Set(['.ds_store', 'thumbs.db']);
const PREVIEW_FOLDER = 'cc-detect';

export interface CcPackageItem {
  path: string;
  name: string;
  resourceCount: number;
  thumbnailCount: number;
  hasThumbnails: boolean;
}

export interface CcDetectScanResult {
  items: CcPackageItem[];
  fileCount: number;
  filesWithThumbnails: number;
  thumbnailCount: number;
  failedCount: number;
}

export interface CcThumbnailPreviewResult {
  outputDir: string;
  files: string[];
}

interface DirectoryEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

interface ScannedPackage {
  path: string;
  name: string;
  resourceCount: number;
  thumbnailCount: number;
  hasThumbnails: boolean;
}

class CcDetectService {
  async scanPackages(rootPath: string): Promise<CcDetectScanResult> {
    const packageFiles = await this.walkPackageFiles(rootPath);

    const settled = await concurrentMap(
      packageFiles,
      async (filePath) => {
        const result = await window.electron.ipcRenderer.invoke('scan-package', { filePath });
        if (!result || result.success === false) {
          throw new Error(result?.error || `Failed to scan ${filePath}`);
        }

        return {
          path: filePath,
          name: result.name || this.getBaseName(filePath),
          resourceCount: Number(result.resourceCount || 0),
          thumbnailCount: Number(result.thumbnailCount || 0),
          hasThumbnails: Boolean(result.hasThumbnails),
        } satisfies ScannedPackage;
      },
      DEFAULT_CONCURRENCY
    );

    const items = getSuccessful(settled).sort(
      (a, b) =>
        Number(b.hasThumbnails) - Number(a.hasThumbnails) ||
        b.thumbnailCount - a.thumbnailCount ||
        b.resourceCount - a.resourceCount ||
        a.name.localeCompare(b.name)
    );

    const failedCount = getFailed(settled).length;
    const filesWithThumbnails = items.filter((item) => item.hasThumbnails).length;
    const thumbnailCount = items.reduce((total, item) => total + item.thumbnailCount, 0);

    return {
      items,
      fileCount: packageFiles.length,
      filesWithThumbnails,
      thumbnailCount,
      failedCount,
    };
  }

  async extractThumbnails(filePath: string): Promise<CcThumbnailPreviewResult> {
    const rootDir = await this.getPreviewRootDir();
    const previewDir = await this.joinPath(rootDir, this.sanitizeSegment(this.getStem(filePath)));

    await this.ensureDirectory(previewDir);

    const result = await window.electron.ipcRenderer.invoke('extract-thumbnails', {
      filePath,
      outputDir: previewDir,
    });

    if (!result || result.success === false) {
      throw new Error(result?.error || `Failed to extract thumbnails from ${filePath}`);
    }

    const files = Array.isArray(result)
      ? result
      : Array.isArray(result.files)
        ? result.files
        : [];

    return {
      outputDir: previewDir,
      files: files.filter((item: string) => this.isPreviewImage(item)).sort((a: string, b: string) => a.localeCompare(b)),
    };
  }

  async openPath(pathToOpen: string): Promise<void> {
    await window.electron.ipcRenderer.invoke('shell:openPath', pathToOpen);
  }

  private async walkPackageFiles(rootPath: string): Promise<string[]> {
    const results: string[] = [];

    const walk = async (currentPath: string): Promise<void> => {
      let entries: DirectoryEntry[];
      try {
        entries = await window.electron.ipcRenderer.invoke('fs:readDir', currentPath);
      } catch {
        return;
      }

      for (const entry of entries) {
        if (IGNORED_FILENAMES.has(entry.name.toLowerCase())) {
          continue;
        }

        const fullPath = await this.joinPath(currentPath, entry.name);
        if (entry.isDirectory) {
          await walk(fullPath);
        } else if (entry.isFile && entry.name.toLowerCase().endsWith('.package')) {
          results.push(fullPath);
        }
      }
    };

    await walk(rootPath);
    return results;
  }

  private async getPreviewRootDir(): Promise<string> {
    const root = await resolveAppDataPath(PREVIEW_FOLDER);
    await this.ensureDirectory(root);
    return root;
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    await window.electron.ipcRenderer.invoke('fs:mkdir', dirPath, { recursive: true });
  }

  private async joinPath(...parts: string[]): Promise<string> {
    return window.electron.ipcRenderer.invoke('path:join', ...parts);
  }

  private getBaseName(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    return normalized.split('/').pop() || filePath;
  }

  private getStem(filePath: string): string {
    const baseName = this.getBaseName(filePath);
    return baseName.replace(/\.[^.]+$/, '');
  }

  private sanitizeSegment(value: string): string {
    return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim().replace(/\s+/g, '_').slice(0, 120) || 'package';
  }

  private isPreviewImage(filePath: string): boolean {
    return /\.(png|jpe?g|webp|gif)$/i.test(filePath);
  }
}

export const ccDetectService = new CcDetectService();
