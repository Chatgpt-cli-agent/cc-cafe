import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { sanitizeContentRoot, scanRoots } from './gameContentRoots';

export type GameContentKind = 'modkit' | 'pak' | 'canvas' | 'mod-folder' | 'printer' | 'package';

export interface GameContentItem {
  name: string;
  path: string;
  kind: GameContentKind;
}

export interface GameContentScan {
  gameId: string;
  roots: string[];
  items: GameContentItem[];
}

export interface GameContentRoots {
  roots: string[];
  existing: string[];
}

const MAX_DEPTH = 5;
const MAX_ITEMS = 400;
const PAK_EXTENSIONS = new Set(['.pak', '.utoc', '.ucas']);
const PACKAGE_EXTENSIONS = new Set(['.package', '.ts4script']);

function rootsFor(gameId: string, contentRoot?: string): string[] {
  return scanRoots(gameId, os.homedir(), sanitizeContentRoot(contentRoot));
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function hasFile(dir: string, fileName: string): Promise<boolean> {
  try {
    await fs.access(path.join(dir, fileName));
    return true;
  } catch {
    return false;
  }
}

async function hasDatFile(dir: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dir);
    return entries.some((name) => name.toLowerCase().endsWith('.dat'));
  } catch {
    return false;
  }
}

/**
 * Lists installed inZOI and Paralives content. Sims 4 keeps its own package scan.
 */
export class GameContentService {
  async roots(gameId: string, contentRoot?: string): Promise<GameContentRoots> {
    const roots = rootsFor(gameId, contentRoot);
    const existing: string[] = [];
    for (const root of roots) {
      if (await exists(root)) existing.push(root);
    }
    return { roots, existing };
  }

  async scan(gameId: string, contentRoot?: string): Promise<GameContentScan> {
    const roots = rootsFor(gameId, contentRoot);
    const items: GameContentItem[] = [];
    const presentRoots: string[] = [];

    for (const root of roots) {
      if (!(await exists(root))) continue;
      presentRoots.push(root);
      await this.walk(gameId, root, root, 0, items);
    }

    return { gameId, roots: presentRoots.length > 0 ? presentRoots : roots, items };
  }

  private async walk(
    gameId: string,
    root: string,
    current: string,
    depth: number,
    items: GameContentItem[]
  ): Promise<void> {
    if (items.length >= MAX_ITEMS || depth > MAX_DEPTH) return;

    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (items.length >= MAX_ITEMS) return;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        const classified = await this.classifyDirectory(gameId, root, fullPath, entry.name);
        if (classified) {
          items.push(classified);
          continue;
        }
        await this.walk(gameId, root, fullPath, depth + 1, items);
        continue;
      }
      if (!entry.isFile() || gameId !== 'inzoi') continue;
      const extension = path.extname(entry.name).toLowerCase();
      if (PAK_EXTENSIONS.has(extension)) {
        items.push({ name: entry.name, path: fullPath, kind: 'pak' });
      } else if (PACKAGE_EXTENSIONS.has(extension)) {
        items.push({ name: entry.name, path: fullPath, kind: 'package' });
      }
    }
  }

  private async classifyDirectory(
    gameId: string,
    root: string,
    fullPath: string,
    name: string
  ): Promise<GameContentItem | null> {
    if (gameId === 'paralives' && name.toLowerCase().endsWith('.mod') && name.toLowerCase() !== 'local.mod') {
      return { name, path: fullPath, kind: 'mod-folder' };
    }
    if (gameId !== 'inzoi') return null;
    if (await hasFile(fullPath, 'mod_manifest.json')) {
      return { name, path: fullPath, kind: 'modkit' };
    }
    const printer = await this.readPrinterFolder(fullPath, name);
    if (printer) return printer;
    const relative = path.relative(root, fullPath);
    const inCanvas = root.includes(`${path.sep}Canvas`) || relative.toLowerCase().includes('canvas');
    if (inCanvas && (await hasDatFile(fullPath))) {
      return { name, path: fullPath, kind: 'canvas' };
    }
    return null;
  }

  private async readPrinterFolder(fullPath: string, folderName: string): Promise<GameContentItem | null> {
    if (!(await hasFile(fullPath, 'meta.json'))) return null;
    let names: string[] = [];
    try {
      names = await fs.readdir(fullPath);
    } catch {
      return null;
    }
    if (!names.some((entry) => entry.toLowerCase().endsWith('.glb'))) return null;
    let title = folderName;
    try {
      const meta = JSON.parse(await fs.readFile(path.join(fullPath, 'meta.json'), 'utf8')) as { Title?: string };
      if (meta.Title) title = String(meta.Title);
    } catch {
      // A folder with meta.json and a model is still a printer item.
    }
    return { name: title, path: fullPath, kind: 'printer' };
  }
}

export const gameContentService = new GameContentService();
