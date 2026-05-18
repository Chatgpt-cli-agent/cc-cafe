import { sims4PathDetector } from '@/lib/services/Sims4PathDetector';
import simsPackCatalog from '@/data/sims-packs.json';
import { getCompatStorageItem, setCompatStorageItem } from '@/lib/utils/storageCompat';

export interface DisablePackItem {
  name: string;
  value: string;
}

export interface DisablePackGroup {
  id: number;
  name: string;
  items: DisablePackItem[];
}

export const DISABLE_PACKS_SELECTION_KEY = 'cccafe_disablepacks_selection';

const PACK_ROOT_PREFIX = /^(EP|GP|SP)\d+$/i;

class DisablePacksService {
  getCatalog(): DisablePackGroup[] {
    return simsPackCatalog as DisablePackGroup[];
  }

  buildLaunchArguments(packCodes: string[]): string {
    const uniqueCodes = Array.from(new Set(packCodes.map((code) => code.trim().toUpperCase()).filter(Boolean)));
    return uniqueCodes.length > 0 ? `-disablepacks:${uniqueCodes.join(',')}` : '';
  }

  buildUserSettingsLine(packCodes: string[]): string {
    const uniqueCodes = Array.from(new Set(packCodes.map((code) => code.trim().toUpperCase()).filter(Boolean)));
    return `packstoskipmount = ${uniqueCodes.join(',')}`;
  }

  async getUserSettingsPath(): Promise<string | null> {
    const { modsPath } = await sims4PathDetector.getPaths();
    let baseFolder: string | null = null;

    if (modsPath) {
      baseFolder = await window.electron.ipcRenderer.invoke('path:join', modsPath, '..');
    } else {
      const documentsDir = await window.electron.ipcRenderer.invoke('path:documentDir');
      baseFolder = await window.electron.ipcRenderer.invoke(
        'path:join',
        documentsDir,
        'Electronic Arts',
        'The Sims 4'
      );
    }

    if (!baseFolder) {
      return null;
    }

    const candidates = [
      await window.electron.ipcRenderer.invoke('path:join', baseFolder, 'UserSettings.ini'),
      await window.electron.ipcRenderer.invoke('path:join', baseFolder, 'UserSetting.ini'),
      await window.electron.ipcRenderer.invoke('path:join', baseFolder, 'UserSettings(.ini)'),
    ];

    for (const candidate of candidates) {
      if (await window.electron.ipcRenderer.invoke('fs:exists', candidate)) {
        return candidate;
      }
    }

    return candidates[0];
  }

  async writeUserSettings(packCodes: string[]): Promise<{ path: string; line: string }> {
    const userSettingsPath = await this.getUserSettingsPath();
    if (!userSettingsPath) {
      throw new Error('Could not determine the Sims 4 UserSettings.ini path.');
    }

    const line = this.buildUserSettingsLine(packCodes);
    const existing = (await window.electron.ipcRenderer.invoke('fs:exists', userSettingsPath))
      ? await window.electron.ipcRenderer.invoke('fs:readTextFile', userSettingsPath)
      : '';

    const nextContent = this.replacePackSkipLine(existing || '', line);
    await window.electron.ipcRenderer.invoke('fs:writeFile', userSettingsPath, nextContent);

    return { path: userSettingsPath, line };
  }

  async getInstalledPackCodes(): Promise<Set<string>> {
    const { gamePath } = await sims4PathDetector.getPaths();
    if (!gamePath) {
      return new Set();
    }

    const rootPath = await this.resolveGameRoot(gamePath);
    if (!rootPath) {
      return new Set();
    }

    try {
      const entries = await window.electron.ipcRenderer.invoke('fs:readDir', rootPath);
      return new Set(
        entries
          .filter((entry: { isDirectory: boolean; name: string }) => entry.isDirectory && PACK_ROOT_PREFIX.test(entry.name))
          .map((entry: { name: string }) => entry.name.toUpperCase())
      );
    } catch (error) {
      console.error('[DisablePacksService] Failed to read pack folders:', error);
      return new Set();
    }
  }

  private async resolveGameRoot(gamePath: string): Promise<string | null> {
    const candidates = this.buildCandidates(gamePath);

    for (const candidate of candidates) {
      try {
        const entries = await window.electron.ipcRenderer.invoke('fs:readDir', candidate);
        if (entries.some((entry: { isDirectory: boolean; name: string }) => entry.isDirectory && PACK_ROOT_PREFIX.test(entry.name))) {
          return candidate;
        }
      } catch {
        // Ignore missing paths and keep walking up the tree.
      }
    }

    return null;
  }

  private replacePackSkipLine(existingContent: string, nextLine: string): string {
    const normalized = existingContent.replace(/\r\n/g, '\n');
    const lines = normalized.length > 0 ? normalized.split('\n') : [];
    const output: string[] = [];
    let replaced = false;

    for (const line of lines) {
      if (/^\s*packstoskipmount\s*=/i.test(line)) {
        output.push(nextLine);
        replaced = true;
      } else {
        output.push(line);
      }
    }

    if (!replaced) {
      if (output.length > 0 && output[output.length - 1].trim() !== '') {
        output.push('');
      }
      output.push(nextLine);
    }

    return output.join('\r\n');
  }

  private buildCandidates(gamePath: string): string[] {
    const normalized = gamePath.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    const candidates: string[] = [];

    for (let depth = 0; depth <= 3; depth++) {
      if (parts.length <= depth) {
        break;
      }
      const candidate = parts.slice(0, parts.length - depth).join('/');
      if (candidate && !candidates.includes(candidate)) {
        candidates.push(candidate);
      }
    }

    return candidates.map((candidate) => candidate.replace(/\//g, '\\'));
  }
}

export const disablePacksService = new DisablePacksService();
