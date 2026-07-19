import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron';
import { reportService } from './services/fakeDetection/ReportService';
import { curseForgeProxyService } from './services/curseforge/CurseForgeProxyService';
import { modVersionService } from './services/curseforge/ModVersionService';
import { toolsService } from './services/tools/ToolsService';
import { advancedToolsService } from './services/tools/AdvancedToolsService';
import { fingerprintService } from './services/s4mm/FingerprintService';
import { hqTexturesService } from './services/s4mm/HqTexturesService';
import { mergeToolService } from './services/s4mm/MergeToolService';
import { creatorToolsService } from './services/s4mm/CreatorToolsService';
import { tgiCheckerService } from './services/s4mm/TgiCheckerService';
import { regionMapService } from './services/s4mm/RegionMapService';
import { saveFilesService } from './services/s4mm/SaveFilesService';
import { archiveService } from './services/s4mm/ArchiveService';
import { objectViewerService } from './services/s4mm/ObjectViewerService';
import { packageInspectService } from './services/s4mm/PackageInspectService';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import crypto from 'crypto';
import AdmZip from 'adm-zip';

const execAsync = promisify(exec);

const reportSchema = z.object({
  machineId: z.string().uuid('Invalid machine ID format'),
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason too long'),
  fakeScore: z.number().int().min(0).max(100),
  creatorId: z.number().int().positive().optional(),
  creatorName: z.string().optional(),
});

const batchWarningSchema = z.object({
  modIds: z
    .array(z.number().int().positive())
    .min(1, 'At least one mod ID is required')
    .max(100, 'Maximum 100 mods per request'),
  creatorIds: z.array(z.number().int().positive()).optional(),
});

import { modScanner } from './core/modScanner';

