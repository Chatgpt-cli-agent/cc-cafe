import fs from 'fs';
import os from 'os';
import path from 'path';

const { Pack, ImportInfoPack, COBJPack, GEOMFile, REL2File, LRLEFile } = require('../../core2/DBPFReader');
const { DSTResource, DDSConverter } = require('../../core2/DDSUtil');

const GEOM_TYPE_PREFIX = '015a1849';

export interface CasSwatchInfo {
  propId: string;
  instance: string;
  swatch: string;
  age: string;
  gender: string;
  body: string;
  lodLevels: { level: number; list: string[] }[];
  diffuseAddress: any;
}

export interface CasItemsResult {
  filePath: string;
  swatches: CasSwatchInfo[];
  cobjGroups: any[];
}

export interface ModelChunk {
  vertex: Record<string, number>[];
  faces: number[][];
}

export interface ModelResult {
  models: { address: string; data: ModelChunk[] }[];
  missingAddresses: string[];
}

export interface TextureResult {
  address: string;
  dataUrl: string | null;
}

/**
 * Port of the S4MM 2.0 3D object viewer backend
 * (controllers/objectviewer.controller.js), rekeyed by file path instead of
 * the S4MM database ino. Extracts CAS/COBJ swatch metadata, GEOM mesh data
 * for rendering, and decodes RLE2/LRLE/DDS textures to PNG.
 */
export class ObjectViewerService {
  getCasItems(filePath: string): CasItemsResult {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const pack = new Pack(filePath);
    pack.checkFile();
    if (pack.error) {
      throw new Error(`Unable to read package: ${filePath}`);
    }
    pack.calculateIndexList();

    const result: CasItemsResult = { filePath, swatches: [], cobjGroups: [] };

    const iip = new ImportInfoPack(pack);
    iip.analyze();
    for (const casp of iip.caspFiles ?? []) {
      try {
        const swatch = casp.getSwatchValues();
        result.swatches.push(swatch);
      } catch (error) {
        console.error('[ObjectViewerService] Failed to read CASP swatch:', error);
      }
    }

    try {
      const cobjPack = new COBJPack(pack);
      const groups = cobjPack.getModelFileGroups();
      if (Array.isArray(groups)) {
        result.cobjGroups = groups;
      }
    } catch {
      // Packages without COBJ content are fine.
    }

    return result;
  }

  getModels(filePath: string, addresses: string[]): ModelResult {
    if (!Array.isArray(addresses) || addresses.length === 0) {
      throw new Error('Addresses must be a non-empty array');
    }
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const wanted = new Set(addresses.map((address) => address.toLowerCase()));
    const models: { address: string; data: ModelChunk[] }[] = [];

    const pack = new Pack(filePath);
    pack.checkFile();
    if (pack.error) {
      throw new Error(`Unable to read package: ${filePath}`);
    }
    pack.calculateIndexList();

    for (const entry of pack.index_List || []) {
      const key = String(entry.getKey()).toLowerCase();
      if (!wanted.has(key)) continue;
      if (!key.startsWith(GEOM_TYPE_PREFIX)) continue;

      try {
        const geom = new GEOMFile(entry.getByteArray());
        if (!geom.error) {
          models.push({ address: key, data: geom.chunks });
          wanted.delete(key);
        }
      } catch (error) {
        console.error('[ObjectViewerService] Failed to parse GEOM', key, error);
      }
    }

    return { models, missingAddresses: Array.from(wanted) };
  }

  async extractTexture(filePath: string, address: string): Promise<TextureResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const pack = new Pack(filePath);
    pack.checkFile();
    if (pack.error) {
      throw new Error(`Unable to read package: ${filePath}`);
    }
    pack.calculateIndexList();

    let entry = (pack.index_List || []).find(
      (candidate: any) => String(candidate.getKey()).toLowerCase() === address.toLowerCase()
    );

    // RLE2 textures are sometimes stored as LRLE under the same group/instance.
    if (!entry && address.toLowerCase().startsWith('3453cf95')) {
      const fallback = address.toLowerCase().replace('3453cf95', '2bc04edf');
      entry = (pack.index_List || []).find(
        (candidate: any) => String(candidate.getKey()).toLowerCase() === fallback
      );
    }

    if (!entry) {
      return { address, dataUrl: null };
    }

    const tmpFolder = path.join(os.tmpdir(), 'cc-cafe-objectviewer');
    fs.mkdirSync(tmpFolder, { recursive: true });
    const texturePath = path.join(tmpFolder, `texture_${Date.now()}.png`);

    try {
      if (entry.r_type === 0x3453cf95) {
        const rle2 = new REL2File(entry.getByteArray());
        await rle2.toPNG(texturePath);
      } else if (entry.r_type === 0x2bc04edf) {
        const lrle = new LRLEFile(entry.getByteArray());
        await lrle.exportImage(texturePath, true);
      } else if (entry.r_type === 0x00b2d882) {
        const dst = new DSTResource(entry.getByteArray());
        const ddsBuffer = dst.toDDSBuffer();
        const pngBuffer = await DDSConverter.ddsBufferToPngBuffer(ddsBuffer);
        if (pngBuffer) fs.writeFileSync(texturePath, pngBuffer);
      } else {
        throw new Error(`Unsupported texture type: ${entry.r_type}`);
      }

      if (fs.existsSync(texturePath)) {
        const dataUrl = `data:image/png;base64,${fs.readFileSync(texturePath).toString('base64')}`;
        fs.rmSync(texturePath, { force: true });
        return { address, dataUrl };
      }
    } catch (error) {
      console.error('[ObjectViewerService] Texture extraction failed:', error);
      fs.rmSync(texturePath, { force: true });
    }

    return { address, dataUrl: null };
  }
}

export const objectViewerService = new ObjectViewerService();
