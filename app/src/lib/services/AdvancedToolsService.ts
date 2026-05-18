'use client';

export interface ToolFileRef {
  path: string;
  name: string;
}

export interface IdConflictItem {
  key: string;
  files: ToolFileRef[];
}

export interface PolycountItem {
  path: string;
  name: string;
  geometryCount: number;
  minFaces: number;
  maxFaces: number;
  totalFaces: number;
}

export interface IdConflictScanResult {
  items: IdConflictItem[];
  fileCount: number;
}

export interface PolycountScanResult {
  items: PolycountItem[];
  fileCount: number;
}

class AdvancedToolsService {
  async scanIdConflicts(rootPath: string): Promise<IdConflictScanResult> {
    return window.electron.ipcRenderer.invoke('tools:scan-id-conflicts', { rootPath });
  }

  async scanPolycount(rootPath: string): Promise<PolycountScanResult> {
    return window.electron.ipcRenderer.invoke('tools:scan-polycount', { rootPath });
  }
}

export const advancedToolsService = new AdvancedToolsService();
