import { app } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { walkPackageFiles } from './walkPackages';

const { Pack, ImportInfoPack, COBJPack, GEOMFile, REL2File, LRLEFile, CLIPFile, RIGFile, TagType } = require('../../core2/DBPFReader');
const { DSTResource, DDSConverter } = require('../../core2/DDSUtil');

const RIG_MIN_BONES = 60;
const RIG_ADULT_HEAD_HEIGHT = 1.674;
const RIG_MATCH_MIN_SCORE = 0.5;

const CAS_BODY_PARTS: { name: string; key: string }[] = [
  { name: 'woman_adult_upper_body', key: '015a1849-00e2bf6e-e29b147e75b6208d' },
  { name: 'woman_adult_lower_body', key: '015a1849-000ca85a-562009b9d4fbc1c2' },
  { name: 'woman_adult_head', key: '015a1849-00d1b738-3e68f8b6f44da2aa' },
  { name: 'woman_adult_feet', key: '015a1849-00e7c7da-c8a0134251653019' },
  { name: 'teeth_adult', key: '015a1849-00a0e127-670f265f9b24e9db' },
  { name: 'man_adult_upper_body', key: '015a1849-00cfd5c4-facb14f02cd72951' },
  { name: 'man_adult_lower_body', key: '015a1849-0006dfa8-2edd43b93759561f' },
  { name: 'man_adult_head', key: '015a1849-00954737-c7b7131033261079' },
  { name: 'man_adult_feet', key: '015a1849-009c671e-7d8d53bd26112391' },
];

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

export interface ClipSummary {
  address: string;
  name: string;
  rigName: string;
  sourceName: string;
  duration: number;
  frameCount: number;
  isPose: boolean;
}

export interface ClipTrackFrame {
  frame: number;
  values: number[];
}

export interface ClipTrack {
  key: number;
  position?: ClipTrackFrame[];
  orientation?: ClipTrackFrame[];
}

export interface ClipPayload {
  version: number;
  duration: number;
  clipName: string;
  rigName: string;
  sourceName: string;
  frameDuration: number;
  frameCount: number;
  isPose: boolean;
  tracks: ClipTrack[];
}

export interface RigBone {
  name: string;
  hash: number;
  parent: number;
  opposing: number;
  flags: number;
  position: number[];
  orientation: number[];
  scale: number[];
}

export interface RigPayload {
  address: string;
  name: string;
  file: string;
  bones: RigBone[];
  headHeight: number;
}

export interface ClipDetail {
  clip: ClipPayload;
  rig: RigPayload | null;
  rigScore: number;
  rigCount: number;
}

export interface BodyVertex {
  p?: number[];
  n?: number[];
  u?: number[];
  b?: number[];
  w?: number[];
}

export interface BodyChunk {
  vertex: BodyVertex[];
  faces: number[][];
  boneHashes: number[];
}

export interface BodyPartMesh {
  name: string;
  key: string;
  chunks: BodyChunk[];
}

/**
 * Port of the S4MM 2.0 3D object viewer backend
 * (controllers/objectviewer.controller.js), rekeyed by file path instead of
 * the S4MM database ino. Extracts CAS/COBJ swatch metadata, GEOM mesh data
 * for rendering, and decodes RLE2/LRLE/DDS textures to PNG.
 */
export class ObjectViewerService {
  private gameRigs: RigPayload[] | null = null;
  private gameRigsPath: string | null = null;
  private bodyParts: BodyPartMesh[] | null = null;
  private bodyPartsPath: string | null = null;

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

  listClips(filePath: string): ClipSummary[] {
    const pack = this.openPack(filePath);
    const clips: ClipSummary[] = [];

    for (const entry of pack.index_List || []) {
      if (entry.type !== TagType.CLIP) continue;
      const clip = new CLIPFile(entry.getByteArray(), true);
      if (clip.error) continue;
      clips.push({
        address: String(entry.getKey()).toLowerCase(),
        name: clip.clipName,
        rigName: clip.rigName,
        sourceName: clip.sourceName,
        duration: clip.duration,
        frameCount: clip.frameCount,
        isPose: clip.isPose,
      });
    }

    clips.sort((a, b) => a.name.localeCompare(b.name));
    return clips;
  }

