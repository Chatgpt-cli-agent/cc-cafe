import path from 'path';
import { describe, expect, it } from 'vitest';
import { inzoiScanRoots, sanitizeContentRoot, scanRoots } from '@/lib/gameContentRoots';

describe('game content folders', () => {
  it('expands an inZOI documents folder into the folders the game uses', () => {
    expect(inzoiScanRoots('/home/player/Documents/inZOI')).toEqual([
      path.join('/home/player/Documents/inZOI', 'Mods'),
      path.join('/home/player/Documents/inZOI', 'Canvas'),
      path.join('/home/player/Documents/inZOI', 'Creations'),
      path.join('/home/player/Documents/inZOI', 'AIGenerated', 'My3DPrinter'),
    ]);
  });

  it('keeps a chosen leaf folder as the only scan root', () => {
    expect(inzoiScanRoots('/games/inZOI/Mods')).toEqual(['/games/inZOI/Mods']);
    expect(inzoiScanRoots('/games/inZOI/AIGenerated/My3DPrinter')).toEqual([
      '/games/inZOI/AIGenerated/My3DPrinter',
    ]);
  });

  it('uses a saved folder when one is set, and the usual folders otherwise', () => {
    expect(scanRoots('inzoi', '/home/player', '/mnt/inZOI')).toEqual([
      '/mnt/inZOI/Mods',
      '/mnt/inZOI/Canvas',
      '/mnt/inZOI/Creations',
      '/mnt/inZOI/AIGenerated/My3DPrinter',
    ]);
    expect(scanRoots('paralives', '/home/player', '/mnt/ParalivesMods')).toEqual(['/mnt/ParalivesMods']);
    expect(scanRoots('paralives', '/home/player')).toEqual([
      path.join('/home/player', '.config', 'unity3d', 'Paralives', 'Paralives'),
      path.join('/home/player', '.local', 'share', 'Paralives', 'Paralives'),
      path.join('/home/player', 'AppData', 'LocalLow', 'Paralives', 'Paralives'),
    ]);
    expect(scanRoots('inzoi', '/home/player')[0]).toBe(
      path.join('/home/player', 'Documents', 'inZOI', 'Mods')
    );
  });

  it('rejects a folder that is not an absolute path', () => {
    expect(sanitizeContentRoot('Documents/inZOI')).toBeUndefined();
    expect(sanitizeContentRoot('/mnt/inZOI')).toBe('/mnt/inZOI');
    expect(scanRoots('paralives', '/home/player', 'relative/mods')).toHaveLength(3);
  });
});
