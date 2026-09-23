import { describe, expect, it } from 'vitest';

const { RIGFile, CLIPFile, IndexEnty, TagType } = require('../../../electron/core2/DBPFReader');

function writeBone(
  buffer: Buffer,
  offset: number,
  bone: {
    name: string;
    position: [number, number, number];
    parent: number;
    hash: number;
  }
): number {
  let o = offset;
  buffer.writeFloatLE(bone.position[0], o);
  buffer.writeFloatLE(bone.position[1], o + 4);
  buffer.writeFloatLE(bone.position[2], o + 8);
  o += 12;
  buffer.writeFloatLE(0, o);
  buffer.writeFloatLE(0, o + 4);
  buffer.writeFloatLE(0, o + 8);
  buffer.writeFloatLE(1, o + 12);
  o += 16;
  buffer.writeFloatLE(1, o);
  buffer.writeFloatLE(1, o + 4);
  buffer.writeFloatLE(1, o + 8);
  o += 12;
  buffer.writeUInt32LE(bone.name.length, o);
  o += 4;
  buffer.write(bone.name, o, 'latin1');
  o += bone.name.length;
  buffer.writeInt32LE(-1, o);
  o += 4;
  buffer.writeInt32LE(bone.parent, o);
  o += 4;
  buffer.writeUInt32LE(bone.hash, o);
  o += 4;
  buffer.writeUInt32LE(0, o);
  o += 4;
  return o;
}

describe('RIG and CLIP parsers', () => {
  it('classifies a rig resource key', () => {
    const entry = new IndexEnty('unused.package', 0x8eaf13de, 0, 0, 1, 0, 0, 0, 0, 0);
    expect(entry.type).toBe(TagType.RIG);
    expect(RIGFile.TYPE).toBe(0x8eaf13de);
    expect(CLIPFile.TYPE).toBe(0x6b20c4f3);
  });

  it('reads a clear-layout rig and the child bone bind position', () => {
    const root = { name: 'b__ROOT__', position: [0, 0, 0] as [number, number, number], parent: -1, hash: 1 };
    const head = { name: 'b__Head__', position: [0, 1.5, 0] as [number, number, number], parent: 0, hash: 2 };
    const buffer = Buffer.alloc(256);
    buffer.writeUInt32LE(3, 0);
    buffer.writeUInt32LE(1, 4);
    buffer.writeUInt32LE(2, 8);
    let offset = 12;
    offset = writeBone(buffer, offset, root);
    offset = writeBone(buffer, offset, head);
    const skeletonName = 'rig';
    buffer.writeUInt32LE(skeletonName.length, offset);
    buffer.write(skeletonName, offset + 4, 'latin1');

    const rig = new RIGFile(buffer.subarray(0, offset + 4 + skeletonName.length));
    expect(rig.error).toBe(false);
    expect(rig.name).toBe('rig');
    expect(rig.bones).toHaveLength(2);
    expect(rig.boneWorldPosition('b__head__')).toEqual([0, 1.5, 0]);
    expect(rig.boneWorldPosition('missing')).toEqual([0, 0, 0]);
  });

  it('rejects a rig with an unsupported version', () => {
    const buffer = Buffer.alloc(12);
    buffer.writeUInt32LE(1, 0);
    buffer.writeUInt32LE(1, 4);
    buffer.writeUInt32LE(0, 8);
    const rig = new RIGFile(buffer);
    expect(rig.error).toBe(true);
  });

  it('reads a clip header and an empty curve table', () => {
    const name = 'a_idle';
    const rigName = 'adult';
    const header = Buffer.alloc(56 + 4 + name.length + 4 + rigName.length);
    header.writeUInt32LE(2, 0);
    header.writeFloatLE(1.25, 8);
    let o = 56;
    header.writeUInt32LE(name.length, o);
    o += 4;
    header.write(name, o, 'latin1');
    o += name.length;
    header.writeUInt32LE(rigName.length, o);
    o += 4;
    header.write(rigName, o, 'latin1');

    const s3 = Buffer.alloc(64);
    s3.write('_pilC3S_', 0, 'latin1');
    s3.writeFloatLE(1 / 30, 16);
    s3.writeUInt16LE(12, 20);
    s3.writeUInt32LE(0, 24);
    s3.writeUInt32LE(0, 28);
    s3.writeUInt32LE(48, 32);
    s3.writeUInt32LE(48, 36);
    s3.writeUInt32LE(0, 40);
    s3.writeUInt32LE(0, 44);

    const clip = new CLIPFile(Buffer.concat([header, s3]));
    expect(clip.error).toBe(false);
    expect(clip.clipName).toBe('a_idle');
    expect(clip.rigName).toBe('adult');
    expect(clip.frameCount).toBe(12);
    expect(clip.frameDuration).toBeCloseTo(1 / 30);
    expect(clip.isPose).toBe(false);
    expect(clip.toJSON().tracks).toEqual([]);
  });

  it('marks a short clip as a pose', () => {
    const header = Buffer.alloc(64);
    header.writeFloatLE(0.2, 8);
    header.writeUInt32LE(0, 56);
    const s3 = Buffer.alloc(48);
    s3.write('_pilC3S_', 0, 'latin1');
    s3.writeFloatLE(1 / 30, 16);
    const clip = new CLIPFile(Buffer.concat([header, s3]), true);
    expect(clip.error).toBe(false);
    expect(clip.isPose).toBe(true);
  });
});
