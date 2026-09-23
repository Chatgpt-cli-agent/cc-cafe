/**
 * Writes CC Cafe install/update records under Documentation/<Creator>/.
 */

import type { ProfileMod } from '@/types/profile';
import { sanitizeDisplayFolderName } from '@/utils/pathSanitizer';

interface InstallRecord {
  source: 'cc-cafe';
  modId?: number | string;
  localModId?: string;
  modName: string;
  versionId?: number;
  versionNumber?: string;
  fileHash: string;
  libraryPaths?: string[];
  installedAt: string;
  action: 'install' | 'update';
}

export class LibraryDocumentationService {
  async appendInstallRecord(
    libraryRoot: string,
    creatorName: string,
    mod: ProfileMod,
    action: 'install' | 'update' = 'install'
  ): Promise<void> {
    const creator = sanitizeDisplayFolderName(creatorName || mod.modName, 'Unknown Creator');
    const docDir = await window.electron.ipcRenderer.invoke(
      'path:join',
      libraryRoot,
      'Documentation',
      creator
    );
    await window.electron.ipcRenderer.invoke('fs:mkdir', docDir, { recursive: true });

    const docPath = await window.electron.ipcRenderer.invoke(
      'path:join',
      docDir,
      'cc-cafe-installs.json'
    );

    let records: InstallRecord[] = [];
    if (await window.electron.ipcRenderer.invoke('fs:exists', docPath)) {
      try {
        const content = await window.electron.ipcRenderer.invoke('fs:readTextFile', docPath);
        const parsed = JSON.parse(content) as InstallRecord[];
        if (Array.isArray(parsed)) {
          records = parsed;
        }
      } catch {
        records = [];
      }
    }

    records.push({
      source: 'cc-cafe',
      modId: mod.modId,
      localModId: mod.localModId,
      modName: mod.modName,
      versionId: mod.versionId,
      versionNumber: mod.versionNumber,
      fileHash: mod.fileHash,
      libraryPaths: mod.libraryPaths,
      installedAt: new Date().toISOString(),
      action,
    });

    await window.electron.ipcRenderer.invoke(
      'fs:writeFile',
      docPath,
      JSON.stringify(records, null, 2)
    );
  }
}

export const libraryDocumentationService = new LibraryDocumentationService();
