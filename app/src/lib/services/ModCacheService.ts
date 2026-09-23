/**
 * Mod Cache Service
 *
 * Manages centralized mod cache with hash-based deduplication.
 * Stores downloaded mods in AppData and tracks usage across profiles.
 */

import {
  CachedMod,
  CachedModFile,
  ModCacheIndex,
} from '@/types/profile';
import { diskPerformanceService } from './DiskPerformanceService';
import { concurrentMap } from '@/lib/utils/concurrencyPool';
import { resolveAppDataPath } from './AppPaths';

/**
 * Sims 4 save files live loose in the game's Saves folder root as
 * `Slot_XXXXXXXX.save`, alongside rotating backups
 * `Slot_XXXXXXXX.save.ver0`–`Slot_XXXXXXXX.save.ver4`.
 */
const SAVE_BACKUP_PATTERN = /\.save\.ver\d+$/i;

export function isSaveFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  if (SAVE_BACKUP_PATTERN.test(lower)) {
    return true;
  }
  return lower.endsWith('.save');
}

export class ModCacheService {
  private cacheDir: string | null = null;
  private indexFile: string | null = null;
  private readonly CACHE_VERSION = '1.0.0';
  private initialized = false;

  /**
   * Initialize cache directory and index
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.cacheDir = await resolveAppDataPath('ModsCache');
    this.indexFile = await window.electron.ipcRenderer.invoke('path:join', this.cacheDir!, 'cache.index.json');

    if (!(await window.electron.ipcRenderer.invoke('fs:exists', this.cacheDir))) {
      await window.electron.ipcRenderer.invoke('fs:mkdir', this.cacheDir, { recursive: true });
    }

    // Initialize index if not exists
    if (!(await window.electron.ipcRenderer.invoke('fs:exists', this.indexFile))) {
      const defaultIndex: ModCacheIndex = {
        version: this.CACHE_VERSION,
        entries: {},
        lastCleanup: new Date().toISOString(),
      };
      await this.saveIndex(defaultIndex);
    }

    this.initialized = true;
  }

  /**
   * Add mod to cache (called after download)
   * Returns cached mod info and checks for duplicates
   */
  async addToCache(
    modId: number | string,
    fileName: string,
    sourcePath: string,
    profileId: string
  ): Promise<CachedMod> {
    await this.ensureInitialized();

    // Calculate file hash
    const fileHash = await this.calculateFileHash(sourcePath);

    // Check if already cached
    const index = await this.getIndex();
    let cachedMod: CachedMod | undefined = index.entries[fileHash];

    // Older Linux builds could record a failed ZIP extraction as a cache hit
    // with no files. Invalidate those entries so retrying performs a real
    // download/extraction instead of recreating an empty creator folder.
    if (cachedMod && cachedMod.files.length === 0) {
      await this.deleteCacheEntry(fileHash);
      delete index.entries[fileHash];
      await this.saveIndex(index);
      cachedMod = undefined;
    }

    if (cachedMod) {
      // File already cached - add profile to usage tracking
      if (!cachedMod.usedByProfiles.includes(profileId)) {
        cachedMod.usedByProfiles.push(profileId);
        index.entries[fileHash] = cachedMod;
        await this.saveIndex(index);
      }
      return cachedMod;
    }

    // Create new cache entry
    const cacheEntryDir = await window.electron.ipcRenderer.invoke('path:join', this.cacheDir!, fileHash);
    const cacheFilesDir = await window.electron.ipcRenderer.invoke('path:join', cacheEntryDir, 'files');
    await window.electron.ipcRenderer.invoke('fs:mkdir', cacheFilesDir, { recursive: true });

    // Extract mod to cache directory. Keep cache creation transactional so a
    // failed extractor cannot leave an empty entry that later looks installed.
    let extractedFiles: CachedModFile[];
    try {
      extractedFiles = await this.extractModToCache(sourcePath, cacheFilesDir);
    } catch (error) {
      await window.electron.ipcRenderer.invoke('fs:remove', cacheEntryDir, {
        recursive: true,
      });
      throw error;
    }

    // Get file size
    const fileSize = await this.getFileSize(sourcePath);

    // Create cached mod entry
    cachedMod = {
      fileHash,
      modId,
      fileName,
      fileSize,
      downloadedAt: new Date().toISOString(),
      usedByProfiles: [profileId],
      files: extractedFiles,
    };

    // Save metadata
    const metadataPath = await window.electron.ipcRenderer.invoke('path:join', cacheEntryDir, 'metadata.json');
    await window.electron.ipcRenderer.invoke(
      'fs:writeFile',
      metadataPath,
      JSON.stringify(cachedMod, null, 2)
    );

    // Update index
    index.entries[fileHash] = cachedMod;
    await this.saveIndex(index);

    return cachedMod;
  }

