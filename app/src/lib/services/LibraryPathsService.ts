/**
 * Game-mirror library path helpers for CC Cafe.
 *
 * Archive layout:
 *   Mods/CC/<Creator>/[/<Post>/]<file>
 *   Mods/Gameplay Mods/<Author>/[<subfolder>/]<file>
 *   Tray/<file>
 */

import type { CachedModFile } from '@/types/profile';
import { sanitizeDisplayFolderName } from '@/utils/pathSanitizer';

// Resolved from the current user's Documents folder during initialization.
export const DEFAULT_LIBRARY_ROOT = '';

export const TRAY_EXTENSIONS = new Set([
  '.blueprint',
  '.bpi',
  '.hhi',
  '.householdbinary',
  '.rmi',
  '.room',
  '.sgi',
  '.trayitem',
]);

export const SCRIPT_SUPPORT_EXTENSIONS = new Set(['.cfg', '.ini', '.config']);

export type SimsContentBucket = 'cc' | 'gameplay' | 'tray';

export function classifySimsFileName(fileName: string): SimsContentBucket | null {
  const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  if (extension === '.ts4script' || SCRIPT_SUPPORT_EXTENSIONS.has(extension)) {
    return 'gameplay';
  }
  if (extension === '.package') {
    return 'cc';
  }
  if (TRAY_EXTENSIONS.has(extension)) {
    return 'tray';
  }
  return null;
}

export function isScriptModPackage(
  fileName: string,
  relativePath: string,
  files: CachedModFile[]
): boolean {
  const directory = relativePath.includes('/')
    ? relativePath.slice(0, relativePath.lastIndexOf('/'))
    : relativePath.includes('\\')
      ? relativePath.slice(0, relativePath.lastIndexOf('\\'))
      : '';

  const scriptsInDirectory = files.filter((file) =>
    file.fileName.toLowerCase().endsWith('.ts4script')
    && directoryPath(file.relativePath) === directory
  );

  if (scriptsInDirectory.length === 0) {
    return files.some((file) => {
      if (!file.fileName.toLowerCase().endsWith('.ts4script')) {
        return false;
      }
      return pathsShareModTree(relativePath, file.relativePath);
    });
  }

  const stem = fileName.replace(/\.package$/i, '').toLowerCase();
  if (scriptsInDirectory.some((file) => file.fileName.replace(/\.ts4script$/i, '').toLowerCase() === stem)) {
    return true;
  }

  const simsFilesInDirectory = files.filter((file) => {
    if (directoryPath(file.relativePath) !== directory) {
      return false;
    }
    return classifySimsFileName(file.fileName) !== null;
  });

  return simsFilesInDirectory.length <= 12;
}

function directoryPath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(0, index) : '';
}

function pathsShareModTree(left: string, right: string): boolean {
  const leftDir = directoryPath(left);
  const rightDir = directoryPath(right);
  return (
    leftDir === rightDir
    || leftDir.startsWith(`${rightDir}/`)
    || rightDir.startsWith(`${leftDir}/`)
  );
}

export function shouldUsePostFolder(files: CachedModFile[]): boolean {
  const simsFiles = files.filter((file) => classifySimsFileName(file.fileName));
  const hasTray = simsFiles.some((file) => classifySimsFileName(file.fileName) === 'tray');
  return simsFiles.length > 1 || hasTray;
}

export async function resolveLibraryDestination(
  libraryRoot: string,
  creatorName: string,
  modName: string,
  file: CachedModFile,
  allFiles: CachedModFile[]
): Promise<string> {
  const creator = sanitizeDisplayFolderName(creatorName || modName, 'Unknown Creator');
  const postFolder = sanitizeDisplayFolderName(modName, 'Unnamed Item');
  let bucket = classifySimsFileName(file.fileName);

  if (bucket === 'cc' && isScriptModPackage(file.fileName, file.relativePath, allFiles)) {
    bucket = 'gameplay';
  }

  if (!bucket) {
    throw new Error(`Unsupported Sims file type: ${file.fileName}`);
  }

  if (bucket === 'tray') {
    return await window.electron.ipcRenderer.invoke('path:join', libraryRoot, 'Tray', file.fileName);
  }

  if (bucket === 'gameplay') {
    const relative = file.relativePath.replace(/\\/g, '/');
    const parts = relative.split('/').filter(Boolean);
    return await window.electron.ipcRenderer.invoke(
      'path:join',
      libraryRoot,
      'Mods',
      'Gameplay Mods',
      creator,
      ...parts
    );
  }

  if (shouldUsePostFolder(allFiles)) {
    return await window.electron.ipcRenderer.invoke(
      'path:join',
      libraryRoot,
      'Mods',
      'CC',
      creator,
      postFolder,
      file.fileName
    );
  }

  return await window.electron.ipcRenderer.invoke(
    'path:join',
    libraryRoot,
    'Mods',
    'CC',
    creator,
    file.fileName
  );
}

export async function ensureLibraryRoots(libraryRoot: string): Promise<void> {
  for (const relative of ['Mods/CC', 'Mods/Gameplay Mods', 'Tray', 'Documentation']) {
    const target = await window.electron.ipcRenderer.invoke('path:join', libraryRoot, ...relative.split('/'));
    await window.electron.ipcRenderer.invoke('fs:mkdir', target, { recursive: true });
  }
}
