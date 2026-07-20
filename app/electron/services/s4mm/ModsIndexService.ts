import fs from 'fs';
import path from 'path';
import { prisma } from '../../db/prisma';
import { walkFiles } from './walkPackages';
import {
  MOD_INDEX_EXTENSIONS,
  calcMfolder,
  classifyModIndexFile,
  fileKindToType,
  joinIndexedFilePath,
  normalizeRootPath,
  shouldFingerprint,
} from './modsIndexUtils';

const { Pack, ImportInfoPack } = require('../../core2/DBPFReader');
const { Fingerprint } = require('../../core2/Fingerprint');

export interface ModsIndexProgress {
  phase: 'scan' | 'index' | 'prune' | 'done';
  current: number;
  total: number;
  fileName?: string;
  message?: string;
}

export interface ModsIndexStatus {
  rootPath: string | null;
  lastRebuildAt: number | null;
  fileCount: number;
  packageCount: number;
  scriptCount: number;
  otherCount: number;
  entryCount: number;
  fingerprintCount: number;
  mergedCount: number;
  caspCount: number;
  isBuilding: boolean;
}

export interface ModsIndexRebuildResult {
  rootPath: string;
  scanned: number;
  upserted: number;
  unchanged: number;
  pruned: number;
  errors: number;
  durationMs: number;
}

export interface IndexedFileRow {
  ino: string;
  path: string;
  name: string;
  type: number;
  fingerprint: number;
  casp: boolean;
  cobj: boolean;
  clip: boolean;
  smod: boolean;
  merged: boolean;
  recolor: boolean;
  xmlTypes: string;
  mtime: number;
  size: number;
}

type ProgressCallback = (progress: ModsIndexProgress) => void;

const META_ROOT = 'rootPath';
const META_LAST_REBUILD = 'lastRebuildAt';

/**
 * S4MM-style SQLite mods file index.
 *
 * Scans the Mods folder, fingerprints files, classifies packages via
 * ImportInfoPack, and stores resource TGI addresses so tools can query an
 * index instead of rescanning every package on each run.
 */
export class ModsIndexService {
  private building = false;
  private abortRequested = false;

  isBuilding(): boolean {
    return this.building;
  }

  requestAbort(): void {
    this.abortRequested = true;
  }

  async getStatus(): Promise<ModsIndexStatus> {
    const [rootPath, lastRebuildAt, fileCount, packageCount, scriptCount, otherCount, entryCount, fingerprintCount, mergedCount, caspCount] =
      await Promise.all([
        this.getMeta(META_ROOT),
        this.getMeta(META_LAST_REBUILD),
        prisma.modIndexFile.count(),
        prisma.modIndexFile.count({ where: { type: 1 } }),
        prisma.modIndexFile.count({ where: { type: 2 } }),
        prisma.modIndexFile.count({ where: { type: 3 } }),
        prisma.modIndexEntry.count(),
        prisma.modIndexFile.count({ where: { fingerprint: { gt: 0 } } }),
        prisma.modIndexFile.count({ where: { merged: true } }),
        prisma.modIndexFile.count({ where: { casp: true } }),
      ]);

    return {
      rootPath,
      lastRebuildAt: lastRebuildAt ? Number(lastRebuildAt) : null,
      fileCount,
      packageCount,
      scriptCount,
      otherCount,
      entryCount,
      fingerprintCount,
      mergedCount,
      caspCount,
      isBuilding: this.building,
    };
  }

  /** True when the index was built for this mods root and has at least one file. */
  async covers(rootPath: string): Promise<boolean> {
    const normalized = normalizeRootPath(rootPath);
    const status = await this.getStatus();
    return Boolean(status.rootPath && normalizeRootPath(status.rootPath) === normalized && status.fileCount > 0);
  }

  async clear(): Promise<void> {
    await prisma.modIndexEntry.deleteMany();
    await prisma.modIndexFile.deleteMany();
    await prisma.modIndexMeta.deleteMany();
  }