  /**
   * Get cached mod by hash
   */
  async getCachedMod(fileHash: string): Promise<CachedMod | null> {
    await this.ensureInitialized();

    const index = await this.getIndex();
    return index.entries[fileHash] || null;
  }

  /**
   * Get cache directory path for a specific hash
   */
  async getCachePath(fileHash: string): Promise<string> {
    await this.ensureInitialized();
    return await window.electron.ipcRenderer.invoke('path:join', this.cacheDir!, fileHash, 'files');
  }

  /** Release one profile's reference and delete the cache entry when unused. */
  async releaseCachedMod(fileHash: string, profileId: string): Promise<void> {
    await this.ensureInitialized();
    const index = await this.getIndex();
    const entry = index.entries[fileHash];
    if (!entry) {
      return;
    }

    entry.usedByProfiles = entry.usedByProfiles.filter((id) => id !== profileId);
    if (entry.usedByProfiles.length === 0) {
      await this.deleteCacheEntry(fileHash);
      delete index.entries[fileHash];
    } else {
      index.entries[fileHash] = entry;
    }
    await this.saveIndex(index);
  }

  /**
   * Remove profile from cache usage tracking
   */
  async removeProfileFromCache(profileId: string): Promise<void> {
    await this.ensureInitialized();

    const index = await this.getIndex();
    let modified = false;

    const hashesToDelete: string[] = [];

    for (const [hash, entry] of Object.entries(index.entries)) {
      const profileIndex = entry.usedByProfiles.indexOf(profileId);
      if (profileIndex >= 0) {
        entry.usedByProfiles.splice(profileIndex, 1);
        modified = true;

        // Mark for deletion if no longer used
        if (entry.usedByProfiles.length === 0) {
          hashesToDelete.push(hash);
        }
      }
    }

    // Delete orphaned cache entries in parallel
    if (hashesToDelete.length > 0) {
      const poolSize = await diskPerformanceService.getPoolSize();
      await concurrentMap(
        hashesToDelete,
        async (hash) => {
          await this.deleteCacheEntry(hash);
        },
        poolSize
      );

      for (const hash of hashesToDelete) {
        delete index.entries[hash];
      }
    }

    if (modified) {
      await this.saveIndex(index);
    }
  }

  /**
   * Cleanup orphaned cache entries (mods not used by any profile)
   */
  async cleanupOrphans(): Promise<{ deleted: number; freedBytes: number }> {
    await this.ensureInitialized();

    const index = await this.getIndex();
    let deleted = 0;
    let freedBytes = 0;

    const hashesToDelete: string[] = [];

    for (const [hash, entry] of Object.entries(index.entries)) {
      if (entry.usedByProfiles.length === 0) {
        freedBytes += entry.fileSize;
        hashesToDelete.push(hash);
        deleted++;
      }
    }

    // Delete orphaned entries in parallel
    if (hashesToDelete.length > 0) {
      const poolSize = await diskPerformanceService.getPoolSize();
      await concurrentMap(
        hashesToDelete,
        async (hash) => {
          await this.deleteCacheEntry(hash);
        },
        poolSize
      );

      for (const hash of hashesToDelete) {
        delete index.entries[hash];
      }
    }

    if (deleted > 0) {
      index.lastCleanup = new Date().toISOString();
      await this.saveIndex(index);
    }

    return { deleted, freedBytes };
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalSize: number;
    totalMods: number;
    totalProfiles: Set<string>;
  }> {
    await this.ensureInitialized();

    const index = await this.getIndex();
    let totalSize = 0;
    const totalProfiles = new Set<string>();

    for (const entry of Object.values(index.entries)) {
      totalSize += entry.fileSize;
      entry.usedByProfiles.forEach((id) => totalProfiles.add(id));
    }

    return {
      totalSize,
      totalMods: Object.keys(index.entries).length,
      totalProfiles,
    };
  }