  async getClip(filePath: string, address: string, gamePath?: string | null): Promise<ClipDetail> {
    const pack = this.openPack(filePath);
    const wanted = address.toLowerCase();
    const entry = (pack.index_List || []).find(
      (candidate: any) => String(candidate.getKey()).toLowerCase() === wanted
    );
    if (!entry || entry.type !== TagType.CLIP) {
      throw new Error(`Animation clip ${address} was not found in this package.`);
    }

    const clip = new CLIPFile(entry.getByteArray());
    if (clip.error) {
      throw new Error('This animation clip could not be parsed.');
    }

    const { rigs, best, bestScore } = await this.selectRig(clip, gamePath);
    return {
      clip: clip.toJSON(),
      rig: bestScore >= RIG_MATCH_MIN_SCORE ? best : null,
      rigScore: bestScore,
      rigCount: rigs.length,
    };
  }

  async getBodyParts(gamePath?: string | null): Promise<BodyPartMesh[]> {
    if (!gamePath) return [];
    if (this.bodyParts && this.bodyPartsPath === gamePath) return this.bodyParts;

    const cacheFile = path.join(app.getPath('userData'), 'rigs', 'cas-body-parts.json');
    try {
      if (fs.existsSync(cacheFile)) {
        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        const usable =
          cached?.gamePath === gamePath &&
          Array.isArray(cached.parts) &&
          cached.parts.length > 0 &&
          cached.parts.every((part: BodyPartMesh) => part.chunks?.every((chunk) => Array.isArray(chunk.boneHashes) && chunk.boneHashes.length > 0));
        if (usable) {
          this.bodyParts = cached.parts;
          this.bodyPartsPath = gamePath;
          return cached.parts;
        }
      }
    } catch {
      // A bad cache is ignored and rebuilt.
    }

    const wanted = new Map(CAS_BODY_PARTS.map((part) => [part.key, part.name]));
    const parts: BodyPartMesh[] = [];
    const primary = findClientDeltaBuild(gamePath);
    const packagePaths = primary ? [primary] : [];
    const clientDir = primary ? path.dirname(primary) : clientPackageRoots(gamePath)[0];
    if (clientDir && fs.existsSync(clientDir)) {
      for (const file of await walkPackageFiles(clientDir)) {
        if (!packagePaths.includes(file)) packagePaths.push(file);
      }
    }

    for (const packagePath of packagePaths) {
      if (wanted.size === 0) break;
      parts.push(...readBodyParts(packagePath, wanted));
    }

    this.bodyParts = parts;
    this.bodyPartsPath = gamePath;
    if (parts.length > 0) {
      fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify({ gamePath, parts }));
    }
    return parts;
  }

  private openPack(filePath: string) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const pack = new Pack(filePath);
    pack.checkFile();
    if (pack.error) {
      throw new Error(`Unable to read package: ${filePath}`);
    }
    pack.calculateIndexList();
    return pack;
  }

  private async selectRig(clip: { tracks: Map<number, unknown> }, gamePath?: string | null) {
    const rigs = await this.getGameRigs(gamePath);
    const keys = Array.from(clip.tracks.keys());
    const adultDistance = (rig: RigPayload) => Math.abs((rig.headHeight || 0) - RIG_ADULT_HEAD_HEIGHT);
    let best: RigPayload | null = null;
    let bestScore = -1;

    for (const rig of rigs) {
      const hashes = new Set(rig.bones.map((bone) => bone.hash));
      const covered = keys.filter((key) => hashes.has(key)).length;
      const score = keys.length === 0 ? 0 : covered / keys.length;
      const better =
        score > bestScore ||
        (score === bestScore &&
          best != null &&
          (adultDistance(rig) < adultDistance(best) - 0.01 ||
            (Math.abs(adultDistance(rig) - adultDistance(best)) <= 0.01 && rig.bones.length < best.bones.length)));
      if (better) {
        best = rig;
        bestScore = score;
      }
    }

    return { rigs, best, bestScore };
  }

  private async getGameRigs(gamePath?: string | null): Promise<RigPayload[]> {
    if (!gamePath) return [];
    if (this.gameRigs && this.gameRigsPath === gamePath) return this.gameRigs;

    const cacheFile = path.join(app.getPath('userData'), 'rigs', 'game-rigs.json');
    try {
      if (fs.existsSync(cacheFile)) {
        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        if (cached?.gamePath === gamePath && Array.isArray(cached.rigs) && cached.rigs.every((rig: RigPayload) => typeof rig.headHeight === 'number')) {
          this.gameRigs = cached.rigs;
          this.gameRigsPath = gamePath;
          return cached.rigs;
        }
      }
    } catch {
      // A bad cache is ignored and rebuilt.
    }

    const roots = clientPackageRoots(gamePath);
    const files: string[] = [];
    for (const root of roots) {
      files.push(...(await walkPackageFiles(root)));
    }

    const rigs: RigPayload[] = [];
    for (const file of files) {
      try {
        const pack = new Pack(file);
        pack.checkFile();
        if (pack.error) continue;
        pack.calculateIndexList();
        for (const entry of pack.index_List || []) {
          if (entry.type !== TagType.RIG && entry.r_type !== RIGFile.TYPE) continue;
          const rig = new RIGFile(entry.getByteArray());
          if (rig.error || rig.bones.length < RIG_MIN_BONES) continue;
          rigs.push({
            address: String(entry.getKey()).toLowerCase(),
            name: rig.name,
            file: path.basename(file),
            bones: rig.bones,
            headHeight: rig.boneWorldPosition('b__head__')[1],
          });
        }
      } catch {
        // One unreadable game package should not fail the scan.
      }
    }

    this.gameRigs = rigs;
    this.gameRigsPath = gamePath;
    if (rigs.length > 0) {
      fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify({ gamePath, rigs }));
    }
    return rigs;
  }
}

