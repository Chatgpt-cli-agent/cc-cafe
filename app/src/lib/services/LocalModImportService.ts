/**
 * Local Mod Import Service (Electron-based)
 *
 * Handles importing local mod files (.package, .ts4script, .zip) from the filesystem
 * and integrating them into CC Café's mod management system with fake detection
 */

import { v4 as uuidv4 } from 'uuid';
import { modCacheService } from './ModCacheService';
import { profileService } from './ProfileService';
import { fakeScoreService } from './FakeScoreService';
import { resolveAppDataPath } from './AppPaths';
import type { ProfileMod } from '@/types/profile';
import type { FakeScoreResult, ZipAnalysis } from '@/types/fakeDetection';

/**
 * Progress callback for multi-file import
 */
export type MultiFileProgressCallback = (progress: {
  stage: 'analyzing' | 'extracting' | 'installing' | 'complete';
  currentFile: string;
  currentIndex: number;
  totalFiles: number;
}) => void;

/**
 * Callback for fake mod detection during import
 */
export type FakeDetectionCallback = (
  scoreResult: FakeScoreResult,
  zipAnalysis: ZipAnalysis
) => Promise<'install' | 'cancel' | 'report'>;

/**
 * Result for a single file import
 */
export interface SingleFileResult {
  success: boolean;
  fileName: string;
  modName: string;
  profileMod?: ProfileMod;
  error?: string;
}

/**
 * Summary of entire import operation
 */
export interface ImportSummary {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ fileName: string; error: string }>;
  importedMods: ProfileMod[];
}

/**
 * Service for importing local mod files using Electron
 */
export class LocalModImportService {
  private readonly VALID_EXTENSIONS = ['.package', '.ts4script', '.zip', '.rar'];

  /**
   * Open file picker and import selected mod files
   *
   * @param onProgress - Progress callback for UI updates
   * @param onFakeDetection - Callback when suspicious mod is detected
   * @returns Import summary with success/failure counts
   */
  async importModFiles(
    onProgress?: MultiFileProgressCallback,
    onFakeDetection?: FakeDetectionCallback
  ): Promise<ImportSummary> {
    // Ensure active profile exists
    const activeProfile = await profileService.getActiveProfile();
    if (!activeProfile) {
      throw new Error('No active profile selected');
    }

    // Open file picker with multi-select using Electron IPC
    const result = await window.electron.ipcRenderer.invoke('dialog:open', {
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Sims 4 Mods',
          extensions: ['package', 'ts4script', 'zip', 'rar'],
        },
      ],
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return {
        total: 0,
        successful: 0,
        failed: 0,
        errors: [],
        importedMods: [],
      };
    }

    const filePaths = result.filePaths;
    const summary: ImportSummary = {
      total: filePaths.length,
      successful: 0,
      failed: 0,
      errors: [],
      importedMods: [],
    };

    // Process each file
    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      const fileName = await window.electron.ipcRenderer.invoke('path:basename', filePath);

      onProgress?.({
        stage: 'analyzing',
        currentFile: fileName,
        currentIndex: i + 1,
        totalFiles: filePaths.length,
      });