  /**
   * Incremental sync: skip files whose inode + mtime + size are unchanged.
   * Pass full=true to clear and rebuild from scratch.
   */
  async rebuild(
    rootPath: string,
    options: { full?: boolean; onProgress?: ProgressCallback } = {}
  ): Promise<ModsIndexRebuildResult> {
    if (this.building) {
      throw new Error('Mods index rebuild is already in progress');
    }

    const normalizedRoot = normalizeRootPath(rootPath);
    if (!fs.existsSync(normalizedRoot)) {
      throw new Error(`Mods folder not found: ${normalizedRoot}`);
    }

    this.building = true;
    this.abortRequested = false;
    const started = Date.now();
    const onProgress = options.onProgress;
    let upserted = 0;
    let unchanged = 0;
    let pruned = 0;
    let errors = 0;

    try {
      if (options.full) {
        onProgress?.({ phase: 'scan', current: 0, total: 0, message: 'Clearing existing index…' });
        await this.clear();
      }

      onProgress?.({ phase: 'scan', current: 0, total: 0, message: 'Scanning mods folder…' });
      const files = await walkFiles(normalizedRoot, MOD_INDEX_EXTENSIONS);
      const total = files.length;
      const seenInos = new Set<string>();
      const lastCheck = Date.now();

      const existingRows = await prisma.modIndexFile.findMany({
        where: { rootPath: normalizedRoot },
        select: { ino: true, path: true, name: true, mfolder: true, mtime: true, size: true, type: true },
      });
      const existingByIno = new Map(existingRows.map((row) => [row.ino, row]));

      for (let i = 0; i < files.length; i++) {
        if (this.abortRequested) {
          throw new Error('Mods index rebuild was cancelled');
        }

        const filePath = files[i];
        const fileName = path.basename(filePath);
        onProgress?.({
          phase: 'index',
          current: i + 1,
          total,
          fileName,
          message: `Indexing ${i + 1}/${total}`,
        });

        try {
          const kind = classifyModIndexFile(fileName);
          if (!kind) continue;

          const statsBig = fs.statSync(filePath, { bigint: true });
          const stats = fs.statSync(filePath);
          const ino = statsBig.ino.toString();
          seenInos.add(ino);

          const dirPath = path.dirname(filePath);
          const mfolder = calcMfolder(normalizedRoot, dirPath);
          const mtime = Math.floor(stats.mtimeMs / 1000);
          const size = stats.size;
          const existing = existingByIno.get(ino);

          if (
            existing &&
            existing.mtime === mtime &&
            existing.size === size &&
            existing.path === dirPath &&
            existing.name === fileName &&
            existing.mfolder === mfolder
          ) {
            await prisma.modIndexFile.update({
              where: { ino },
              data: { lastCheck },
            });
            unchanged += 1;
            continue;
          }

          // Path/name-only move: update metadata without re-parsing package contents.
          if (existing && existing.mtime === mtime && existing.size === size && existing.type === fileKindToType(kind)) {
            await prisma.modIndexFile.update({
              where: { ino },
              data: {
                path: dirPath,
                name: fileName,
                mfolder,
                rootPath: normalizedRoot,
                lastCheck,
              },
            });
            upserted += 1;
            continue;
          }

          await this.indexFile({
            filePath,
            fileName,
            dirPath,
            mfolder,
            kind,
            ino,
            mtime,
            size,
            lastCheck,
            rootPath: normalizedRoot,
          });
          upserted += 1;
        } catch (error) {
          errors += 1;
          console.error('[ModsIndexService] Failed to index', filePath, error);
        }
      }

      onProgress?.({ phase: 'prune', current: total, total, message: 'Pruning deleted files…' });
      const stale = await prisma.modIndexFile.findMany({
        where: { rootPath: normalizedRoot },
        select: { ino: true },
      });
      const staleInos = stale.map((row) => row.ino).filter((ino) => !seenInos.has(ino));
      if (staleInos.length > 0) {
        // Entries cascade-delete with the file row.
        const result = await prisma.modIndexFile.deleteMany({
          where: { ino: { in: staleInos } },
        });
        pruned = result.count;
      }

      // Drop rows from a previous mods root if the user switched folders.
      await prisma.modIndexFile.deleteMany({
        where: { rootPath: { not: normalizedRoot } },
      });

      await this.setMeta(META_ROOT, normalizedRoot);
      await this.setMeta(META_LAST_REBUILD, String(Date.now()));

      onProgress?.({
        phase: 'done',
        current: total,
        total,
        message: `Indexed ${upserted} files (${unchanged} unchanged, ${pruned} pruned)`,
      });

      return {
        rootPath: normalizedRoot,
        scanned: total,
        upserted,
        unchanged,
        pruned,
        errors,
        durationMs: Date.now() - started,
      };
    } finally {
      this.building = false;
      this.abortRequested = false;
    }
  }

