import path from 'path';
import { walkPackageFiles } from './walkPackages';

const { Pack, LRLEFile, REL2File } = require('../../core2/DBPFReader');

export const TEXTURE_TYPE_IMG = 0x00b2d882;
export const TEXTURE_TYPE_LRLE = 0x2bc04edf;
export const TEXTURE_TYPE_RLE2 = 0x3453cf95;

export interface TextureInfo {
  key: string;
  width: number | null;
  height: number | null;
  success: boolean;
}

export interface HqTextureItem {
  path: string;
  name: string;
  textures: TextureInfo[];
  maxWidth: number;
  maxHeight: number;
}

export interface HqTextureScanResult {
  items: HqTextureItem[];
  fileCount: number;
}

/**
 * Port of the S4MM 2.0 HQ textures tool (tools/hqtextures.tool.js). Reads the
 * dimensions of LRLE/RLE2 texture resources inside package files so oversized
 * ("HQ") textures can be identified. Runs in-process instead of using the
 * S4MM worker window pool.
 */
export class HqTexturesService {
  async scan(rootPath: string, types?: number[]): Promise<HqTextureScanResult> {
    const wantedTypes = types && types.length > 0 ? types : [TEXTURE_TYPE_LRLE, TEXTURE_TYPE_RLE2];
    const packageFiles = await walkPackageFiles(rootPath);
    const items: HqTextureItem[] = [];

    for (const filePath of packageFiles) {
      const textures = this.readTextures(filePath, wantedTypes);
      if (textures.length === 0) continue;

      let maxWidth = 0;
      let maxHeight = 0;
      for (const texture of textures) {
        if (texture.width && texture.width > maxWidth) maxWidth = texture.width;
        if (texture.height && texture.height > maxHeight) maxHeight = texture.height;
      }

      items.push({
        path: path.dirname(filePath),
        name: path.basename(filePath),
        textures,
        maxWidth,
        maxHeight,
      });
    }

    items.sort((a, b) => b.maxWidth * b.maxHeight - a.maxWidth * a.maxHeight || a.name.localeCompare(b.name));

    return { items, fileCount: packageFiles.length };
  }

  private readTextures(filePath: string, types: number[]): TextureInfo[] {
    const textures: TextureInfo[] = [];

    try {
      const pack = new Pack(filePath);
      pack.checkFile();
      if (pack.error) return textures;
      pack.calculateIndexList();

      for (const entry of pack.index_List || []) {
        if (!types.includes(entry.r_type)) continue;

        if (entry.r_type === TEXTURE_TYPE_LRLE) {
          textures.push(this.readLrle(entry));
        } else if (entry.r_type === TEXTURE_TYPE_RLE2) {
          textures.push(this.readRle2(entry));
        }
      }
    } catch (error) {
      console.error('[HqTexturesService] Failed to scan', filePath, error);
    }

    return textures;
  }

  private readLrle(entry: any): TextureInfo {
    try {
      const lrle = new LRLEFile(entry.getByteArray());
      if (lrle.width && lrle.height) {
        return { key: entry.getKey(), width: lrle.width, height: lrle.height, success: true };
      }
    } catch (error) {
      console.error('[HqTexturesService] LRLE read failed:', error);
    }
    return { key: entry.getKey(), width: null, height: null, success: false };
  }

  private readRle2(entry: any): TextureInfo {
    try {
      const rle2 = new REL2File(entry.getByteArray());
      // The S4MM reader spells the RLE2 height field "hight".
      if (rle2.width && rle2.hight) {
        return { key: entry.getKey(), width: rle2.width, height: rle2.hight, success: true };
      }
    } catch (error) {
      console.error('[HqTexturesService] RLE2 read failed:', error);
    }
    return { key: entry.getKey(), width: null, height: null, success: false };
  }
}

export const hqTexturesService = new HqTexturesService();
