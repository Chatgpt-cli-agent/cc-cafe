import fs from 'fs';
import path from 'path';
import { walkPackageFiles } from './walkPackages';

const { Pack, ImportInfoPack, PosePackHelper } = require('../../core2/DBPFReader');

export interface PosePackInfo {
  displayName: string;
  description: string;
}

export interface PackageInspection {
  path: string;
  name: string;
  resourceCount: number;
  includesCasp: boolean;
  includesCobj: boolean;
  includesClip: boolean;
  includesXml: boolean;
  includesGeom: boolean;
  isMerged: boolean;
  isRecolor: boolean;
  posePacks: PosePackInfo[];
  xmlTypes: string;
}

export interface PackageInspectScanResult {
  items: PackageInspection[];
  fileCount: number;
}

/**
 * Exposes the S4MM 2.0 package classification pipeline (ImportInfoPack,
 * Pack.calculateXMLFiles, PosePackHelper) so CC Café can categorize packages
 * the same way S4MM does: CAS parts, build/buy objects, animations, tuning
 * (XML) mods, recolors, merged files, and pose packs.
 */
export class PackageInspectService {
  async inspectFile(filePath: string): Promise<PackageInspection | null> {
    if (!fs.existsSync(filePath)) return null;

    try {
      const pack = new Pack(filePath);
      pack.checkFile();
      if (pack.error) return null;
      pack.calculateIndexList();

      const iip = new ImportInfoPack(pack);
      iip.analyze();

      let xmlTypes = '';
      try {
        pack.calculateXMLFiles();
        xmlTypes = pack.xmlResource?.cTypesCombinedString ?? '';
      } catch {
        // XML parsing failures are non-fatal.
      }

      const posePacks: PosePackInfo[] = [];
      try {
        const packs = await PosePackHelper.getPosePacksFromFile(filePath);
        for (const posePack of packs ?? []) {
          const instance = posePack?.posePackInstance;
          if (instance) {
            posePacks.push({
              displayName: String(instance.displayName ?? ''),
              description: String(instance.description ?? ''),
            });
          }
        }
      } catch {
        // Pose detection is best-effort.
      }

      return {
        path: path.dirname(filePath),
        name: path.basename(filePath),
        resourceCount: pack.index_List?.length ?? 0,
        includesCasp: Boolean(iip.includesCasp),
        includesCobj: Boolean(iip.includesCobj),
        includesClip: Boolean(iip.includesClip),
        includesXml: Boolean(iip.includesXml),
        includesGeom: Boolean(iip.includesGeom),
        isMerged: Boolean(iip.isMerged || pack.isS4SMerged),
        isRecolor: Boolean(iip.isRecolor),
        posePacks,
        xmlTypes,
      };
    } catch (error) {
      console.error('[PackageInspectService] Failed to inspect', filePath, error);
      return null;
    }
  }

  async scanFolder(rootPath: string): Promise<PackageInspectScanResult> {
    const packageFiles = await walkPackageFiles(rootPath);
    const items: PackageInspection[] = [];

    for (const filePath of packageFiles) {
      const inspection = await this.inspectFile(filePath);
      if (inspection) items.push(inspection);
    }

    return { items, fileCount: packageFiles.length };
  }
}

export const packageInspectService = new PackageInspectService();
