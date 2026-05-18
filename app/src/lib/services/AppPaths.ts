'use client';

const APP_DATA_ROOT = 'CC Cafe';
const LEGACY_APP_DATA_ROOT = ['Sims', 'Forge'].join('');

interface FileSystemEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

export async function resolveAppDataRoot(): Promise<string> {
  const appData = await window.electron.ipcRenderer.invoke('path:appDataDir');
  const modernRoot = await window.electron.ipcRenderer.invoke('path:join', appData, APP_DATA_ROOT);
  const legacyRoot = await window.electron.ipcRenderer.invoke('path:join', appData, LEGACY_APP_DATA_ROOT);

  if (await window.electron.ipcRenderer.invoke('fs:exists', modernRoot)) {
    return modernRoot;
  }

  if (await window.electron.ipcRenderer.invoke('fs:exists', legacyRoot)) {
    return legacyRoot;
  }

  await window.electron.ipcRenderer.invoke('fs:mkdir', modernRoot, { recursive: true });
  return modernRoot;
}

export async function resolveAppDataPath(...segments: string[]): Promise<string> {
  const root = await resolveAppDataRoot();
  return window.electron.ipcRenderer.invoke('path:join', root, ...segments);
}

export async function folderContains(folderPath: string, predicate: (entry: FileSystemEntry) => boolean): Promise<boolean> {
  try {
    const entries = (await window.electron.ipcRenderer.invoke('fs:readDir', folderPath)) as FileSystemEntry[];
    return entries.some(predicate);
  } catch {
    return false;
  }
}
