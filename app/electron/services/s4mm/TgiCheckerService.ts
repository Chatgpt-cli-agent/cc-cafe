import path from 'path';
import { walkPackageFiles } from './walkPackages';
import { modsIndexService } from './ModsIndexService';

const { Pack } = require('../../core2/DBPFReader');

export interface TgiMissingReference {
  caspInstance: string;
  missingAddresses: string[];
}

export interface TgiCheckItem {
  path: string;
  name: string;
  totalReferences: number;
  missingReferences: number;
  details: TgiMissingReference[];
}

export interface TgiCheckResult {
  items: TgiCheckItem[];
  fileCount: number;
  caspFileCount: number;
}

/**
 * Standalone port of the S4MM 2.0 TGI checker (utils/TGICheck.js +
 * tools/tgichecker.tools.js). When the mods SQLite file index is available,
 * resource addresses and CAS package candidates are loaded from it (like
 * S4MM). Otherwise the mods folder is scanned directly.
 *
 * Note: references satisfied by game packages cannot be verified without the
 * game install, so items resolved only by the game may show as missing. The
 * threshold option mirrors S4MM: 0 = report any missing, 1 = report only
 * fully missing, otherwise the missing ratio must exceed the threshold.
 */
export class TgiCheckerService {
  async check(rootPath: string, threshold = 1): Promise<TgiCheckResult> {
    const indexedAddresses = await modsIndexService.getAllAddresses(rootPath);
    const indexedCaspPaths = await modsIndexService.listCaspPackagePaths(rootPath);

    let knownAddresses: Set<string>;
    let caspSources: { filePath: string; pack: any }[] = [];
    let fileCount: number;

    if (indexedAddresses && indexedCaspPaths) {
      knownAddresses = indexedAddresses;
      fileCount = indexedCaspPaths.length;
      for (const filePath of indexedCaspPaths) {
        try {
          const pack = new Pack(filePath);
          pack.checkFile();
          if (pack.error) continue;
          pack.calculateIndexList();
          caspSources.push({ filePath, pack });
        } catch (error) {
          console.error('[TgiCheckerService] Failed to open indexed CAS package', filePath, error);
        }
      }
    } else {
      const packageFiles = await walkPackageFiles(rootPath);
      fileCount = packageFiles.length;
      knownAddresses = new Set<string>();

      for (const filePath of packageFiles) {
        try {
          const pack = new Pack(filePath);
          pack.checkFile();
          if (pack.error) continue;
          pack.calculateIndexList();

          let hasCasp = false;
          for (const entry of pack.index_List || []) {
            knownAddresses.add(String(entry.getKey()).toLowerCase());
            if (entry.r_type === 0x034aeecb) hasCasp = true;
          }
          if (hasCasp) {
            caspSources.push({ filePath, pack });
          }
        } catch (error) {
          console.error('[TgiCheckerService] Failed to index', filePath, error);
        }
      }
    }

    // Check every CAS part's LOD + diffuse references.
    const items: TgiCheckItem[] = [];
    let caspFileCount = 0;

    for (const { filePath, pack } of caspSources) {
      try {
        pack.calulateCASPFiles();
        const caspFiles = pack.caspResource?.caspFiles ?? [];
        if (caspFiles.length === 0) continue;
        caspFileCount += caspFiles.length;

        let total = 0;
        let missing = 0;
        const details: TgiMissingReference[] = [];

        for (const casp of caspFiles) {
          const reduced = casp.getLodAndDiffuse();
          const referenced: string[] = [];

          for (const lod of reduced.lod ?? []) {
            for (const address of lod.list ?? []) {
              referenced.push(this.normalizeAddress(address));
            }
          }
          if (reduced.diffuse) {
            referenced.push(this.normalizeAddress(reduced.diffuse));
          }

          const missingHere = referenced.filter(
            (address) => address.length > 0 && !knownAddresses.has(address)
          );
          total += referenced.length;
          missing += missingHere.length;

          if (missingHere.length > 0) {
            details.push({
              caspInstance: String(reduced.instance ?? ''),
              missingAddresses: missingHere,
            });
          }
        }

        if (total > 0 && this.isRelevant(threshold, total, missing)) {
          items.push({
            path: path.dirname(filePath),
            name: path.basename(filePath),
            totalReferences: total,
            missingReferences: missing,
            details,
          });
        }
      } catch (error) {
        console.error('[TgiCheckerService] Failed to check', filePath, error);
      }
    }

    items.sort((a, b) => b.missingReferences - a.missingReferences || a.name.localeCompare(b.name));
    return { items, fileCount, caspFileCount };
  }

  private normalizeAddress(address: any): string {
    if (!address) return '';
    if (typeof address === 'string') return address.toLowerCase();
    if (typeof address.key === 'string') return address.key.toLowerCase();
    if (typeof address.getKey === 'function') return String(address.getKey()).toLowerCase();
    if (
      typeof address.type !== 'undefined' &&
      typeof address.group !== 'undefined' &&
      typeof address.instance !== 'undefined'
    ) {
      const type = Number(address.type).toString(16).padStart(8, '0');
      const group = Number(address.group).toString(16).padStart(8, '0');
      const instance = BigInt(address.instance).toString(16).padStart(16, '0');
      return `${type}-${group}-${instance}`.toLowerCase();
    }
    return '';
  }

  private isRelevant(threshold: number, total: number, missing: number): boolean {
    if (threshold === 0) return missing > 0;
    if (threshold === 1) return missing === total;
    return missing / total > threshold;
  }
}

export const tgiCheckerService = new TgiCheckerService();
