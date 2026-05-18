/**
 * Sims 4 Path Detector
 *
 * Auto-detects Sims 4 installation path and mods folder.
 * First checks user-configured paths in localStorage, then falls back to auto-detection.
 * Supports multiple installation locations (Origin, Steam, EA App).
 */

import { Sims4Paths, Sims4PathValidation } from '@/types/profile';
import { getCompatStorageItem } from '@/lib/utils/storageCompat';

export class Sims4PathDetector {
  /**
   * Helper to decrypt data stored in localStorage
   */
  private async decryptData(encryptedData: string, password: string = 'cccafe-settings'): Promise<string | null> {
    try {
      const encoder = new TextEncoder();
      const password_encoded = encoder.encode(password);

      // Create a hash of the password
      const hash_buffer = await crypto.subtle.digest('SHA-256', password_encoded);
      const key = await crypto.subtle.importKey('raw', hash_buffer, 'AES-GCM', false, ['decrypt']);

      // Decode from base64
      const binaryString = atob(encryptedData);
      const combined = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        combined[i] = binaryString.charCodeAt(i);
      }

      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);

      // Decrypt
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encrypted
      );
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      return null;
    }
  }

  /**
   * Get paths from localStorage first, then fall back to auto-detection
   */
  async getPaths(): Promise<Sims4Paths> {
    let gamePath: string | null = null;
    let modsPath: string | null = null;

    // Try to load from localStorage (user-configured paths from Settings)
    if (typeof window !== 'undefined') {
      const encryptedGamePath = getCompatStorageItem('cccafe_game_path');
      if (encryptedGamePath) {
        gamePath = await this.decryptData(encryptedGamePath);
      }

      const encryptedModsPath = getCompatStorageItem('cccafe_mods_path');
      if (encryptedModsPath) {
        modsPath = await this.decryptData(encryptedModsPath);
      }
    }

    // If paths found in localStorage, validate and return them
    if (gamePath || modsPath) {
      return { gamePath, modsPath };
    }

    // Fall back to auto-detection if not configured
    gamePath = await this.detectGamePath();
    modsPath = await this.detectModsPath();

    return { gamePath, modsPath };
  }

  /**
   * Detect Sims 4 installation paths (game and mods folder)
   * @deprecated Use getPaths() instead, which checks localStorage first
   */
  async detectPaths(): Promise<Sims4Paths> {
    return this.getPaths();
  }

  /**
   * Detect game executable path across common installation locations
   */
  private async detectGamePath(): Promise<string | null> {
    // Common installation paths for Windows
    const commonPaths = [
      'C:\\Program Files\\EA Games\\The Sims 4\\Game\\Bin\\TS4_x64.exe',
      'C:\\Program Files (x86)\\Origin Games\\The Sims 4\\Game\\Bin\\TS4_x64.exe',
      'C:\\Program Files (x86)\\Steam\\steamapps\\common\\The Sims 4\\Game\\Bin\\TS4_x64.exe',
      'D:\\Origin Games\\The Sims 4\\Game\\Bin\\TS4_x64.exe',
      'E:\\Origin Games\\The Sims 4\\Game\\Bin\\TS4_x64.exe',
      'C:\\Games\\The Sims 4\\Game\\Bin\\TS4_x64.exe', // Custom install
    ];

    for (const path of commonPaths) {
      if (await window.electron.ipcRenderer.invoke('fs:exists', path)) {
        return path;
      }
    }

    const registryGamePath = await this.detectGamePathFromRegistry();
    if (registryGamePath) {
      return registryGamePath;
    }

    return null;
  }

  /**
   * Detect game path using common Windows registry keys
   */
  private async detectGamePathFromRegistry(): Promise<string | null> {
    const registryKeys = [
      'HKLM:\\SOFTWARE\\EA Games\\The Sims 4',
      'HKLM:\\SOFTWARE\\WOW6432Node\\EA Games\\The Sims 4',
      'HKLM:\\SOFTWARE\\Maxis\\The Sims 4',
      'HKLM:\\SOFTWARE\\WOW6432Node\\Maxis\\The Sims 4',
      'HKCU:\\SOFTWARE\\EA Games\\The Sims 4',
      'HKCU:\\SOFTWARE\\WOW6432Node\\EA Games\\The Sims 4',
    ];

    const registryValues = ['Install Dir', 'InstallDir', 'InstallLocation', 'ExePath', 'Path'];

    for (const key of registryKeys) {
      for (const valueName of registryValues) {
        const value = await this.readRegistryValue(key, valueName);
        if (!value) {
          continue;
        }

        const normalized = value.replace(/\\/g, '/');
        const candidate = normalized.toLowerCase().endsWith('.exe')
          ? value
          : await window.electron.ipcRenderer.invoke(
              'path:join',
              value,
              'Game',
              'Bin',
              'TS4_x64.exe'
            );

        if (await window.electron.ipcRenderer.invoke('fs:exists', candidate)) {
          return candidate;
        }
      }
    }

    return null;
  }

  /**
   * Read a registry value using PowerShell.
   */
  private async readRegistryValue(keyPath: string, valueName: string): Promise<string | null> {
    try {
      const command = [
        'powershell',
        '-NoProfile',
        '-Command',
        `try { Get-ItemProperty -Path '${keyPath.replace(/'/g, "''")}' | Select-Object -ExpandProperty '${valueName.replace(/'/g, "''")}' } catch { '' }`,
      ];

      const result = await window.electron.ipcRenderer.invoke('shell:execute', command[0], command.slice(1));
      const output = (result?.stdout || '').toString().trim();
      return output || null;
    } catch (error) {
      console.warn('[Sims4PathDetector] Registry lookup failed:', keyPath, valueName, error);
      return null;
    }
  }

  /**
   * Detect mods folder path (usually in Documents)
   */
  private async detectModsPath(): Promise<string | null> {
    try {
      // Get user's Documents folder
      const documentsDir = await window.electron.ipcRenderer.invoke('path:documentDir');
      const modsPath = await window.electron.ipcRenderer.invoke(
        'path:join',
        documentsDir,
        'Electronic Arts',
        'The Sims 4',
        'Mods'
      );

      if (await window.electron.ipcRenderer.invoke('fs:exists', modsPath)) {
        return modsPath;
      }

      // Try alternative: just "Mods" folder
      const altModsPath = await window.electron.ipcRenderer.invoke(
        'path:join',
        documentsDir,
        'The Sims 4',
        'Mods'
      );

      if (await window.electron.ipcRenderer.invoke('fs:exists', altModsPath)) {
        return altModsPath;
      }
    } catch (error) {
      console.error('Failed to detect mods path:', error);
    }

    return null;
  }

  /**
   * Validate that paths exist and are accessible
   */
  async validatePaths(paths: Sims4Paths): Promise<Sims4PathValidation> {
    const gameValid = paths.gamePath
      ? await window.electron.ipcRenderer.invoke('fs:exists', paths.gamePath)
      : false;
    const modsValid = paths.modsPath
      ? await window.electron.ipcRenderer.invoke('fs:exists', paths.modsPath)
      : false;

    return { gameValid, modsValid };
  }

  /**
   * Get human-readable error messages for missing paths
   */
  getPathErrorMessage(validation: Sims4PathValidation): string {
    if (!validation.gameValid && !validation.modsValid) {
      return 'Could not find The Sims 4 installation or Mods folder. Please install The Sims 4 and run the game once to create the Mods folder.';
    }

    if (!validation.gameValid) {
      return 'Could not find The Sims 4 executable (TS4_x64.exe). Check your installation.';
    }

    if (!validation.modsValid) {
      return 'Could not find the Mods folder. Run The Sims 4 once to create it, or check your Documents\\Electronic Arts\\The Sims 4 folder.';
    }

    return 'Paths are valid.';
  }

  /**
   * Get suggested paths if auto-detection fails
   */
  getSuggestedPaths(): string[] {
    if (typeof window === 'undefined') {
      return [];
    }

    return [
      'C:\\Program Files\\EA Games\\The Sims 4\\Game\\Bin\\TS4_x64.exe',
      'C:\\Program Files (x86)\\Origin Games\\The Sims 4\\Game\\Bin\\TS4_x64.exe',
      'C:\\Program Files (x86)\\Steam\\steamapps\\common\\The Sims 4\\Game\\Bin\\TS4_x64.exe',
    ];
  }
}

// Export singleton instance
export const sims4PathDetector = new Sims4PathDetector();
