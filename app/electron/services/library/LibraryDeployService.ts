import fs from 'fs/promises';
import path from 'path';

export interface LibraryDeployRequest {
  libraryRoot: string;
  modsPath: string;
  trayPath: string;
}

export interface LibraryDeployResult {
  success: boolean;
  copied: number;
  conflicts: number;
  messages: string[];
}

async function copyTreeNoClobber(
  sourceDir: string,
  destDir: string,
  label: string
): Promise<{ copied: number; conflicts: number; messages: string[] }> {
  const messages: string[] = [];
  let copied = 0;
  let conflicts = 0;

  try {
    await fs.access(sourceDir);
  } catch {
    messages.push(`Skipping missing ${label} source: ${sourceDir}`);
    return { copied, conflicts, messages };
  }

  await fs.mkdir(destDir, { recursive: true });

  async function walk(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const sourcePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(sourcePath);
        continue;
      }
      const relative = path.relative(sourceDir, sourcePath);
      const target = path.join(destDir, relative);
      await fs.mkdir(path.dirname(target), { recursive: true });
      try {
        await fs.access(target);
        conflicts += 1;
        messages.push(`CONFLICT [${label}]: ${relative} already exists in game folder`);
      } catch {
        await fs.copyFile(sourcePath, target);
        copied += 1;
      }
    }
  }

  await walk(sourceDir);
  messages.push(`${label}: copied ${copied} file(s), skipped existing ${conflicts} file(s)`);
  return { copied, conflicts, messages };
}

async function flattenGameplayMods(
  sourceRoot: string,
  destRoot: string
): Promise<{ copied: number; conflicts: number; messages: string[] }> {
  const messages: string[] = [];
  let copied = 0;
  let conflicts = 0;

  try {
    await fs.access(sourceRoot);
  } catch {
    messages.push(`Skipping missing Gameplay Mods source: ${sourceRoot}`);
    return { copied, conflicts, messages };
  }

  await fs.mkdir(destRoot, { recursive: true });

  async function walk(current: string, depth: number): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const sourcePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(sourcePath, depth + 1);
        continue;
      }
      if (depth < 1) {
        continue;
      }
      const target = path.join(destRoot, entry.name);
      try {
        await fs.access(target);
        conflicts += 1;
        messages.push(`CONFLICT [Gameplay Mods]: ${entry.name} already exists in game folder`);
      } catch {
        await fs.copyFile(sourcePath, target);
        copied += 1;
      }
    }
  }

  await walk(sourceRoot, 0);
  messages.push(`Gameplay Mods: copied ${copied} file(s), skipped existing ${conflicts} file(s)`);
  return { copied, conflicts, messages };
}

export async function deployLibraryToGame(
  request: LibraryDeployRequest
): Promise<LibraryDeployResult> {
  const { libraryRoot, modsPath, trayPath } = request;
  await fs.access(libraryRoot);

  const cc = await copyTreeNoClobber(
    path.join(libraryRoot, 'Mods', 'CC'),
    path.join(modsPath, 'CC'),
    'CC'
  );
  const tray = await copyTreeNoClobber(
    path.join(libraryRoot, 'Tray'),
    trayPath,
    'Tray'
  );
  const gameplay = await flattenGameplayMods(
    path.join(libraryRoot, 'Mods', 'Gameplay Mods'),
    path.join(modsPath, 'Gameplay Mods')
  );

  const copied = cc.copied + tray.copied + gameplay.copied;
  const conflicts = cc.conflicts + tray.conflicts + gameplay.conflicts;

  return {
    success: true,
    copied,
    conflicts,
    messages: [...cc.messages, ...tray.messages, ...gameplay.messages, 'Deploy complete.'],
  };
}
