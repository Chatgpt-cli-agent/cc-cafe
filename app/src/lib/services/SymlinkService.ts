/**
 * Symlink Service (now File Copy Service)
 *
 * Manages file copying for profile activation.
 * Copies mod files from cache to mods directory instead of using symlinks.
 * Uses parallel operations with auto-detected concurrency for optimal performance.
 */

import type { CachedModFile, InstallLayoutMode, SymlinkResult, SymlinkError } from '@/types/profile';
import { sanitizeDisplayFolderName, sanitizeModName } from '@/utils/pathSanitizer';
import { diskPerformanceService } from './DiskPerformanceService';
import {
  ensureLibraryRoots,
  resolveLibraryDestination,
} from './LibraryPathsService';
import {
  concurrentMap,
  getSuccessful,
  getFailed,
} from '@/lib/utils/concurrencyPool';

interface SymlinkPath {
  source: string;
  modName: string;
  creatorName?: string;
  installLayoutMode?: InstallLayoutMode;
  files?: CachedModFile[];
  modId?: number | string;
  localModId?: string;
  fileHash?: string;
}

function getModInstallKey(item: Pick<SymlinkPath, 'modId' | 'localModId'>): number | string {
  if (item.modId !== undefined && item.modId !== null) {
    return item.modId;
  }
  if (item.localModId) {
    return item.localModId;
  }
  throw new Error('Game-mirror install requires modId or localModId');
}

interface ManagedPathEntry {
  path: string;
  type: 'file' | 'dir';
  modId?: number | string;
  fileHash?: string;
}

interface ManagedFilesManifest {
  version: 2;
  entries: ManagedPathEntry[];
}

const MANAGED_FILES_MANIFEST = '.cccafe-managed-files.json';
const ARCHIVE_METADATA_ENTRIES = new Set(['__MACOSX', '.DS_Store']);

export function getSingleArchiveWrapperName(
  entries: Array<{ name: string; isDirectory: boolean }>
): string | null {
  const meaningfulEntries = entries.filter((entry) => !ARCHIVE_METADATA_ENTRIES.has(entry.name));
  if (meaningfulEntries.length !== 1 || !meaningfulEntries[0].isDirectory) {
    return null;
  }
  return meaningfulEntries[0].name;
}

export class SymlinkService {
  /**
   * Activate profile by copying all mod files from cache to mods directory
   * Removes old profile files before copying new ones
   */
  async activateProfile(
    modsPath: string,
    cachePaths: SymlinkPath[]
  ): Promise<SymlinkResult> {
    if (cachePaths.some((item) => item.installLayoutMode === 'game-mirror')) {
      return this.activateGameMirrorLibrary(modsPath, cachePaths);
    }

    const errors: SymlinkError[] = [];
    let created = 0;
    let failed = 0;

    // Step 1: Remove all existing profile mod files first (deactivate current)
    try {
      await this.deactivateProfile(modsPath);
    } catch (error) {
      console.error('Warning: Failed to deactivate profile:', error);
      // Don't fail here - we'll attempt to overwrite
    }

    // Step 2: Copy files from cache for new profile (parallel)
    const poolSize = await diskPerformanceService.getPoolSize();

    const results = await concurrentMap(
      cachePaths,
      async (item) => {
        const { source, modName } = item;
        const targetPath = await this.resolveTargetPath(modsPath, item);
        const copySource = await this.resolveCopySource(source, item);

        await window.electron.ipcRenderer.invoke('fs:copyDir', copySource, targetPath);

        return {
          source,
          modName,
          targetPath,
          managedEntries: await this.getManagedEntriesForItem(targetPath, item),
        };
      },
      poolSize
    );

    // Process results
    const successful = getSuccessful(results);
    const failedResults = getFailed(results);

    created = successful.length;
    failed = failedResults.length;

    if (successful.length > 0) {
      await this.writeManagedFilesManifest(
        modsPath,
        successful.flatMap((result) => result.managedEntries)
      );
    }

    // Build error list from failed operations
    for (const { index, error } of failedResults) {
      const { source, modName } = cachePaths[index];
      const targetPath = await this.resolveTargetPath(modsPath, cachePaths[index]);
      errors.push({
        sourcePath: source,
        targetPath,
        error: String(error),
      });
    }

    return {
      success: failed === 0,
      created,
      failed,
      errors,
    };
  }

