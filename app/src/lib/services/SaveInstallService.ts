/**
 * Save Install Service
 *
 * Installs cached save-file packages (CurseForge "Save Files" downloads such
 * as "Ultimate Saves") into The Sims 4's `saves` folder.
 *
 * The game only recognizes `Slot_XXXXXXXX.save` files (and their `.verN`
 * backups) when they sit LOOSE in the root of the `saves` folder — saves in
 * subfolders are invisible to it. Extracted files are therefore flattened to
 * their basename. An existing file at a target slot is renamed aside first and
 * never destroyed.
 */

import type { CachedModFile } from '@/types/profile';
import { isSaveFileName } from './ModCacheService';

export interface SaveInstallResult {
  installed: string[];
  backups: string[];
}

export class SaveInstallService {
  /**
   * Resolve the game's saves folder (creating it when missing). Prefers the
   * standard `Documents/Electronic Arts/The Sims 4/saves` location and falls
   * back to `Documents/The Sims 4/saves` for non-EA-launcher layouts.
   */
  async resolveSavesDir(): Promise<string> {
    const documentsDir = await window.electron.ipcRenderer.invoke('path:documentDir');
    if (!documentsDir) {
      throw new Error('Could not locate your Documents folder');
    }

    const defaultDir = await window.electron.ipcRenderer.invoke(
      'path:join',
      documentsDir,
      'Electronic Arts',
      'The Sims 4',
      'saves'
    );
    const altDir = await window.electron.ipcRenderer.invoke(
      'path:join',
      documentsDir,
      'The Sims 4',
      'saves'
    );

    const altExists = await window.electron.ipcRenderer.invoke('fs:exists', altDir);
    const defaultExists = await window.electron.ipcRenderer.invoke('fs:exists', defaultDir);
    const savesDir = altExists && !defaultExists ? altDir : defaultDir;

    await window.electron.ipcRenderer.invoke('fs:mkdir', savesDir, { recursive: true });
    return savesDir;
  }

  /**
   * Copy save files from an extracted cache entry into the game's Saves folder
   * root. Returns the installed file names and any prior files that were backed
   * up before being replaced.
   */
  async installSavesFromCache(
    cachePath: string,
    files: CachedModFile[]
  ): Promise<SaveInstallResult> {
    const savesDir = await this.resolveSavesDir();
    const installed: string[] = [];
    const backups: string[] = [];

    for (const file of files) {
      if (!isSaveFileName(file.fileName) || this.isUnsafeRelativePath(file.relativePath)) {
        continue;
      }

      const source = await window.electron.ipcRenderer.invoke('path:join', cachePath, file.relativePath);
      if (!(await window.electron.ipcRenderer.invoke('fs:exists', source))) {
        continue;
      }

      const target = await window.electron.ipcRenderer.invoke('path:join', savesDir, file.fileName);

      if (await window.electron.ipcRenderer.invoke('fs:exists', target)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backup = await window.electron.ipcRenderer.invoke(
          'path:join',
          savesDir,
          `${file.fileName}.cc-cafe-backup-${timestamp}`
        );
        await window.electron.ipcRenderer.invoke('fs:rename', target, backup);
        backups.push(backup);
      }

      await window.electron.ipcRenderer.invoke('fs:copyFile', source, target);
      installed.push(file.fileName);
    }

    return { installed, backups };
  }

  /** Reject paths that could escape the cache directory via traversal. */
  private isUnsafeRelativePath(relativePath: string): boolean {
    const normalized = relativePath.replace(/\\/g, '/');
    return normalized.split('/').includes('..');
  }
}

// Export singleton instance
export const saveInstallService = new SaveInstallService();