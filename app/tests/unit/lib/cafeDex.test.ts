import { describe, expect, it } from 'vitest';
import { cafeDexKey, syncCafeDex, updateCafeDex, type CafeDexEntry } from '@/lib/cafeDex';

const seen = (name: string, fingerprint: number, filePath = `/mods/${name}`): CafeDexEntry => ({
  key: `fp:${fingerprint}`,
  gameId: 'sims4',
  name,
  path: filePath,
  fingerprint,
  broken: false,
  note: '',
  lastSeenAt: '2026-09-22T00:00:00.000Z',
  missing: false,
});

describe('CafeDex', () => {
  it('remembers a mod by fingerprint so a rename keeps the note', () => {
    expect(cafeDexKey({ fingerprint: 42, path: '/mods/hair.package' })).toBe('fp:42');
    const first = syncCafeDex([], 'sims4', [
      { key: 'fp:42', name: 'hair.package', path: '/mods/hair.package', fingerprint: 42 },
    ], '2026-09-22T00:00:00.000Z');
    const noted = updateCafeDex(first, 'sims4', 'fp:42', { broken: true, note: 'Broke after the patch' });
    const renamed = syncCafeDex(noted, 'sims4', [
      { key: 'fp:42', name: 'hair-v2.package', path: '/mods/cas/hair-v2.package', fingerprint: 42 },
    ], '2026-09-23T00:00:00.000Z');

    expect(renamed).toHaveLength(1);
    expect(renamed[0].name).toBe('hair-v2.package');
    expect(renamed[0].broken).toBe(true);
    expect(renamed[0].note).toBe('Broke after the patch');
    expect(renamed[0].missing).toBe(false);
  });

  it('keeps a note when the file is missing from the latest scan', () => {
    const current = updateCafeDex([seen('chair.package', 7)], 'sims4', 'fp:7', { note: 'Needs the mesh' });
    const next = syncCafeDex(current, 'sims4', [], '2026-09-23T00:00:00.000Z');
    expect(next[0].missing).toBe(true);
    expect(next[0].note).toBe('Needs the mesh');
  });

  it('leaves another game alone while scanning Sims 4', () => {
    const paralives: CafeDexEntry = {
      ...seen('house.mod', 1, '/paralives/house.mod'),
      key: 'path:/paralives/house.mod',
      gameId: 'paralives',
      fingerprint: null,
      note: 'Keep this house',
    };
    const next = syncCafeDex([paralives], 'sims4', [
      { key: 'fp:9', name: 'bed.package', path: '/mods/bed.package', fingerprint: 9 },
    ], '2026-09-23T00:00:00.000Z');
    expect(next.find((entry) => entry.gameId === 'paralives')?.note).toBe('Keep this house');
    expect(next.filter((entry) => entry.gameId === 'sims4')).toHaveLength(1);
  });
});