      try {
        // RAR archives are extracted first (S4MM 2.0 parity) and their Sims
        // files imported individually.
        if (fileName.toLowerCase().endsWith('.rar')) {
          const rarResults = await this.processRarArchive(
            filePath,
            activeProfile.id,
            onFakeDetection
          );
          for (const processResult of rarResults) {
            if (processResult.success && processResult.profileMod) {
              summary.successful++;
              summary.importedMods.push(processResult.profileMod);
            } else {
              summary.failed++;
              summary.errors.push({
                fileName: processResult.fileName,
                error: processResult.error || 'Unknown error',
              });
            }
          }
          continue;
        }

        const processResult = await this.processModFile(
          filePath,
          fileName,
          activeProfile.id,
          onFakeDetection
        );

        if (processResult.success && processResult.profileMod) {
          summary.successful++;
          summary.importedMods.push(processResult.profileMod);
        } else {
          summary.failed++;
          summary.errors.push({
            fileName: processResult.fileName,
            error: processResult.error || 'Unknown error',
          });
        }
      } catch (error) {
        summary.failed++;
        summary.errors.push({
          fileName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return summary;
  }

  /**
   * Process a single mod file (internal)
   *
   * @param filePath - Path to the mod file
   * @param fileName - Name of the file
   * @param profileId - Active profile ID
   * @param onFakeDetection - Fake detection callback
   * @returns Result of processing this file
   */
  private async processModFile(
    filePath: string,
    fileName: string,
    profileId: string,
    onFakeDetection?: FakeDetectionCallback
  ): Promise<SingleFileResult> {
    // Validate file extension
    if (!this.isValidModFile(fileName)) {
      const extension = fileName.substring(fileName.lastIndexOf('.'));
      return {
        success: false,
        fileName,
        modName: '',
        error: `Unsupported file type: ${extension}`,
      };
    }

    // Extract mod name from filename
    const modName = this.extractModName(fileName);
    const localModId = uuidv4();

    // Create temp directory for processing
    const tempDir = await this.createTempDir();
    const tempFilePath = await window.electron.ipcRenderer.invoke('path:join', tempDir, fileName);

    try {
      // Copy file to temp directory
      const fileBytes = await window.electron.ipcRenderer.invoke('fs:readFile', filePath);
      await window.electron.ipcRenderer.invoke('fs:writeFile', tempFilePath, fileBytes);

      // For .zip files, perform fake detection
      const isZipFile = fileName.toLowerCase().endsWith('.zip');
      if (isZipFile && onFakeDetection) {
        const zipAnalysis = await fakeScoreService.analyzeZip(tempFilePath);
        const scoreResult = fakeScoreService.calculateScore(
          modName,
          zipAnalysis,
          0, // Download count unknown for local mods
          false
        );

        if (scoreResult.isSuspicious) {
          const decision = await onFakeDetection(scoreResult, zipAnalysis);

          if (decision === 'cancel' || decision === 'report') {
            await this.cleanupTemp(tempDir);
            return {
              success: false,
              fileName,
              modName,
              error: decision === 'report' ? 'Cancelled and reported' : 'Cancelled by user',
            };
          }
          // 'install' continues
        }
      }

      // Add to cache (handles deduplication automatically)
      const cachedMod = await modCacheService.addToCache(
        localModId,
        fileName,
        tempFilePath,
        profileId
      );

      // Create ProfileMod entry
      const profileMod: ProfileMod = {
        localModId,
        isLocal: true,
        modName,
        fileHash: cachedMod.fileHash,
        fileName: cachedMod.fileName,
        installDate: new Date().toISOString(),
        enabled: true,
        cacheLocation: cachedMod.fileHash,
      };

      // Add to profile
      await profileService.addModToProfile(profileId, profileMod);

      // Cleanup temp
      await this.cleanupTemp(tempDir);

      return {
        success: true,
        fileName,
        modName,
        profileMod,
      };
    } catch (error) {
      await this.cleanupTemp(tempDir);
      throw error;
    }
  }

  /**
   * Extract a RAR archive to a temp folder and import each contained Sims
   * file (.package/.ts4script) individually.
   */
  private async processRarArchive(
    filePath: string,
    profileId: string,
    onFakeDetection?: FakeDetectionCallback
  ): Promise<SingleFileResult[]> {
    const tempDir = await this.createTempDir();
    const results: SingleFileResult[] = [];

    try {
      const extraction = await window.electron.ipcRenderer.invoke('s4mm:archive-extract-all', {
        archivePath: filePath,
        outputDir: tempDir,
      });
      if (extraction && extraction.success === false) {
        throw new Error(extraction.error || 'Failed to extract RAR archive');
      }

      const simsFiles: string[] = (extraction?.extractedFiles ?? []).filter((extracted: string) => {
        const lower = extracted.toLowerCase();
        return lower.endsWith('.package') || lower.endsWith('.ts4script');
      });

      if (simsFiles.length === 0) {
        const fileName = await window.electron.ipcRenderer.invoke('path:basename', filePath);
        return [
          {
            success: false,
            fileName,
            modName: '',
            error: 'No Sims 4 files found in the RAR archive',
          },
        ];
      }

      for (const extractedPath of simsFiles) {
        const extractedName = await window.electron.ipcRenderer.invoke(
          'path:basename',
          extractedPath
        );
        results.push(
          await this.processModFile(extractedPath, extractedName, profileId, onFakeDetection)
        );
      }
      return results;
    } finally {
      await this.cleanupTemp(tempDir);
    }
  }

  /**
   * Extract mod name from filename
   *
   * @param fileName - File name with extension
   * @returns Sanitized mod name
   * @example "My Awesome Mod.package" → "My_Awesome_Mod"
   */
  private extractModName(fileName: string): string {
    // Remove extension
    const nameWithoutExt = fileName.replace(/\.(package|ts4script|zip|rar)$/i, '');

    // Sanitize special characters
    const sanitized = nameWithoutExt
      .trim() // Trim whitespace first
      .replace(/[^\w\s-]/g, '_') // Replace special chars with underscore
      .replace(/\s+/g, '_') // Spaces to underscore
      .replace(/_+/g, '_') // Multiple underscores to single
      .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores

    return sanitized || 'Imported_Mod';
  }

  /**
   * Check if file has valid mod extension
   *
   * @param fileName - Name of the file
   * @returns True if extension is valid
   */
  private isValidModFile(fileName: string): boolean {
    const lowerName = fileName.toLowerCase();
    return this.VALID_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  }

  /**
   * Create temp directory for import processing
   *
   * @returns Path to temp directory
   */
  private async createTempDir(): Promise<string> {
    const timestamp = Date.now();
    const tempDir = await resolveAppDataPath('temp', 'imports', `import_${timestamp}`);

    await window.electron.ipcRenderer.invoke('fs:mkdir', tempDir, { recursive: true });
    return tempDir;
  }

  /**
   * Cleanup temp directory
   *
   * @param tempDir - Path to temp directory
   */
  private async cleanupTemp(tempDir: string): Promise<void> {
    try {
      if (await window.electron.ipcRenderer.invoke('fs:exists', tempDir)) {
        await window.electron.ipcRenderer.invoke('fs:remove', tempDir, { recursive: true });
      }
    } catch (error) {
      console.warn('[LocalModImportService] Failed to cleanup temp directory:', error);
    }
  }
}

// Export singleton instance
export const localModImportService = new LocalModImportService();
