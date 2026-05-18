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
    let cachedMod = index.entries[fileHash];

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

    // Extract mod to cache directory
    const extractedFiles = await this.extractModToCache(
      sourcePath,
      cacheFilesDir
    );

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
      await window.electron.ipcRenderer.invoke('extract-zip', {
        zipPath: sourcePath,
        destDir,
      });
    } catch (error) {
      console.error('Failed to extract zip:', error);
      throw new Error(`Failed to extract mod: ${error}`);
    }

    // Find all .package files
    const packageFiles = await this.findPackageFiles(destDir);

    return packageFiles.map((filePath) => {
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

  private async findPackageFiles(dir: string): Promise<string[]> {
    const results: string[] = [];

    try {
      const entries = await window.electron.ipcRenderer.invoke('fs:readDir', dir);

      for (const entry of entries) {
        const fullPath = await window.electron.ipcRenderer.invoke('path:join', dir, entry.name);

        if (entry.isDirectory) {
          const subResults = await this.findPackageFiles(fullPath);
          results.push(...subResults);
        } else if (entry.name.endsWith('.package')) {
          results.push(fullPath);
        }
      }
    } catch (error) {
      console.error('Error reading directory:', error);
    }

    return results;
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
