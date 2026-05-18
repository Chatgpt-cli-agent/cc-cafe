/**
 * Mod Installation Service (Electron-based)
 *
 * Handles downloading and installing mods locally using Electron IPC
 */

import { getModDownloadUrl, getCurseForgeMod } from '@/lib/curseforgeApi';
import { modCacheService } from './ModCacheService';
import { profileService } from './ProfileService';
import { symlinkService } from './SymlinkService';
import { fakeScoreService } from './FakeScoreService';
import { sanitizeModName } from '@/utils/pathSanitizer';
import type { ProfileMod } from '@/types/profile';
import type { FakeScoreResult, ZipAnalysis } from '@/types/fakeDetection';

/**
 * Installation progress callback
 */
export type ProgressCallback = (progress: {
  stage: 'downloading' | 'extracting' | 'installing' | 'complete' | 'error';
  percent: number;
  message: string;
}) => void;

/**
 * Callback for fake mod detection during installation
 * Called when a suspicious mod is detected before completing installation
 * @returns 'install' to continue, 'cancel' to abort, 'report' to abort and report
 */
export type FakeDetectionCallback = (
  scoreResult: FakeScoreResult,
  zipAnalysis: ZipAnalysis
) => Promise<'install' | 'cancel' | 'report'>;

/**
 * Installation result
 */
export interface InstallationResult {
  success: boolean;
  modName: string;
  filesInstalled: string[];
  error?: string;
}

/**
 * Service for downloading and installing mods using Electron
 */