export function registerIpcHandlers() {
  // --- HTTP Handlers ---
  ipcMain.handle('http:fetch', async (_, url: string, options: any = {}) => {
    try {
      const response = await axios({
        url,
        method: options.method || 'GET',
        data: options.body,
        headers: options.headers,
        responseType: options.responseType || 'json',
        maxRedirects: options.maxRedirects || 5,
      });

      return {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers,
        ok: response.status >= 200 && response.status < 300,
      };
    } catch (error: any) {
      if (error.response) {
        return {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers,
          ok: false,
        };
      }
      throw error;
    }
  });

  // --- ZIP Handlers ---
  ipcMain.handle('extract-zip', async (_, { zipPath, destDir }) => {
    try {
      // Ensure destination directory exists
      await fs.mkdir(destDir, { recursive: true });
      
      // Use PowerShell to extract zip on Windows
      const command = `powershell -Command "Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force"`;
      await execAsync(command);
      return { success: true };
    } catch (error: any) {
      console.error('Failed to extract zip:', error);
      return { success: false, error: error.message };
    }
  });

  // --- FS Handlers ---
  ipcMain.handle('fs:exists', async (_, filePath: string) => {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('fs:stat', async (_, filePath: string) => {
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        mtime: stats.mtime,
      };
    } catch (error: any) {
      throw new Error(`Failed to get stats: ${error.message}`);
    }
  });

  ipcMain.handle('fs:readDir', async (_, dirPath: string) => {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries.map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
      }));
    } catch (error: any) {
      throw new Error(`Failed to read directory: ${error.message}`);
    }
  });

  ipcMain.handle('fs:readFile', async (_, filePath: string) => {
    try {
      const buffer = await fs.readFile(filePath);
      return new Uint8Array(buffer);
    } catch (error: any) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  });

  ipcMain.handle('fs:readTextFile', async (_, filePath: string) => {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error: any) {
      throw new Error(`Failed to read text file: ${error.message}`);
    }
  });

  ipcMain.handle('fs:writeFile', async (_, filePath: string, data: Uint8Array | string) => {
    try {
      await fs.writeFile(filePath, data);
      return true;
    } catch (error: any) {
      throw new Error(`Failed to write file: ${error.message}`);
    }
  });

  ipcMain.handle('fs:rename', async (_, sourcePath: string, targetPath: string) => {
    try {
      await fs.rename(sourcePath, targetPath);
      return true;
    } catch (error: any) {
      throw new Error(`Failed to rename file: ${error.message}`);
    }
  });

  ipcMain.handle('fs:mkdir', async (_, dirPath: string, options?: { recursive?: boolean }) => {
    try {
      await fs.mkdir(dirPath, options);
      return true;
    } catch (error: any) {
      throw new Error(`Failed to create directory: ${error.message}`);
    }
  });

  ipcMain.handle('fs:remove', async (_, filePath: string, options?: { recursive?: boolean }) => {
    try {
      await fs.rm(filePath, options);
      return true;
    } catch (error: any) {
      throw new Error(`Failed to remove: ${error.message}`);
    }
  });

  ipcMain.handle('fs:copyDir', async (_, src: string, dest: string) => {
    try {
      await fs.mkdir(dest, { recursive: true });
      // Helper function for recursive copy
      const copyRecursive = async (s: string, d: string) => {
        const stats = await fs.stat(s);
        if (stats.isDirectory()) {
          await fs.mkdir(d, { recursive: true });
          const entries = await fs.readdir(s);
          for (const entry of entries) {
            await copyRecursive(path.join(s, entry), path.join(d, entry));
          }
        } else {
          await fs.copyFile(s, d);
        }
      };
      await copyRecursive(src, dest);
      return true;
    } catch (error: any) {
      throw new Error(`Failed to copy directory: ${error.message}`);
    }
  });

  // --- Crypto Handlers ---
  ipcMain.handle('crypto:hashFile', async (_, filePath: string) => {
    try {
      const buffer = await fs.readFile(filePath);
      const hash = crypto.createHash('sha256');
      hash.update(buffer);
      return hash.digest('hex');
    } catch (error: any) {
      throw new Error(`Failed to calculate hash: ${error.message}`);
    }
  });

  // --- Machine ID Handlers ---
  ipcMain.handle('app:getMachineId', async () => {
    const configPath = path.join(app.getPath('userData'), 'machine_id');
    try {
      return await fs.readFile(configPath, 'utf-8');
    } catch {
      const machineId = crypto.randomUUID();
      await fs.writeFile(configPath, machineId);
      return machineId;
    }
  });

  // --- ZIP Analysis Handlers ---
  ipcMain.handle('zip:analyze', async (_, { zipPath }) => {
    try {
      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();
      const fileList = entries.map(e => e.entryName);
      const hasPackage = fileList.some(f => f.toLowerCase().endsWith('.package'));
      const hasScript = fileList.some(f => f.toLowerCase().endsWith('.ts4script'));

      return {
        file_list: fileList,
        has_package_files: hasPackage,
        has_ts_script: hasScript,
        total_files: fileList.length
      };
    } catch (error: any) {
      throw new Error(`Failed to analyze zip: ${error.message}`);
    }
  });

  // --- Disk Benchmark Handlers ---
  ipcMain.handle('disk:benchmark', async (_, { testPath }) => {
    try {
      const testFile = path.join(testPath, 'benchmark.tmp');
      const data = Buffer.alloc(10 * 1024 * 1024); // 10MB for faster test
      
      const startWrite = Date.now();
      await fs.writeFile(testFile, data);
      const writeTime = (Date.now() - startWrite) / 1000;
      
      const startRead = Date.now();
      await fs.readFile(testFile);
      const readTime = (Date.now() - startRead) / 1000;
      
      await fs.rm(testFile);
      
      const writeSpeed = 10 / writeTime; // MB/s
      const readSpeed = 10 / readTime; // MB/s
      
      let driveType = 'HDD';
      if (writeSpeed > 300) driveType = 'NVMe';
      else if (writeSpeed > 100) driveType = 'SSD';

      return {
        writeSpeed,
        readSpeed,
        driveType
      };
    } catch (error: any) {
      throw new Error(`Disk benchmark failed: ${error.message}`);
    }
  });

  // --- Path Handlers ---
  ipcMain.handle('path:join', async (_, ...args: string[]) => {
    return path.join(...args);
  });

  ipcMain.handle('path:basename', async (_, filePath: string) => {
    return path.basename(filePath);
  });

  ipcMain.handle('path:appDataDir', async () => {
    return app.getPath('userData');
  });

  ipcMain.handle('path:documentDir', async () => {
    return app.getPath('documents');
  });

  // --- Dialog Handlers ---
  ipcMain.handle('dialog:open', async (_, options: any) => {
    const result = await dialog.showOpenDialog(options);
    return result;
  });

  ipcMain.handle('dialog:save', async (_, options: any) => {
    const result = await dialog.showSaveDialog(options);
    return result;
  });

  // --- Shell Handlers ---
  ipcMain.handle('shell:execute', async (_, command: string, args: string[]) => {
    try {
      const fullCommand = `${command} ${args.join(' ')}`;
      const { stdout, stderr } = await execAsync(fullCommand);
      return { stdout, stderr, code: 0 };
    } catch (error: any) {
      return { stdout: error.stdout, stderr: error.stderr, code: error.code || 1 };
    }
  });

  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    await shell.openExternal(url);
  });

  ipcMain.handle('shell:openPath', async (_, targetPath: string) => {
    return shell.openPath(targetPath);
  });

  ipcMain.handle('shell:showItemInFolder', async (_, targetPath: string) => {
    shell.showItemInFolder(targetPath);
    return true;
  });

  // --- App Handlers ---
  ipcMain.handle('app:getVersion', async () => {
    return app.getVersion();
  });

  ipcMain.handle('app:relaunch', async () => {
    app.relaunch();
    app.exit(0);
  });

  // --- Tools Handlers ---
  ipcMain.handle('tools:get-metadata', async (_event, { toolId }) => {
    try {
      return toolsService.getMetadata(toolId);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('tools:get-file', async (_event, { toolId, filename }) => {
    try {
      const filePath = toolsService.getFilePath(toolId, filename);
      return await fs.readFile(filePath);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('tools:scan-id-conflicts', async (_event, { rootPath }) => {
    try {
      return await advancedToolsService.scanIdConflicts(rootPath);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('tools:scan-polycount', async (_event, { rootPath }) => {
    try {
      return await advancedToolsService.scanPolycount(rootPath);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // --- Window Handlers ---
  ipcMain.handle('window:setTitle', async (event, title: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.setTitle(title);
  });

  ipcMain.handle('window:close', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.close();
  });

  ipcMain.handle('window:minimize', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.minimize();
  });

  ipcMain.handle('window:maximize', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window?.isMaximized()) {
      window.unmaximize();
    } else {
      window?.maximize();
    }
  });
  /**
   * Scan a .package file for details
   */
  ipcMain.handle('scan-package', async (_event, { filePath }) => {
    try {
      return await modScanner.scanPackage(filePath);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Extract thumbnails from a .package file
   */
  ipcMain.handle('extract-thumbnails', async (_event, { filePath, outputDir }) => {
    try {
      return await modScanner.extractThumbnails(filePath, outputDir);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Submit a report for a fake mod
   */
  ipcMain.handle('submit-report', async (_event, { modId, report }) => {
    try {
      const validated = reportSchema.parse(report);
      return await reportService.submitReport(modId, validated);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Get warning status for a mod
   */
  ipcMain.handle('get-warning-status', async (_event, { modId, creatorId }) => {
    try {
      return await reportService.getWarningStatus(modId, creatorId);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Get warning status for multiple mods (batch)
   */
  ipcMain.handle('get-batch-warnings', async (_event, { modIds, creatorIds }) => {
    try {
      const validated = batchWarningSchema.parse({ modIds, creatorIds });
      return await reportService.getBatchWarningStatus(validated.modIds, validated.creatorIds);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Check if a creator is banned
   */
  ipcMain.handle('get-creator-ban-status', async (_event, { creatorId }) => {
    try {
      return await reportService.isCreatorBanned(creatorId);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /**
   * CurseForge: Search mods
   */
  ipcMain.handle('curseforge-search', async (_event, options) => {
    try {
      return await curseForgeProxyService.searchMods(options);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /**
   * CurseForge: Get mod details
   */
  ipcMain.handle('curseforge-get-mod', async (_event, { apiKey, modId }) => {
    try {
      return await curseForgeProxyService.getMod(apiKey, modId);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /**
   * CurseForge: Get file download URL
   */
  ipcMain.handle('curseforge-download-url', async (_event, { apiKey, modId, fileId }) => {
    try {
      return await curseForgeProxyService.getDownloadUrl(apiKey, modId, fileId);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /**
   * CurseForge: Get categories
   */
  ipcMain.handle('curseforge-get-categories', async (_event, { apiKey }) => {
    try {
      return await curseForgeProxyService.getCategories(apiKey);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /**
   * CurseForge: Get batch versions
   */
  ipcMain.handle('curseforge-batch-versions', async (_event, { apiKey, modIds }) => {
    try {
      return await modVersionService.getLatestVersions(apiKey, modIds);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // --- S4MM 2.0 feature ports ---

  /** Fingerprints: compute CurseForge fingerprints for local files */
  ipcMain.handle('s4mm:fingerprint-scan', async (_event, { rootPath }) => {
    try {
      return await fingerprintService.scanFolder(rootPath);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /** Fingerprints: match fingerprints against the CurseForge API */
  ipcMain.handle('s4mm:fingerprint-match', async (_event, { apiKey, fingerprints }) => {
    try {
      return await fingerprintService.matchFingerprints(apiKey, fingerprints);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /** HQ textures: scan for oversized LRLE/RLE2 textures */
  ipcMain.handle('s4mm:hq-textures-scan', async (_event, { rootPath, types }) => {
    try {
      return await hqTexturesService.scan(rootPath, types);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /** Merge tool: find S4S merged packages */
  ipcMain.handle('s4mm:merge-scan', async (_event, { rootPath }) => {
    try {
      return await mergeToolService.scanMergedPackages(rootPath);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /** Merge tool: extract/unmerge/remove packages from a merged file */
  ipcMain.handle('s4mm:merge-action', async (_event, { action, filePath, destination, packages }) => {
    try {
      if (action === 'extract') {
        mergeToolService.extractPackages(filePath, destination, packages);
      } else if (action === 'unmerge') {
        mergeToolService.unmergePackages(filePath, destination, packages);
      } else if (action === 'remove') {
        mergeToolService.removePackages(filePath, packages);
      } else if (action === 'unmerge-all') {
        mergeToolService.unmergeAll(filePath, destination);
      } else {
        throw new Error(`Unknown merge action: ${action}`);
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /** Creators: build a loading screen package from an image */
  ipcMain.handle('s4mm:create-loading-screen', async (_event, { outputPath, imagePath, options }) => {
    try {
      return await creatorToolsService.createLoadingScreen(outputPath, imagePath, options);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /** Creators: build a main menu override package from an image */
  ipcMain.handle('s4mm:create-main-menu', async (_event, { outputPath, imagePath }) => {
    try {
      return await creatorToolsService.createMainMenu(outputPath, imagePath);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /** Creators: find existing loading screen / main menu packages */
  ipcMain.handle('s4mm:creator-scan', async (_event, { rootPath }) => {
    try {
      return await creatorToolsService.scanCreatorPackages(rootPath);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /** Creators: randomize which loading screen is active */
  ipcMain.handle('s4mm:creator-randomize', async (_event, { filePaths }) => {
    try {
      return creatorToolsService.randomize(filePaths);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /** TGI checker: find CAS parts with unresolved TGI references */
  ipcMain.handle('s4mm:tgi-check', async (_event, { rootPath, threshold }) => {
    try {
      return await tgiCheckerService.check(rootPath, threshold);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /** Region map: find packages containing region maps */
  ipcMain.handle('s4mm:rmap-scan', async (_event, { rootPath }) => {
    try {
      return await regionMapService.findFilesWithRegionMaps(rootPath);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /** Region map: check mesh bounds against region expectations */
  ipcMain.handle('s4mm:rmap-process', async (_event, { files, types, options }) => {
    try {
      return regionMapService.processFiles(files, types, options);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /** Save files: list saves with decoded slot names */
  ipcMain.handle('s4mm:saves-list', async (_event, { savesPath }) => {
    try {
      return saveFilesService.listSaves(savesPath);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /** Save files: decode a save file summary */
  ipcMain.handle('s4mm:saves-read', async (_event, { filePath }) => {
    try {
      return saveFilesService.readSaveSummary(filePath);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /** Archives: list ZIP/RAR contents */
  ipcMain.handle('s4mm:archive-list', async (_event, { archivePath }) => {
    try {
      return await archiveService.listContents(archivePath);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /** Archives: extract a full ZIP/RAR archive */
  ipcMain.handle('s4mm:archive-extract-all', async (_event, { archivePath, outputDir }) => {
    try {
      return await archiveService.extractAll(archivePath, outputDir);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /** Object viewer: CAS/COBJ items and swatches in a package */
  ipcMain.handle('s4mm:objectviewer-items', async (_event, { filePath }) => {
    try {
      return objectViewerService.getCasItems(filePath);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /** Object viewer: GEOM mesh data for rendering */
  ipcMain.handle('s4mm:objectviewer-models', async (_event, { filePath, addresses }) => {
    try {
      return objectViewerService.getModels(filePath, addresses);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /** Object viewer: decode a texture resource to PNG */
  ipcMain.handle('s4mm:objectviewer-texture', async (_event, { filePath, address }) => {
    try {
      return await objectViewerService.extractTexture(filePath, address);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /** Package inspect: S4MM-style package classification */
  ipcMain.handle('s4mm:inspect-package', async (_event, { filePath }) => {
    try {
      return await packageInspectService.inspectFile(filePath);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /** Package inspect: classify every package in a folder */
  ipcMain.handle('s4mm:inspect-scan', async (_event, { rootPath }) => {
    try {
      return await packageInspectService.scanFolder(rootPath);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
