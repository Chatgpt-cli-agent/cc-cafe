/**
 * User Preferences Service
 *
 * Manages user preferences for mod management including auto-updates
 * and backup settings. Persists preferences to localStorage with encryption.
 */

import type { SupportedLanguage } from '@/context/LanguageContext';
import { getCompatStorageItem, setCompatStorageItem } from '@/lib/utils/storageCompat';
import type { InstallLayoutMode } from '@/types/profile';
import { DEFAULT_LIBRARY_ROOT } from '@/lib/services/LibraryPathsService';

/**
 * User preferences structure
 */
export interface UserPreferences {
  autoUpdates: boolean;
  backupBeforeUpdate: boolean;
  fakeModDetection: boolean;
  gameLogging: boolean;
  showDebugLogs: boolean;
  installLayoutMode: InstallLayoutMode;
  installLayoutVersion: number;
  libraryRoot: string;
  language: SupportedLanguage | null;
}

/**
 * Default preferences
 */
const DEFAULT_PREFERENCES: UserPreferences = {
  autoUpdates: true,
  backupBeforeUpdate: true,
  fakeModDetection: true,
  gameLogging: true,
  showDebugLogs: false,
  installLayoutMode: 'game-mirror',
  installLayoutVersion: 3,
  libraryRoot: DEFAULT_LIBRARY_ROOT,
  language: null,
};

const STORAGE_KEY = 'cccafe_user_preferences';

/**
 * Service for managing user preferences
 */
export class UserPreferencesService {
  private preferences: UserPreferences = { ...DEFAULT_PREFERENCES };
  private initialized = false;

