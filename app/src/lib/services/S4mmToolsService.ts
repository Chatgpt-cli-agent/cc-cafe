'use client';

export interface FingerprintedFile {
  path: string;
  name: string;
  fingerprint: number;
}

export interface FingerprintMatch {
  fingerprint: number;
  modId: number;
  fileId: number;
  fileName: string;
  displayName: string;
  downloadUrl: string | null;
}

export interface TextureInfo {
  key: string;
  width: number | null;
  height: number | null;
  success: boolean;
}

export interface HqTextureItem {
  path: string;
  name: string;
  textures: TextureInfo[];
  maxWidth: number;
  maxHeight: number;
}

export interface MergedPackageEntry {
  name: string;
  resources: string[];
}

export interface MergedFileInfo {
  path: string;
  name: string;
  manifestName: string;
  packages: MergedPackageEntry[];
}

export interface CreatorPackageInfo {
  path: string;
  name: string;
  kind: 'loading-screen' | 'main-menu';
  active: boolean;
}

export interface TgiCheckItem {
  path: string;
  name: string;
  totalReferences: number;
  missingReferences: number;
  details: { caspInstance: string; missingAddresses: string[] }[];
}

export interface RegionMapFile {
  path: string;
  name: string;
}

export interface RegionMapItem {
  path: string;
  name: string;
  issues: { meshkey: string; region: number; extremPoints: any }[];
}

export interface SaveFileInfo {
  path: string;
  name: string;
  slotName: string | null;
  size: number;
  modifiedAt: number;
}

export interface SaveDataSummary {
  slotName: string | null;
  slotId: string | null;
  householdCount: number;
  simCount: number;
  simNames: string[];
}

export interface CasSwatchInfo {
  propId: string;
  instance: string;
  swatch: string;
  age: string;
  gender: string;
  body: string;
  lodLevels: { level: number; list: string[] }[];
  diffuseAddress: any;
}

export interface CasItemsResult {
  filePath: string;
  swatches: CasSwatchInfo[];
  cobjGroups: any[];
}

export interface ModelChunk {
  vertex: Record<string, number>[];
  faces: number[][];
}

export interface ModelResult {
  models: { address: string; data: ModelChunk[] }[];
  missingAddresses: string[];
}

export interface PackageInspection {
  path: string;
  name: string;
  resourceCount: number;
  includesCasp: boolean;
  includesCobj: boolean;
  includesClip: boolean;
  includesXml: boolean;
  includesGeom: boolean;
  isMerged: boolean;
  isRecolor: boolean;
  posePacks: { displayName: string; description: string }[];
  xmlTypes: string;
}

function assertOk<T>(result: T & { success?: boolean; error?: string }): T {
  if (result && typeof result === 'object' && (result as any).success === false) {
    throw new Error((result as any).error || 'Operation failed');
  }
  return result;
}

/**
 * Renderer-side client for the S4MM 2.0 feature ports exposed over IPC.
 */
class S4mmToolsService {
  private invoke<T>(channel: string, payload?: any): Promise<T> {
    return window.electron.ipcRenderer.invoke(channel, payload).then(assertOk);
  }

  // Fingerprints
  scanFingerprints(rootPath: string) {
    return this.invoke<{ files: FingerprintedFile[]; fileCount: number }>('s4mm:fingerprint-scan', { rootPath });
  }

  matchFingerprints(apiKey: string, fingerprints: number[]) {
    return this.invoke<{ matches: FingerprintMatch[]; unmatchedFingerprints: number[] }>('s4mm:fingerprint-match', {
      apiKey,
      fingerprints,
    });
  }

  // HQ textures
  scanHqTextures(rootPath: string, types?: number[]) {
    return this.invoke<{ items: HqTextureItem[]; fileCount: number }>('s4mm:hq-textures-scan', { rootPath, types });
  }

  // Merge tool
  scanMergedPackages(rootPath: string) {
    return this.invoke<{ items: MergedFileInfo[]; fileCount: number }>('s4mm:merge-scan', { rootPath });
  }

  mergeAction(action: 'extract' | 'unmerge' | 'remove' | 'unmerge-all', filePath: string, destination?: string, packages?: MergedPackageEntry[]) {
    return this.invoke<{ success: boolean }>('s4mm:merge-action', { action, filePath, destination, packages });
  }

  // Creators
  createLoadingScreen(outputPath: string, imagePath: string, options?: { showTips?: boolean; tipsColor?: string }) {
    return this.invoke<{ file: string }>('s4mm:create-loading-screen', { outputPath, imagePath, options });
  }

  createMainMenu(outputPath: string, imagePath: string) {
    return this.invoke<{ file: string }>('s4mm:create-main-menu', { outputPath, imagePath });
  }

  scanCreatorPackages(rootPath: string) {
    return this.invoke<{ items: CreatorPackageInfo[]; fileCount: number }>('s4mm:creator-scan', { rootPath });
  }

  randomizeLoadingScreens(filePaths: string[]) {
    return this.invoke<{ onChanges: any[]; offChanges: any[] }>('s4mm:creator-randomize', { filePaths });
  }

  // TGI checker
  checkTgi(rootPath: string, threshold?: number) {
    return this.invoke<{ items: TgiCheckItem[]; fileCount: number; caspFileCount: number }>('s4mm:tgi-check', {
      rootPath,
      threshold,
    });
  }

  // Region map
  scanRegionMaps(rootPath: string) {
    return this.invoke<{ files: RegionMapFile[]; fileCount: number }>('s4mm:rmap-scan', { rootPath });
  }

  processRegionMaps(files: RegionMapFile[], types: { type: number; bounds: any }[], options?: any) {
    return this.invoke<{ items: RegionMapItem[] }>('s4mm:rmap-process', { files, types, options });
  }

  // Save files
  listSaves(savesPath?: string) {
    return this.invoke<{ savesPath: string; items: SaveFileInfo[] }>('s4mm:saves-list', { savesPath });
  }

  readSave(filePath: string) {
    return this.invoke<SaveDataSummary>('s4mm:saves-read', { filePath });
  }

  // Archives
  listArchive(archivePath: string) {
    return this.invoke<{
      files: { name: string; internalPath: string; size: number }[];
      simsFiles: { name: string; internalPath: string; size: number }[];
      containsSimsFiles: boolean;
    }>('s4mm:archive-list', { archivePath });
  }

  extractArchive(archivePath: string, outputDir: string) {
    return this.invoke<{ extractedFiles: string[] }>('s4mm:archive-extract-all', { archivePath, outputDir });
  }

  // Object viewer
  getCasItems(filePath: string) {
    return this.invoke<CasItemsResult>('s4mm:objectviewer-items', { filePath });
  }

  getModels(filePath: string, addresses: string[]) {
    return this.invoke<ModelResult>('s4mm:objectviewer-models', { filePath, addresses });
  }

  getTexture(filePath: string, address: string) {
    return this.invoke<{ address: string; dataUrl: string | null }>('s4mm:objectviewer-texture', { filePath, address });
  }

  // Package inspection
  inspectPackage(filePath: string) {
    return this.invoke<PackageInspection | null>('s4mm:inspect-package', { filePath });
  }

  inspectFolder(rootPath: string) {
    return this.invoke<{ items: PackageInspection[]; fileCount: number }>('s4mm:inspect-scan', { rootPath });
  }
}

export const s4mmToolsService = new S4mmToolsService();
