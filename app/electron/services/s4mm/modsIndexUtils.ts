import path from 'path';

/** Mirrors S4MM Files.type: 1 = package, 2 = script, 3 = other. */
export const MOD_INDEX_FILE_TYPE = {
  PACKAGE: 1,
  SCRIPT: 2,
  OTHER: 3,
} as const;

/** Skip fingerprinting very large files (same threshold as S4MM). */
export const MAX_FINGERPRINT_BYTES = 150_000_000;

const PACKAGE_EXTS = ['.package', '.packageoff'];
const SCRIPT_EXTS = ['.ts4script', '.ts4scriptoff'];
const OTHER_EXTS = ['.zip', '.rar'];

export type ModIndexFileKind = 'package' | 'script' | 'other' | null;

export function classifyModIndexFile(fileName: string): ModIndexFileKind {
  const lower = fileName.toLowerCase();
  if (PACKAGE_EXTS.some((ext) => lower.endsWith(ext))) return 'package';
  if (SCRIPT_EXTS.some((ext) => lower.endsWith(ext))) return 'script';
  if (OTHER_EXTS.some((ext) => lower.endsWith(ext))) return 'other';
  return null;
}

export function fileKindToType(kind: Exclude<ModIndexFileKind, null>): number {
  if (kind === 'package') return MOD_INDEX_FILE_TYPE.PACKAGE;
  if (kind === 'script') return MOD_INDEX_FILE_TYPE.SCRIPT;
  return MOD_INDEX_FILE_TYPE.OTHER;
}

/** Relative folder under the mods root, using forward slashes. */
export function calcMfolder(rootPath: string, fileDir: string): string {
  const relative = path.relative(path.resolve(rootPath), path.resolve(fileDir));
  if (!relative || relative === '.') return '';
  return relative.split(path.sep).join('/');
}

export function shouldFingerprint(sizeBytes: number, fileName: string): boolean {
  if (sizeBytes <= 0 || sizeBytes >= MAX_FINGERPRINT_BYTES) return false;
  if (fileName.toLowerCase() === 'resource.cfg') return false;
  return true;
}

export function normalizeRootPath(rootPath: string): string {
  return path.resolve(rootPath);
}

export function joinIndexedFilePath(dirPath: string, name: string): string {
  return path.join(dirPath, name);
}

/** Extensions walked when building the mods file index. */
export const MOD_INDEX_EXTENSIONS = [
  '.package',
  '.packageoff',
  '.ts4script',
  '.ts4scriptoff',
  '.zip',
  '.rar',
];