export class ModInstallationService {
  /**
   * Download and install a mod from CurseForge
   * @param modId - CurseForge mod ID
   * @param modsPath - Path to The Sims 4 Mods folder
   * @param onProgress - Progress callback for UI updates
   * @param fileId - Specific file version to install (optional)
   * @param onFakeDetection - Callback when suspicious mod is detected (optional)
   */
  async installMod(
      modId: number,
      modsPath: string,
      onProgress?: ProgressCallback,
      fileId?: number,
      onFakeDetection?: FakeDetectionCallback
  ): Promise<InstallationResult> {
    // Declare timer variable outside try/catch so it can be cleared in finally
    let progressInterval: NodeJS.Timeout | null = null;

    try {
      onProgress?.({
        stage: 'downloading',
        percent: 0,
        message: 'Getting download URL...',
      });

      const downloadInfo = await getModDownloadUrl(modId, fileId);
      const { modName, fileName, downloadUrl, fileSize, fileId: actualFileId } = downloadInfo;

      // Get mod details for library display
      let modLogo: string | undefined;
      let modAuthors: string[] | undefined;
      let lastUpdateDate: string | undefined;
      let versionNumber: string = '1.0.0';

      try {
        const modDetails = await getCurseForgeMod(modId);
        modLogo = modDetails.logo || undefined;
        modAuthors = modDetails.authors?.map((author) => author.name);
        lastUpdateDate = modDetails.dateModified;

        // Get version from latest file if available
        if (modDetails.latestFiles && modDetails.latestFiles.length > 0) {
          versionNumber = modDetails.latestFiles[0].displayName || '1.0.0';
        }
      } catch (error) {
        console.warn('Failed to fetch mod details:', error);
        // Continue with defaults if fetch fails
      }

      const appDataDir = await window.electron.ipcRenderer.invoke('path:appDataDir');
      const tempDir = await window.electron.ipcRenderer.invoke('path:join', appDataDir, 'temp', 'downloads', `mod_${modId}_${Date.now()}`);
      await window.electron.ipcRenderer.invoke('fs:mkdir', tempDir, { recursive: true });

      const tempFilePath = await window.electron.ipcRenderer.invoke('path:join', tempDir, fileName);

      // Start smooth progress simulation during download
      const downloadStartTime = Date.now();
      let currentProgress = 5;

      const startProgressSimulation = () => {
        progressInterval = setInterval(() => {
          if (currentProgress < 65) {
            // Smooth acceleration curve: progress speeds up over time
            const elapsed = Date.now() - downloadStartTime;
            const estimatedProgress = 5 + Math.pow(elapsed / 15000, 0.8) * 60;
            currentProgress = Math.min(estimatedProgress, 65);

            onProgress?.({
              stage: 'downloading',
              percent: Math.floor(currentProgress),
              message: `Downloading ${fileName}...`,
            });
          }
        }, 200); // Update every 200ms for smooth animation
      };

      startProgressSimulation();

      // Download file using IPC http:fetch
      const fetchResult = await window.electron.ipcRenderer.invoke('http:fetch', downloadUrl, {
        method: 'GET',
        responseType: 'arraybuffer',
      });

      if (!fetchResult.ok) {
        throw new Error(`Download failed with status ${fetchResult.status}: ${fetchResult.statusText}`);
      }

      const fileBytes = fetchResult.data;

      // Stop progress simulation
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }

      onProgress?.({
        stage: 'downloading',
        percent: 70,
        message: `Downloaded ${fileName}`,
      });

      await window.electron.ipcRenderer.invoke('fs:writeFile', tempFilePath, fileBytes);

      // Analyze ZIP for fake mod detection if callback provided
      if (onFakeDetection) {
        onProgress?.({
          stage: 'installing',
          percent: 72,
          message: 'Analyzing mod contents...',
        });

        try {
          const zipAnalysis = await fakeScoreService.analyzeZip(tempFilePath);
          const scoreResult = fakeScoreService.calculateScore(
            modName,
            zipAnalysis,
            0, // Download count not available here
            false
          );

          if (scoreResult.isSuspicious) {
            const decision = await onFakeDetection(scoreResult, zipAnalysis);

            if (decision === 'cancel' || decision === 'report') {
              await this.cleanupTempDir(tempDir);
              return {
                success: false,
                modName,
                filesInstalled: [],
                error:
                  decision === 'report'
                    ? 'Installation cancelled - mod reported'
                    : 'Installation cancelled by user',
              };
            }
            // 'install' continues normally
          }
        } catch (analysisError) {
          console.warn('[ModInstallationService] Fake detection analysis failed:', analysisError);
          // Continue installation if analysis fails
        }
      }

      onProgress?.({
        stage: 'installing',
        percent: 75,
        message: 'Installing mod files...',
      });

      const ext = fileName.toLowerCase().split('.').pop() || '';

      if (ext !== 'zip') {
        throw new Error(`Unsupported file format: ${ext}`);
      }

      onProgress?.({
        stage: 'installing',
        percent: 70,
        message: 'Adding to profile cache...',
      });

      // Initialize services
      await modCacheService.initialize();
      await profileService.initialize();

      // Get active profile
      const activeProfile = await profileService.getActiveProfile();
      if (!activeProfile) {
        throw new Error(
          'No active profile. Please create or activate a profile before installing mods.'
        );
      }

      // Add mod to cache (handles deduplication)
      const cachedMod = await modCacheService.addToCache(
        modId,
        fileName,
        tempFilePath,
        activeProfile.id
      );

      // Add mod to active profile
      const profileMod: ProfileMod = {
        modId,
        modName,
        versionId: actualFileId,
        versionNumber,
        fileHash: cachedMod.fileHash,
        fileName,
        installDate: new Date().toISOString(),
        enabled: true,
        cacheLocation: cachedMod.fileHash,
        logo: modLogo,
        authors: modAuthors,
        lastUpdateDate,
      };

      await profileService.addModToProfile(activeProfile.id, profileMod);

      // If modsPath is provided, activate all profile mods (not just the new one)
      let installedFiles: string[] = [];
      if (modsPath && (await window.electron.ipcRenderer.invoke('fs:exists', modsPath))) {
        onProgress?.({
          stage: 'installing',
          percent: 85,
          message: 'Creating symlinks to profile mods...',
        });

        // Get the updated profile with all mods
        const updatedProfile = await profileService.getProfile(activeProfile.id);
        if (!updatedProfile) {
          throw new Error('Failed to retrieve updated profile');
        }

        // Build cache paths for ALL mods in the profile
        const allModPaths: { source: string; modName: string }[] = [];
        for (const mod of updatedProfile.mods) {
          const cachePath = await modCacheService.getCachePath(mod.fileHash);
          const sanitizedModName = sanitizeModName(mod.modName);
          allModPaths.push({ source: cachePath, modName: sanitizedModName });
        }

        const symlinkResult = await symlinkService.activateProfile(modsPath, allModPaths);

        if (!symlinkResult.success) {
          console.warn('Failed to create symlinks:', symlinkResult.errors);
          // Don't fail - mods are in cache and profile
        }

        installedFiles = cachedMod.files.map((f: any) => f.fileName);
      } else {
        // If modsPath not provided, just return the cached files
        installedFiles = cachedMod.files.map((f: any) => f.fileName);
      }

      await this.cleanupTempDir(tempDir);

      onProgress?.({
        stage: 'complete',
        percent: 100,
        message: `${modName} installed successfully!`,
      });

      return {
        success: true,
        modName,
        filesInstalled: installedFiles,
      };
    } catch (error: any) {
      console.error('[ModInstallationService] Installation error:', error);

      onProgress?.({
        stage: 'error',
        percent: 0,
        message: error.message || 'Installation failed',
      });

      return {
        success: false,
        modName: 'Unknown',
        filesInstalled: [],
        error: error.message || 'Installation failed',
      };
    } finally {
      // Ensure timer is always cleared
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    }
  }

  /**
   * Install a .zip mod file (extract and find .package files)
   * Note: This is now largely handled by modCacheService.addToCache
   */
  private async installZipMod(
      zipPath: string,
      modsPath: string,
      modName: string,
      onProgress?: ProgressCallback
  ): Promise<string[]> {
    const sanitizedModName = sanitizeModName(modName);
    const modFolder = await window.electron.ipcRenderer.invoke('path:join', modsPath, sanitizedModName);

    if (!(await window.electron.ipcRenderer.invoke('fs:exists', modFolder))) {
      await window.electron.ipcRenderer.invoke('fs:mkdir', modFolder, { recursive: true });
    }

    onProgress?.({
      stage: 'extracting',
      percent: 75,
      message: 'Extracting files...',
    });

    await this.extractZip(zipPath, modFolder);

    const packageFiles = await this.findPackageFiles(modFolder);

    onProgress?.({
      stage: 'installing',
      percent: 90,
      message: `Installing ${packageFiles.length} files...`,
    });

    return packageFiles;
  }

  /**
   * Extract a zip file using Electron IPC
   */
  private async extractZip(zipPath: string, destDir: string): Promise<void> {
    try {
      const result = await window.electron.ipcRenderer.invoke('extract-zip', {
        zipPath,
        destDir,
      });
      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('[ModInstallationService] Failed to extract zip:', error);
      throw new Error(`Failed to extract zip: ${error}`);
    }
  }

  /**
   * Recursively find all .package files in a directory
   */
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

  /**
   * Cleanup temp directory
   */
  private async cleanupTempDir(tempDir: string): Promise<void> {
    try {
      await window.electron.ipcRenderer.invoke('fs:remove', tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to cleanup temp dir:', error);
    }
  }
}

export const modInstallationService = new ModInstallationService();