  /**
   * Install or update one mod in the game-mirror library without touching other mods.
   */
  async installModToLibrary(
    libraryRoot: string,
    item: SymlinkPath
  ): Promise<{ paths: string[]; result: SymlinkResult }> {
    if (!item.files || item.files.length === 0) {
      throw new Error('Game-mirror install requires extracted files');
    }

    const modKey = getModInstallKey(item);
    await ensureLibraryRoots(libraryRoot);
    await this.removeModFromLibrary(libraryRoot, modKey);

    const errors: SymlinkError[] = [];
    const installedPaths: string[] = [];
    let created = 0;
    let failed = 0;
    const copySource = await this.resolveCopySource(item.source, item);
    const managedEntries: ManagedPathEntry[] = [];

    for (const file of item.files) {
      try {
        const sourceFile = await this.joinRelativePath(copySource, file.relativePath || file.fileName);
        const destination = await resolveLibraryDestination(
          libraryRoot,
          item.creatorName || item.modName,
          item.modName,
          file,
          item.files
        );
        const resolvedDestination = await this.resolveCollisionFreeDestination(
          destination,
          sourceFile,
          item.fileHash
        );
        const resolvedHash =
          item.fileHash ||
          (await window.electron.ipcRenderer.invoke('crypto:hashFile', sourceFile));

        if (
          resolvedDestination === destination &&
          (await window.electron.ipcRenderer.invoke('fs:exists', destination))
        ) {
          installedPaths.push(destination);
          managedEntries.push({
            path: destination,
            type: 'file',
            modId: modKey,
            fileHash: resolvedHash,
          });
          continue;
        }

        await window.electron.ipcRenderer.invoke(
          'fs:mkdir',
          await window.electron.ipcRenderer.invoke('path:dirname', resolvedDestination),
          { recursive: true }
        );
        await window.electron.ipcRenderer.invoke('fs:copyFile', sourceFile, resolvedDestination);
        installedPaths.push(resolvedDestination);
        managedEntries.push({
          path: resolvedDestination,
          type: 'file',
          modId: modKey,
          fileHash: resolvedHash,
        });
        created += 1;
      } catch (error) {
        failed += 1;
        errors.push({
          sourcePath: item.source,
          targetPath: file.fileName,
          error: String(error),
        });
      }
    }

    if (managedEntries.length > 0) {
      await this.appendManagedFilesManifest(libraryRoot, managedEntries);
    }

    return {
      paths: installedPaths,
      result: {
        success: failed === 0,
        created,
        failed,
        errors,
      },
    };
  }

  /**
   * Remove only the files previously installed for one CC Cafe mod.
   */
  async removeModFromLibrary(
    libraryRoot: string,
    modId: number | string
  ): Promise<SymlinkResult> {
    const manifest = await this.readManagedFilesManifest(libraryRoot);
    if (!manifest) {
      return { success: true, created: 0, failed: 0, errors: [] };
    }

    const remaining: ManagedPathEntry[] = [];
    const toRemove = manifest.entries.filter((entry) => entry.modId === modId);
    const errors: SymlinkError[] = [];
    let created = 0;
    let failed = 0;

    for (const entry of [...toRemove].sort((a, b) => b.path.length - a.path.length)) {
      try {
        if (await window.electron.ipcRenderer.invoke('fs:exists', entry.path)) {
          await window.electron.ipcRenderer.invoke('fs:remove', entry.path, {
            recursive: entry.type === 'dir',
          });
          created += 1;
        }
      } catch (error) {
        failed += 1;
        errors.push({
          sourcePath: '',
          targetPath: entry.path,
          error: String(error),
        });
      }
    }

    for (const entry of manifest.entries) {
      if (entry.modId !== modId) {
        remaining.push(entry);
      }
    }

    if (remaining.length === 0) {
      await this.removeManagedFilesManifest(libraryRoot);
    } else {
      await this.writeManagedFilesManifest(libraryRoot, remaining);
    }

    return {
      success: failed === 0,
      created,
      failed,
      errors,
    };
  }

  private async activateGameMirrorLibrary(
    libraryRoot: string,
    cachePaths: SymlinkPath[]
  ): Promise<SymlinkResult> {
    const errors: SymlinkError[] = [];
    let created = 0;
    let failed = 0;

    for (const item of cachePaths) {
      const installResult = await this.installModToLibrary(libraryRoot, item);
      created += installResult.result.created;
      failed += installResult.result.failed;
      errors.push(...installResult.result.errors);
    }

    return {
      success: failed === 0,
      created,
      failed,
      errors,
    };
  }