  // Helper methods

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async getIndex(): Promise<ModCacheIndex> {
    try {
      const content = await window.electron.ipcRenderer.invoke('fs:readTextFile', this.indexFile!);
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to read cache index:', error);
      // Return empty index if corrupted
      return {
        version: this.CACHE_VERSION,
        entries: {},
        lastCleanup: new Date().toISOString(),
      };
    }
  }

  private async saveIndex(index: ModCacheIndex): Promise<void> {
    await window.electron.ipcRenderer.invoke(
      'fs:writeFile',
      this.indexFile!,
      JSON.stringify(index, null, 2)
    );
  }

  private async calculateFileHash(filePath: string): Promise<string> {
    // Use Electron IPC to calculate SHA-256 hash
    const hash = await window.electron.ipcRenderer.invoke('crypto:hashFile', filePath);
    return hash;
  }

  private async getFileSize(filePath: string): Promise<number> {
    // Use Electron IPC to get file size
    const stats = await window.electron.ipcRenderer.invoke('fs:stat', filePath);
    return stats.size;
  }

  private async extractModToCache(
    sourcePath: string,
    destDir: string
  ): Promise<CachedModFile[]> {
    // Extract ZIP to cache directory
    try {
      const extraction = await window.electron.ipcRenderer.invoke('extract-zip', {
        zipPath: sourcePath,
        destDir,
      });
      if (extraction?.success === false) {
        throw new Error(extraction.error || 'ZIP extraction failed');
      }
    } catch (error) {
      console.error('Failed to extract zip:', error);
      throw new Error(`Failed to extract mod: ${error}`);
    }

    // Find all Sims content files
    const simsFiles = await this.findSimsFiles(destDir);
    if (simsFiles.length === 0) {
      throw new Error('Archive contains no supported Sims 4 content files');
    }

    return simsFiles.map((filePath) => {
      // Calculate relative path from destDir
      const relativePath = filePath
        .substring(destDir.length)
        .replace(/^[\\\/]/, '');
      const fileName = filePath.split(/[\\\/]/).pop() || '';

      return {
        relativePath,
        fileName,
        fileSize: 0, // Size will be calculated if needed
      };
    });
  }

  private async findSimsFiles(dir: string): Promise<string[]> {
    const results: string[] = [];
    const simsExtensions = [
      '.package',
      '.ts4script',
      '.blueprint',
      '.bpi',
      '.hhi',
      '.householdbinary',
      '.rmi',
      '.room',
      '.sgi',
      '.trayitem',
      '.cfg',
      '.ini',
    ];

    try {
      const entries = await window.electron.ipcRenderer.invoke('fs:readDir', dir);

      for (const entry of entries) {
        const fullPath = await window.electron.ipcRenderer.invoke('path:join', dir, entry.name);
        const lowerName = entry.name.toLowerCase();

        if (entry.isDirectory) {
          const subResults = await this.findSimsFiles(fullPath);
          results.push(...subResults);
        } else if (
          simsExtensions.some((extension) => lowerName.endsWith(extension)) ||
          isSaveFileName(entry.name)
        ) {
          results.push(fullPath);
        }
      }
    } catch (error) {
      console.error('Error reading directory:', error);
    }

    return results;
  }

  private async findPackageFiles(dir: string): Promise<string[]> {
    const files = await this.findSimsFiles(dir);
    return files.filter((filePath) => filePath.toLowerCase().endsWith('.package'));
  }

  private async deleteCacheEntry(fileHash: string): Promise<void> {
    const cacheEntryDir = await window.electron.ipcRenderer.invoke('path:join', this.cacheDir!, fileHash);
    if (await window.electron.ipcRenderer.invoke('fs:exists', cacheEntryDir)) {
      try {
        await window.electron.ipcRenderer.invoke('fs:remove', cacheEntryDir, { recursive: true });
      } catch (error) {
        console.error(`Failed to delete cache entry ${fileHash}:`, error);
      }
    }
  }
}

// Export singleton instance
export const modCacheService = new ModCacheService();
