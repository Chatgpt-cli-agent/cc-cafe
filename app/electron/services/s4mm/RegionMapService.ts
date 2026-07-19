import path from 'path';
import { walkPackageFiles } from './walkPackages';

const { Pack } = require('../../core2/DBPFReader');
const { RMAPUtils } = require('../../core2/RegionMapCalulations');

const RMAP_TYPE = 0xac16fbec;

export interface RegionBounds {
  x?: { min: number; max: number };
  y?: { min: number; max: number };
  z?: { min: number; max: number };
}

export interface RegionTypeCheck {
  type: number;
  bounds: RegionBounds;
}

export interface RegionMapIssue {
  meshkey: string;
  region: number;
  extremPoints: any;
}

export interface RegionMapItem {
  path: string;
  name: string;
  issues: RegionMapIssue[];
}

export interface RegionMapScanResult {
  files: { path: string; name: string }[];
  fileCount: number;
}

export interface RegionMapProcessResult {
  items: RegionMapItem[];
}

export interface RegionMapOptions {
  compareAgainstBase?: boolean;
  ignoreSmallMeshes?: number;
}

/**
 * Port of the S4MM 2.0 region map checker (tools/rmap.tool.js +
 * tools/RegionMapCalulations.js). Finds CAS packages whose meshes exceed the
 * expected bounds of the body region they are mapped to (e.g. shoes that
 * deform the whole leg). Runs in-process instead of the S4MM worker pool.
 */
export class RegionMapService {
  async findFilesWithRegionMaps(rootPath: string): Promise<RegionMapScanResult> {
    const packageFiles = await walkPackageFiles(rootPath);
    const files: { path: string; name: string }[] = [];

    for (const filePath of packageFiles) {
      try {
        const pack = new Pack(filePath);
        pack.checkFile();
        if (pack.error) continue;
        pack.calculateIndexList();

        const hasRmap = (pack.index_List || []).some((entry: any) => entry.r_type === RMAP_TYPE);
        if (hasRmap) {
          files.push({ path: path.dirname(filePath), name: path.basename(filePath) });
        }
      } catch (error) {
        console.error('[RegionMapService] Failed to scan', filePath, error);
      }
    }

    return { files, fileCount: packageFiles.length };
  }

  processFiles(
    files: { path: string; name: string }[],
    types: RegionTypeCheck[],
    options?: RegionMapOptions
  ): RegionMapProcessResult {
    const resolvedOptions = {
      compareAgainstBase: options?.compareAgainstBase ?? false,
      ignoreSmallMeshes: options?.ignoreSmallMeshes ?? 0,
    };

    const items: RegionMapItem[] = [];

    for (const file of files) {
      const filePath = path.join(file.path, file.name);
      try {
        const result = RMAPUtils.checkFile(filePath, types, resolvedOptions);
        if (result && result.items?.length > 0) {
          items.push({
            path: file.path,
            name: file.name,
            issues: result.items,
          });
        }
      } catch (error) {
        console.error('[RegionMapService] Failed to process', filePath, error);
      }
    }

    return { items };
  }
}

export const regionMapService = new RegionMapService();
