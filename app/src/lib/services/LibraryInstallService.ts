/**
 * Shared game-mirror install helper for CurseForge and local imports.
 */

import type { CachedMod, ProfileMod } from '@/types/profile';
import { modCacheService } from './ModCacheService';
import { symlinkService } from './SymlinkService';
import { userPreferencesService } from './UserPreferencesService';
import { libraryDocumentationService } from './LibraryDocumentationService';
import { sanitizeModName } from '@/utils/pathSanitizer';

export function getModInstallKey(mod: Pick<ProfileMod, 'modId' | 'localModId'>): number | string {
  if (mod.modId !== undefined && mod.modId !== null) {
    return mod.modId;
  }
  if (mod.localModId) {
    return mod.localModId;
  }
  throw new Error('Mod is missing modId and localModId');
}

export async function installCachedModToLibrary(
  mod: ProfileMod,
  cachedMod: CachedMod,
  options: {
    creatorName?: string;
    action?: 'install' | 'update';
  } = {}
): Promise<string[]> {
  await userPreferencesService.initialize();
  const installLayoutMode = userPreferencesService.getInstallLayoutMode();
  if (installLayoutMode !== 'game-mirror' || mod.contentKind === 'save') {
    return mod.libraryPaths || [];
  }

  const libraryRoot = userPreferencesService.getLibraryRoot();
  if (!libraryRoot) {
    throw new Error('Library folder is not configured');
  }

  if (!(await window.electron.ipcRenderer.invoke('fs:exists', libraryRoot))) {
    await window.electron.ipcRenderer.invoke('fs:mkdir', libraryRoot, { recursive: true });
  }

  const cachePath = await modCacheService.getCachePath(cachedMod.fileHash);
  const installResult = await symlinkService.installModToLibrary(libraryRoot, {
    source: cachePath,
    modName: sanitizeModName(mod.modName),
    creatorName: options.creatorName || mod.authors?.[0] || mod.modName,
    installLayoutMode,
    files: cachedMod.files,
    modId: mod.modId,
    localModId: mod.localModId,
    fileHash: cachedMod.fileHash,
  });

  if (!installResult.result.success) {
    console.warn('[LibraryInstallService] Library install errors:', installResult.result.errors);
  }

  mod.libraryPaths = installResult.paths;
  await libraryDocumentationService.appendInstallRecord(
    libraryRoot,
    options.creatorName || mod.authors?.[0] || mod.modName,
    mod,
    options.action || 'install'
  );

  return installResult.paths;
}

export async function removeModFromLibraryIfNeeded(
  mod: Pick<ProfileMod, 'modId' | 'localModId' | 'contentKind'>
): Promise<void> {
  await userPreferencesService.initialize();
  if (userPreferencesService.getInstallLayoutMode() !== 'game-mirror') {
    return;
  }
  if (mod.contentKind === 'save') {
    return;
  }

  const libraryRoot = userPreferencesService.getLibraryRoot();
  if (!libraryRoot) {
    return;
  }

  await symlinkService.removeModFromLibrary(libraryRoot, getModInstallKey(mod));
}
