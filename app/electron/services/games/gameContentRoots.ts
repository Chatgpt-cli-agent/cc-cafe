import path from 'path';

const INZOI_LEAF_NAMES = new Set(['mods', 'canvas', 'creations', 'my3dprinter']);

export function defaultInzoiRoot(home: string): string {
  return path.join(home, 'Documents', 'inZOI');
}

export function defaultParalivesRoots(home: string): string[] {
  return [
    path.join(home, '.config', 'unity3d', 'Paralives', 'Paralives'),
    path.join(home, '.local', 'share', 'Paralives', 'Paralives'),
    path.join(home, 'AppData', 'LocalLow', 'Paralives', 'Paralives'),
  ];
}

/**
 * A chosen inZOI folder is either the Documents/inZOI root, or one leaf
 * such as Mods or My3DPrinter. A leaf is scanned as-is.
 */
export function inzoiScanRoots(contentRoot: string): string[] {
  const leaf = path.basename(contentRoot).toLowerCase();
  if (INZOI_LEAF_NAMES.has(leaf)) return [contentRoot];
  return [
    path.join(contentRoot, 'Mods'),
    path.join(contentRoot, 'Canvas'),
    path.join(contentRoot, 'Creations'),
    path.join(contentRoot, 'AIGenerated', 'My3DPrinter'),
  ];
}

export function sanitizeContentRoot(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('\0') || trimmed.length > 4096) return undefined;
  if (!path.isAbsolute(trimmed)) return undefined;
  return trimmed;
}

export function scanRoots(gameId: string, home: string, override?: string): string[] {
  const custom = sanitizeContentRoot(override);
  if (gameId === 'inzoi') {
    return inzoiScanRoots(custom || defaultInzoiRoot(home));
  }
  if (gameId === 'paralives') {
    return custom ? [custom] : defaultParalivesRoots(home);
  }
  return [];
}