  /**
   * Deactivate profile by removing all mod files from mods directory
   * Only removes directories that are copied from cache (not user files)
   */
  async deactivateProfile(modsPath: string): Promise<SymlinkResult> {
    const errors: SymlinkError[] = [];
    let created = 0;
    let failed = 0;

    try {
      const managedManifest = await this.readManagedFilesManifest(modsPath);
      if (managedManifest) {
        const entries = [...managedManifest.entries].sort((a, b) => b.path.length - a.path.length);

        for (const entry of entries) {
          try {
            if (await window.electron.ipcRenderer.invoke('fs:exists', entry.path)) {
              await window.electron.ipcRenderer.invoke('fs:remove', entry.path, {
                recursive: entry.type === 'dir',
              });
              created++;
            }
          } catch (error) {
            failed++;
            errors.push({
              sourcePath: '',
              targetPath: entry.path,
              error: String(error),
            });
          }
        }

        await this.removeManagedFilesManifest(modsPath);
        return {
          success: failed === 0,
          created,
          failed,
          errors,
        };
      }

      // List all entries in mods directory
      const entries = await window.electron.ipcRenderer.invoke('fs:readDir', modsPath);

      // Filter to directories only
      const directories = entries.filter((e: any) => e.isDirectory);

      if (directories.length === 0) {
        return { success: true, created: 0, failed: 0, errors: [] };
      }

      // Remove directories in parallel
      const poolSize = await diskPerformanceService.getPoolSize();

      const results = await concurrentMap(
        directories,
        async (entry: any) => {
          const fullPath = await window.electron.ipcRenderer.invoke('path:join', modsPath, entry.name);
          await window.electron.ipcRenderer.invoke('fs:remove', fullPath, { recursive: true });
          return entry.name;
        },
        poolSize
      );

      // Process results
      const successful = getSuccessful(results);
      const failedResults = getFailed(results);

      created = successful.length;
      failed = failedResults.length;

      // Build error list from failed operations
      for (const { index, error } of failedResults) {
        const entry = directories[index];
        errors.push({
          sourcePath: '',
          targetPath: await window.electron.ipcRenderer.invoke('path:join', modsPath, entry.name),
          error: String(error),
        });
      }
    } catch (error: any) {
      failed++;
      errors.push({
        sourcePath: '',
        targetPath: modsPath,
        error: `Failed to read mods directory: ${error.toString()}`,
      });
    }

    return {
      success: failed === 0,
      created,
      failed,
      errors,
    };
  }

  /**
   * Verify that mod files are correctly copied
   */
  async verifySymlinks(
    modsPath: string,
    expectedCount: number
  ): Promise<boolean> {
    try {
      const entries = await window.electron.ipcRenderer.invoke('fs:readDir', modsPath);
      const dirCount = entries.filter((e: any) => e.isDirectory).length;
      return dirCount === expectedCount;
    } catch (error) {
      console.error('Failed to verify mod files:', error);
      return false;
    }
  }

  /**
   * Get list of current mod directories in mods directory
   */
  async listSymlinks(modsPath: string): Promise<string[]> {
    try {
      const entries = await window.electron.ipcRenderer.invoke('fs:readDir', modsPath);
      const modDirs = await Promise.all(
        entries
          .filter((e: any) => e.isDirectory)
          .map((e: any) => window.electron.ipcRenderer.invoke('path:join', modsPath, e.name))
      );

      return modDirs;
    } catch (error) {
      console.error('Failed to list mod directories:', error);
      return [];
    }
  }

  private async resolveTargetPath(modsPath: string, item: SymlinkPath): Promise<string> {
    switch (item.installLayoutMode || 'game-mirror') {
      case 'game-mirror':
        return modsPath;
      case 'mods-folder':
        return modsPath;
      case 'creator-folder': {
        const folderName = sanitizeModName(item.creatorName || item.modName);
        return await window.electron.ipcRenderer.invoke('path:join', modsPath, folderName);
      }
      case 'creator-cc-folder': {
        const creatorFolder = sanitizeDisplayFolderName(item.creatorName || '', 'Unknown Creator');
        const itemFolder = sanitizeDisplayFolderName(item.modName, 'Unnamed Item');
        return await window.electron.ipcRenderer.invoke(
          'path:join',
          modsPath,
          creatorFolder,
          itemFolder
        );
      }
      case 'cc-folder':
      default: {
        const folderName = sanitizeModName(item.modName);
        return await window.electron.ipcRenderer.invoke('path:join', modsPath, folderName);
      }
    }
  }

  private async resolveCopySource(source: string, item: SymlinkPath): Promise<string> {
    const layoutMode = item.installLayoutMode || 'creator-cc-folder';
    if (layoutMode !== 'creator-cc-folder' && layoutMode !== 'cc-folder') {
      return source;
    }

    const entries = await window.electron.ipcRenderer.invoke('fs:readDir', source);
    const wrapperName = getSingleArchiveWrapperName(entries);
    if (!wrapperName) {
      return source;
    }

    return await window.electron.ipcRenderer.invoke('path:join', source, wrapperName);
  }