  /**
   * Initialize and load preferences from storage
   */
  async initialize(): Promise<void> {
    if (this.initialized && this.preferences.libraryRoot && this.preferences.libraryRoot !== '/mnt/San-Myshuno/JDownloader') {
      return;
    }

    try {
      const stored = getCompatStorageItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<UserPreferences>;
        const migratedLayout = parsed.installLayoutVersion === 3
          ? parsed.installLayoutMode
          : parsed.installLayoutVersion === 2
            ? parsed.installLayoutMode
            : parsed.installLayoutMode === 'cc-folder'
              ? 'creator-cc-folder'
              : parsed.installLayoutMode;
        this.preferences = {
          ...DEFAULT_PREFERENCES,
          ...parsed,
          installLayoutMode: migratedLayout || DEFAULT_PREFERENCES.installLayoutMode,
          installLayoutVersion: 3,
          libraryRoot: parsed.libraryRoot || DEFAULT_PREFERENCES.libraryRoot,
        };
      }
      if (!this.preferences.libraryRoot || this.preferences.libraryRoot === '/mnt/San-Myshuno/JDownloader') {
        const documents = await window.electron.ipcRenderer.invoke('path:documentDir');
        if (!documents) throw new Error('Could not locate your Documents folder');
        const libraryRoot = await window.electron.ipcRenderer.invoke('path:join', documents, 'CC Cafe Library');
        await window.electron.ipcRenderer.invoke('fs:mkdir', libraryRoot, { recursive: true });
        this.preferences.libraryRoot = libraryRoot;
        this.savePreferences();
      }
      this.initialized = true;
    } catch (error) {
      console.error('[UserPreferencesService] Failed to load preferences:', error);
      this.preferences = { ...DEFAULT_PREFERENCES };
      this.initialized = true;
    }
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      // Synchronous fallback - try to load from localStorage
      try {
        const stored = getCompatStorageItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<UserPreferences>;
            const migratedLayout = parsed.installLayoutVersion === 3
              ? parsed.installLayoutMode
              : parsed.installLayoutVersion === 2
                ? parsed.installLayoutMode
                : parsed.installLayoutMode === 'cc-folder'
                  ? 'creator-cc-folder'
                  : parsed.installLayoutMode;
            this.preferences = {
              ...DEFAULT_PREFERENCES,
              ...parsed,
              installLayoutMode: migratedLayout || DEFAULT_PREFERENCES.installLayoutMode,
              installLayoutVersion: 3,
              libraryRoot: parsed.libraryRoot || DEFAULT_PREFERENCES.libraryRoot,
            };
        }
        this.initialized = true;
      } catch (error) {
        this.preferences = { ...DEFAULT_PREFERENCES };
        this.initialized = true;
      }
    }
  }

  /**
   * Get all preferences
   */
  getPreferences(): UserPreferences {
    this.ensureInitialized();
    return { ...this.preferences };
  }

  /**
   * Get auto-updates preference
   */
  getAutoUpdates(): boolean {
    this.ensureInitialized();
    return this.preferences.autoUpdates;
  }

  /**
   * Get backup before update preference
   */
  getBackupBeforeUpdate(): boolean {
    this.ensureInitialized();
    return this.preferences.backupBeforeUpdate;
  }

  /**
   * Set auto-updates preference
   */
  setAutoUpdates(enabled: boolean): void {
    this.ensureInitialized();
    this.preferences.autoUpdates = enabled;
    this.savePreferences();
  }

  /**
   * Set backup before update preference
   */
  setBackupBeforeUpdate(enabled: boolean): void {
    this.ensureInitialized();
    this.preferences.backupBeforeUpdate = enabled;
    this.savePreferences();
  }

  /**
   * Get fake mod detection preference
   */
  getFakeModDetection(): boolean {
    this.ensureInitialized();
    return this.preferences.fakeModDetection;
  }

  /**
   * Set fake mod detection preference
   */
  setFakeModDetection(enabled: boolean): void {
    this.ensureInitialized();
    this.preferences.fakeModDetection = enabled;
    this.savePreferences();
  }

  /**
   * Get game logging preference
   */
  getGameLogging(): boolean {
    this.ensureInitialized();
    return this.preferences.gameLogging;
  }

  /**
   * Set game logging preference
   */
  setGameLogging(enabled: boolean): void {
    this.ensureInitialized();
    this.preferences.gameLogging = enabled;
    this.savePreferences();
  }

  /**
   * Get show debug logs preference
   */
  getShowDebugLogs(): boolean {
    this.ensureInitialized();
    return this.preferences.showDebugLogs;
  }

  /**
   * Set show debug logs preference
   */
  setShowDebugLogs(enabled: boolean): void {
    this.ensureInitialized();
    this.preferences.showDebugLogs = enabled;
    this.savePreferences();
  }

  /**
   * Get install layout mode preference
   */
  getInstallLayoutMode(): InstallLayoutMode {
    this.ensureInitialized();
    return this.preferences.installLayoutMode;
  }

  /**
   * Set install layout mode preference
   */
  setInstallLayoutMode(mode: InstallLayoutMode): void {
    this.ensureInitialized();
    this.preferences.installLayoutMode = mode;
    this.savePreferences();
  }

  getLibraryRoot(): string {
    this.ensureInitialized();
    return this.preferences.libraryRoot;
  }

  setLibraryRoot(libraryRoot: string): void {
    this.ensureInitialized();
    this.preferences.libraryRoot = libraryRoot;
    this.savePreferences();
  }

  /**
   * Get language preference
   */
  getLanguage(): SupportedLanguage | null {
    this.ensureInitialized();
    return this.preferences.language;
  }

  /**
   * Set language preference
   */
  setLanguage(language: SupportedLanguage): void {
    this.ensureInitialized();
    this.preferences.language = language;
    this.savePreferences();
  }

  /**
   * Update multiple preferences at once
   */
  updatePreferences(updates: Partial<UserPreferences>): void {
    this.ensureInitialized();
    this.preferences = {
      ...this.preferences,
      ...updates,
    };
    this.savePreferences();
  }

  /**
   * Reset preferences to defaults
   */
  resetToDefaults(): void {
    this.preferences = { ...DEFAULT_PREFERENCES };
    this.savePreferences();
  }

  /**
   * Save preferences to localStorage
   */
  private savePreferences(): void {
    try {
      setCompatStorageItem(STORAGE_KEY, JSON.stringify(this.preferences));
    } catch (error) {
      console.error('[UserPreferencesService] Failed to save preferences:', error);
    }
  }
}

// Export singleton instance
export const userPreferencesService = new UserPreferencesService();