function findClientDeltaBuild(gamePath: string): string | null {
  const installRoot = gamePath.toLowerCase().endsWith('.exe')
    ? path.dirname(path.dirname(path.dirname(gamePath)))
    : gamePath;
  const candidates = [
    path.join(installRoot, 'Data', 'Client', 'ClientDeltaBuild0.package'),
    path.join(installRoot, 'ClientDeltaBuild0.package'),
    path.join(installRoot, '..', 'Data', 'Client', 'ClientDeltaBuild0.package'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function readBodyParts(packagePath: string, wanted: Map<string, string>): BodyPartMesh[] {
  const found: BodyPartMesh[] = [];
  try {
    const pack = new Pack(packagePath);
    pack.checkFile();
    if (pack.error) return found;
    pack.calculateIndexList();
    for (const [key, name] of Array.from(wanted.entries())) {
      const entry = pack.getEntryIfExistsByKey(key);
      if (!entry) continue;
      const geom = new GEOMFile(entry.getByteArray());
      if (geom.error || !Array.isArray(geom.chunks) || geom.chunks.length === 0) continue;
      const chunks = geom.chunks
        .map((chunk: any) => ({
          vertex: (chunk.vertex || []).map((vertex: any) => ({
            p: vertex.p,
            n: vertex.n,
            u: vertex.u,
            b: vertex.b,
            w: vertex.w,
          })),
          faces: chunk.faces,
          boneHashes: Array.isArray(chunk.boneHashes) ? chunk.boneHashes : [],
        }))
        .filter((chunk: BodyChunk) => chunk.boneHashes.length > 0);
      if (chunks.length === 0) continue;
      found.push({ name, key, chunks });
      wanted.delete(key);
    }
  } catch {
    // One unreadable game package should not fail the body load.
  }
  return found;
}

function clientPackageRoots(gamePath: string): string[] {
  const installRoot = gamePath.toLowerCase().endsWith('.exe')
    ? path.dirname(path.dirname(path.dirname(gamePath)))
    : gamePath;
  const candidates = [
    path.join(installRoot, 'Data', 'Client'),
    path.join(installRoot, 'Delta'),
    path.join(installRoot, '..', 'Data', 'Client'),
    path.join(installRoot, '..', 'Delta'),
  ];
  return Array.from(new Set(candidates.filter((candidate) => fs.existsSync(candidate))));
}

export const objectViewerService = new ObjectViewerService();
