import fs from 'fs';
import os from 'os';
import path from 'path';
import { walkPackageFiles } from './walkPackages';
import { modsIndexService } from './ModsIndexService';

const { Pack } = require('../../core2/DBPFReader');
const { PackageOperations } = require('../../core2/PackageOperations');

export interface MergedPackageEntry {
  name: string;
  resources: string[];
}

export interface MergedFileInfo {
  path: string;
  name: string;
  manifestName: string;
  packages: MergedPackageEntry[];
}

export interface MergedScanResult {
  items: MergedFileInfo[];
  fileCount: number;
}

/**
 * Port of the S4MM 2.0 merge tool (tools/merge.tool.js + utils/PackageOperations.js).
 * Inspects Sims 4 Studio style merged packages and supports extracting or
 * removing the original packages contained in them.
 */
export class MergeToolService {
  async scanMergedPackages(rootPath: string): Promise<MergedScanResult> {
    const indexedMerged = await modsIndexService.listMergedPackagePaths(rootPath);
    const packageFiles = indexedMerged ?? (await walkPackageFiles(rootPath));
    const items: MergedFileInfo[] = [];

    for (const filePath of packageFiles) {
      const info = this.inspect(filePath);
      if (info) items.push(info);
    }

    items.sort((a, b) => b.packages.length - a.packages.length || a.name.localeCompare(b.name));
    return { items, fileCount: packageFiles.length };
  }

  inspect(filePath: string): MergedFileInfo | null {
    try {
      const pack = new Pack(filePath);
      pack.checkFile();
      if (pack.error) return null;
      pack.calculateIndexList();
      if (!pack.isS4SMerged) return null;

      const manifest = pack.getS4SMergedManifestComplete();
      const manifestObj = manifest.toObj();

      return {
        path: path.dirname(filePath),
        name: path.basename(filePath),
        manifestName: manifestObj.name ?? '',
        packages: (manifestObj.packages ?? []).map((pkg: any) => ({
          name: pkg.name,
          resources: pkg.resources ?? [],
        })),
      };
    } catch (error) {
      console.error('[MergeToolService] Failed to inspect', filePath, error);
      return null;
    }
  }

  private getTmpMergeFolder(): string {
    const folder = path.join(os.tmpdir(), 'cc-cafe-merge');
    fs.mkdirSync(folder, { recursive: true });
    return folder;
  }

  /** Copies selected packages out of a merged file without modifying it. */
  extractPackages(filePath: string, destination: string, packages: MergedPackageEntry[]): void {
    PackageOperations.copyToFromMerged(filePath, destination, this.getTmpMergeFolder(), packages);
  }

  /** Extracts selected packages and removes them from the merged file. */
  unmergePackages(filePath: string, destination: string, packages: MergedPackageEntry[]): void {
    PackageOperations.removeFromMergedAndCopyTo(filePath, destination, this.getTmpMergeFolder(), packages);
  }

  /** Removes selected packages from a merged file without extracting. */
  removePackages(filePath: string, packages: MergedPackageEntry[]): void {
    PackageOperations.removeFromMerged(filePath, packages);
  }

  /** Extracts every package of a merged file to destination. */
  unmergeAll(filePath: string, destination: string): void {
    PackageOperations.unmergeAllTo(filePath, destination, this.getTmpMergeFolder());
  }
}

export const mergeToolService = new MergeToolService();