  private async getManagedEntriesForItem(
    targetPath: string,
    item: SymlinkPath
  ): Promise<ManagedPathEntry[]> {
    const layoutMode = item.installLayoutMode || 'creator-cc-folder';
    if (layoutMode === 'cc-folder' || layoutMode === 'creator-cc-folder') {
      return [{ path: targetPath, type: 'dir' }];
    }

    if (!item.files || item.files.length === 0) {
      return [];
    }

    return await Promise.all(
      item.files.map(async (file) => ({
        path: await this.joinRelativePath(targetPath, file.relativePath || file.fileName),
        type: 'file' as const,
      }))
    );
  }

  private async joinRelativePath(basePath: string, relativePath: string): Promise<string> {
    const parts = relativePath.split(/[\\/]+/).filter(Boolean);
    return await window.electron.ipcRenderer.invoke('path:join', basePath, ...parts);
  }

  private async resolveCollisionFreeDestination(
    destination: string,
    sourceFile: string,
    fileHash?: string
  ): Promise<string> {
    if (!(await window.electron.ipcRenderer.invoke('fs:exists', destination))) {
      return destination;
    }

    const sourceHash =
      fileHash || (await window.electron.ipcRenderer.invoke('crypto:hashFile', sourceFile));
    const destinationHash = await window.electron.ipcRenderer.invoke('crypto:hashFile', destination);
    if (sourceHash === destinationHash) {
      return destination;
    }

    const dir = await window.electron.ipcRenderer.invoke('path:dirname', destination);
    const base = await window.electron.ipcRenderer.invoke('path:basename', destination);
    const dot = base.lastIndexOf('.');
    const stem = dot >= 0 ? base.slice(0, dot) : base;
    const ext = dot >= 0 ? base.slice(dot) : '';
    const suffix = `__sha256-${sourceHash.slice(0, 12)}`;
    return await window.electron.ipcRenderer.invoke('path:join', dir, `${stem}${suffix}${ext}`);
  }

  private async getManagedFilesManifestPath(rootPath: string): Promise<string> {
    return await window.electron.ipcRenderer.invoke('path:join', rootPath, MANAGED_FILES_MANIFEST);
  }

  private normalizeManifest(parsed: Partial<ManagedFilesManifest> | null): ManagedFilesManifest | null {
    if (!parsed || !Array.isArray(parsed.entries)) {
      return null;
    }
    return {
      version: 2,
      entries: parsed.entries,
    };
  }

  private async readManagedFilesManifest(rootPath: string): Promise<ManagedFilesManifest | null> {
    const manifestPath = await this.getManagedFilesManifestPath(rootPath);
    if (!(await window.electron.ipcRenderer.invoke('fs:exists', manifestPath))) {
      return null;
    }

    try {
      const content = await window.electron.ipcRenderer.invoke('fs:readTextFile', manifestPath);
      return this.normalizeManifest(JSON.parse(content) as Partial<ManagedFilesManifest>);
    } catch (error) {
      console.warn('Failed to read CC Cafe managed files manifest:', error);
      return null;
    }
  }

  private async writeManagedFilesManifest(
    rootPath: string,
    entries: ManagedPathEntry[]
  ): Promise<void> {
    const manifestPath = await this.getManagedFilesManifestPath(rootPath);
    const uniqueEntries = Array.from(
      new Map(entries.map((entry) => [entry.path, entry])).values()
    );

    await window.electron.ipcRenderer.invoke(
      'fs:writeFile',
      manifestPath,
      JSON.stringify({ version: 2, entries: uniqueEntries }, null, 2)
    );
  }

  private async appendManagedFilesManifest(
    rootPath: string,
    entries: ManagedPathEntry[]
  ): Promise<void> {
    const existing = await this.readManagedFilesManifest(rootPath);
    const merged = [...(existing?.entries || []), ...entries];
    await this.writeManagedFilesManifest(rootPath, merged);
  }

  private async removeManagedFilesManifest(rootPath: string): Promise<void> {
    const manifestPath = await this.getManagedFilesManifestPath(rootPath);
    if (await window.electron.ipcRenderer.invoke('fs:exists', manifestPath)) {
      await window.electron.ipcRenderer.invoke('fs:remove', manifestPath);
    }
  }

  /**
   * Check if we can copy files (should always work)
   */
  async canCreateSymlinks(): Promise<boolean> {
    return true;
  }

  /**
   * Get permission help message (not needed for file copy)
   */
  getSymlinkPermissionFix(): {
    windows: string;
    unix: string;
  } {
    return {
      windows: 'Ensure you have write permissions to the Mods directory',
      unix: 'Ensure you have write permissions to the Mods directory',
    };
  }
}

// Export singleton instance
export const symlinkService = new SymlinkService();