  async listFingerprintedFiles(rootPath: string): Promise<{ path: string; name: string; fingerprint: number }[] | null> {
    if (!(await this.covers(rootPath))) return null;
    const rows = await prisma.modIndexFile.findMany({
      where: { rootPath: normalizeRootPath(rootPath), fingerprint: { gt: 0 } },
      select: { path: true, name: true, fingerprint: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => ({
      path: row.path,
      name: row.name,
      fingerprint: row.fingerprint,
    }));
  }

  async listMergedPackagePaths(rootPath: string): Promise<string[] | null> {
    if (!(await this.covers(rootPath))) return null;
    const rows = await prisma.modIndexFile.findMany({
      where: { rootPath: normalizeRootPath(rootPath), type: 1, merged: true },
      select: { path: true, name: true },
    });
    return rows.map((row) => joinIndexedFilePath(row.path, row.name));
  }

  async listCaspPackagePaths(rootPath: string): Promise<string[] | null> {
    if (!(await this.covers(rootPath))) return null;
    const rows = await prisma.modIndexFile.findMany({
      where: { rootPath: normalizeRootPath(rootPath), type: 1, casp: true },
      select: { path: true, name: true },
    });
    return rows.map((row) => joinIndexedFilePath(row.path, row.name));
  }

  async listPackagePathsWithResourceType(rootPath: string, resourceType: number): Promise<string[] | null> {
    if (!(await this.covers(rootPath))) return null;
    const rows = await prisma.modIndexEntry.findMany({
      where: {
        type: resourceType,
        file: { rootPath: normalizeRootPath(rootPath), type: 1 },
      },
      select: { file: { select: { path: true, name: true } } },
      distinct: ['ino'],
    });
    return rows.map((row) => joinIndexedFilePath(row.file.path, row.file.name));
  }

  async getAllAddresses(rootPath: string): Promise<Set<string> | null> {
    if (!(await this.covers(rootPath))) return null;
    const rows = await prisma.modIndexEntry.findMany({
      where: { file: { rootPath: normalizeRootPath(rootPath) } },
      select: { address: true },
    });
    return new Set(rows.map((row) => row.address.toLowerCase()));
  }

  async listIndexedFiles(rootPath: string, filter?: { type?: number; casp?: boolean; merged?: boolean }): Promise<IndexedFileRow[] | null> {
    if (!(await this.covers(rootPath))) return null;
    return prisma.modIndexFile.findMany({
      where: {
        rootPath: normalizeRootPath(rootPath),
        ...(filter?.type !== undefined ? { type: filter.type } : {}),
        ...(filter?.casp !== undefined ? { casp: filter.casp } : {}),
        ...(filter?.merged !== undefined ? { merged: filter.merged } : {}),
      },
      select: {
        ino: true,
        path: true,
        name: true,
        type: true,
        fingerprint: true,
        casp: true,
        cobj: true,
        clip: true,
        smod: true,
        merged: true,
        recolor: true,
        xmlTypes: true,
        mtime: true,
        size: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  private async indexFile(args: {
    filePath: string;
    fileName: string;
    dirPath: string;
    mfolder: string;
    kind: 'package' | 'script' | 'other';
    ino: string;
    mtime: number;
    size: number;
    lastCheck: number;
    rootPath: string;
  }): Promise<void> {
    let fingerprint = -1;
    if (shouldFingerprint(args.size, args.fileName)) {
      try {
        const value = Fingerprint.computeFile(args.filePath);
        if (typeof value === 'number' && Number.isFinite(value)) {
          fingerprint = value;
        }
      } catch (error) {
        console.error('[ModsIndexService] Fingerprint failed', args.filePath, error);
      }
    }

    const base = {
      rootPath: args.rootPath,
      path: args.dirPath,
      mfolder: args.mfolder,
      name: args.fileName,
      type: fileKindToType(args.kind),
      minor: -1,
      major: -1,
      casp: false,
      cobj: false,
      clip: false,
      smod: false,
      xmlTypes: '',
      merged: false,
      recolor: false,
      fingerprint,
      mtime: args.mtime,
      size: args.size,
      lastCheck: args.lastCheck,
    };

    let entries: {
      type: number;
      group: number;
      instance: string;
      instanceHex: string;
      address: string;
    }[] = [];

    if (args.kind === 'package') {
      try {
        const pack = new Pack(args.filePath);
        pack.checkFile();
        if (!pack.error) {
          base.minor = typeof pack.minor === 'number' ? pack.minor : -1;
          base.major = typeof pack.major === 'number' ? pack.major : -1;

          const iip = new ImportInfoPack(pack);
          iip.analyze();

          base.casp = Boolean(iip.includesCasp);
          base.cobj = Boolean(iip.includesCobj);
          base.clip = Boolean(iip.includesClip);
          base.smod = Boolean(iip.includesSmod);
          base.merged = Boolean(iip.isMerged || pack.isS4SMerged);
          base.recolor = Boolean(iip.isRecolor);

          if (iip.includesXml) {
            try {
              pack.calculateXMLFiles();
              base.xmlTypes = pack.xmlResource?.cTypesCombinedString ?? '';
            } catch {
              // XML parse failures are non-fatal for indexing.
            }
          }

          entries = (iip.resourcenList ?? []).map((item: any) => ({
            type: Number(item.type) || 0,
            group: Number(item.group) || 0,
            instance: String(item.instance ?? ''),
            instanceHex: String(item.instanceHex ?? ''),
            address: String(item.address ?? ''),
          }));
        }
      } catch (error) {
        console.error('[ModsIndexService] Package analyze failed', args.filePath, error);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.modIndexEntry.deleteMany({ where: { ino: args.ino } });
      await tx.modIndexFile.upsert({
        where: { ino: args.ino },
        create: { ino: args.ino, ...base },
        update: base,
      });
      if (entries.length > 0) {
        await tx.modIndexEntry.createMany({
          data: entries.map((entry) => ({
            ino: args.ino,
            ...entry,
          })),
        });
      }
    });
  }

  private async getMeta(key: string): Promise<string | null> {
    const row = await prisma.modIndexMeta.findUnique({ where: { key } });
    return row?.value ?? null;
  }

  private async setMeta(key: string, value: string): Promise<void> {
    await prisma.modIndexMeta.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }
}

export const modsIndexService = new ModsIndexService();
