import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';

const APP_DATA_ROOT = 'CC Cafe';
const LEGACY_APP_DATA_ROOT = ['Sims', 'Forge'].join('');

export async function resolveAppDataRoot(): Promise<string> {
  const userData = app.getPath('userData');
  const modernRoot = path.join(userData, APP_DATA_ROOT);
  const legacyRoot = path.join(userData, LEGACY_APP_DATA_ROOT);

  if (await exists(modernRoot)) {
    return modernRoot;
  }

  if (await exists(legacyRoot)) {
    return legacyRoot;
  }

  await fs.mkdir(modernRoot, { recursive: true });
  return modernRoot;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
