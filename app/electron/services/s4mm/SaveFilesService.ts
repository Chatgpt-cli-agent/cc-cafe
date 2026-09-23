import fs from 'fs';
import os from 'os';
import path from 'path';

const { SaveDataReader } = require('../../core2/SaveDataReader');

export interface SaveFileInfo {
  path: string;
  name: string;
  slotName: string | null;
  size: number;
  modifiedAt: number;
}

export interface SaveFilesListResult {
  savesPath: string;
  items: SaveFileInfo[];
}

export interface SaveDataSummary {
  slotName: string | null;
  slotId: string | null;
  householdCount: number;
  simCount: number;
  simNames: string[];
}

/**
 * Port of the S4MM 2.0 save file reader (sims/SaveDataReader.js +
 * controllers/saveFiles.controller.js). Decodes The Sims 4 save files with
 * the EA protobuf schema to expose slot names and household/sim data.
 */
export class SaveFilesService {
  getDefaultSavesPath(): string {
    return path.join(os.homedir(), 'Documents', 'Electronic Arts', 'The Sims 4', 'saves');
  }

  listSaves(savesPath?: string): SaveFilesListResult {
    const resolvedPath = savesPath && savesPath.trim().length > 0 ? savesPath : this.getDefaultSavesPath();
    const items: SaveFileInfo[] = [];

    if (!fs.existsSync(resolvedPath)) {
      return { savesPath: resolvedPath, items };
    }

    const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.save')) continue;

      const filePath = path.join(resolvedPath, entry.name);
      let slotName: string | null = null;
      try {
        slotName = SaveDataReader.getSaveSlotNameFromFile(filePath);
      } catch (error) {
        console.error('[SaveFilesService] Failed to read slot name for', filePath, error);
      }

      try {
        const stats = fs.statSync(filePath);
        items.push({
          path: resolvedPath,
          name: entry.name,
          slotName,
          size: stats.size,
          modifiedAt: stats.mtimeMs,
        });
      } catch {
        // Skip unreadable files.
      }
    }

    items.sort((a, b) => b.modifiedAt - a.modifiedAt);
    return { savesPath: resolvedPath, items };
  }

  readSaveSummary(filePath: string): SaveDataSummary {
    const data = SaveDataReader.getSaveDataObject(filePath);

    const households: any[] = data?.households ?? [];
    const sims: any[] = data?.sims ?? [];
    const simNames = sims
      .map((sim: any) => {
        const first = sim?.attributes?.firstName ?? sim?.firstName ?? '';
        const last = sim?.attributes?.lastName ?? sim?.lastName ?? '';
        return `${first} ${last}`.trim();
      })
      .filter((name: string) => name.length > 0);

    return {
      slotName: data?.saveSlot?.slotName ?? null,
      slotId: data?.saveSlot?.slotId ?? null,
      householdCount: households.length,
      simCount: sims.length,
      simNames,
    };
  }
}

export const saveFilesService = new SaveFilesService();
