import fs from 'fs/promises';
import path from 'path';

const { Pack } = require('../../core/DBPFReader');

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

async function walkPackageFiles(rootPath: string): Promise<string[]> {
  const results: string[] = [];

  const walk = async (currentPath: string): Promise<void> => {
    let entries: any[];
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true }) as any;
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.package')) {
        results.push(fullPath);
      }
    }
  };

  await walk(rootPath);
  return results;
}

function summarizePack(filePath: string): PolycountItem | null {
  try {
    const pack = new Pack(filePath);
    pack.checkFile();
    if (pack.error) return null;
    pack.calculateIndexList();

    const geomMap = pack.calulateGEOMSizeMapFiles();
    if (!geomMap || geomMap.size === 0) {
      return null;
    }

    let minFaces = Number.MAX_SAFE_INTEGER;
    let maxFaces = 0;
    let totalFaces = 0;

    for (const value of geomMap.values()) {
      const faces = Number(value.faces || 0);
      totalFaces += faces;
      if (faces < minFaces) minFaces = faces;
      if (faces > maxFaces) maxFaces = faces;
    }

    return {
      path: path.dirname(filePath),
      name: path.basename(filePath),
      geometryCount: geomMap.size,
      minFaces: minFaces === Number.MAX_SAFE_INTEGER ? 0 : minFaces,
      maxFaces,
      totalFaces,
    };
  } catch (error) {
    console.error('[AdvancedToolsService] Failed to summarize pack:', filePath, error);
    return null;
  }
}

export class AdvancedToolsService {
  async scanIdConflicts(rootPath: string): Promise<{ items: IdConflictItem[]; fileCount: number }> {
    const packageFiles = await walkPackageFiles(rootPath);
    const keyMap = new Map<string, Set<string>>();

    for (const filePath of packageFiles) {
      try {
        const pack = new Pack(filePath);
        pack.checkFile();
        if (pack.error) continue;
        pack.calculateIndexList();

        for (const entry of pack.index_List || []) {
          const key = entry.getKey ? String(entry.getKey()).toLowerCase() : '';
          if (!key) continue;

          const files = keyMap.get(key) ?? new Set<string>();
          files.add(filePath);
          keyMap.set(key, files);
        }
      } catch (error) {
        console.error('[AdvancedToolsService] ID conflict scan failed for', filePath, error);
      }
    }

    const items: IdConflictItem[] = Array.from(keyMap.entries())
      .filter(([, files]) => files.size > 1)
      .map(([key, files]) => ({
        key,
        files: Array.from(files).map((filePath) => ({
          path: path.dirname(filePath),
          name: path.basename(filePath),
        })),
      }))
      .sort((a, b) => b.files.length - a.files.length || a.key.localeCompare(b.key));

    return { items, fileCount: packageFiles.length };
  }

  async scanPolycount(rootPath: string): Promise<{ items: PolycountItem[]; fileCount: number }> {
    const packageFiles = await walkPackageFiles(rootPath);
    const items: PolycountItem[] = [];

    for (const filePath of packageFiles) {
      const summary = summarizePack(filePath);
      if (summary) {
        items.push(summary);
      }
    }

    items.sort((a, b) => b.totalFaces - a.totalFaces || b.geometryCount - a.geometryCount || a.name.localeCompare(b.name));

    return { items, fileCount: packageFiles.length };
  }
}

export const advancedToolsService = new AdvancedToolsService();
