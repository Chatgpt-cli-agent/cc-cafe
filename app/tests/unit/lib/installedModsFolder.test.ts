import { describe, expect, it } from 'vitest';
import { groupInstalledFolderFiles, relativeModPath } from '@/lib/installedModsFolder';

describe('installed mods folder grouping', () => {
  it('keeps a path relative to the Mods folder', () => {
    expect(
      relativeModPath('/home/sims/Mods', {
        path: '/home/sims/Mods/CC',
        name: 'hair.package',
        fingerprint: 1,
      })
    ).toBe('CC/hair.package');
  });

  it('groups CurseForge matches and leaves unknown folder files on their own', () => {
    const groups = groupInstalledFolderFiles({
      modsPath: '/mods',
      files: [
        { path: '/mods', name: 'a.package', fingerprint: 10 },
        { path: '/mods', name: 'b.package', fingerprint: 10 },
        { path: '/mods/Loose', name: 'unknown.package', fingerprint: 99 },
      ],
      matches: [
        { fingerprint: 10, modId: 42, displayName: 'Slice of Life', fileName: 'a.package' },
      ],
      profileMods: [{ modId: 42, modName: 'Slice of Life', fileName: 'a.package' }],
    });

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      title: 'Slice of Life',
      kind: 'curseforge',
      local: false,
      inProfile: true,
      files: ['a.package', 'b.package'],
    });
    expect(groups[1]).toMatchObject({
      title: 'unknown.package',
      kind: 'folder',
      local: true,
      inProfile: false,
      files: ['Loose/unknown.package'],
    });
  });

  it('keeps a Patreon folder name as the source of a local file', () => {
    const groups = groupInstalledFolderFiles({
      modsPath: '/mods',
      files: [{ path: '/mods/Patreon/Creator', name: 'hair.package', fingerprint: 3 }],
      matches: [],
      profileMods: [],
    });

    expect(groups[0]).toMatchObject({
      local: true,
      source: 'Patreon',
      sourceEvidence: 'folder',
    });
  });

  it('uses the profile name when a folder file is tracked but not on CurseForge', () => {
    const groups = groupInstalledFolderFiles({
      modsPath: '/mods',
      files: [{ path: '/mods', name: 'local.ts4script', fingerprint: 7 }],
      matches: [],
      profileMods: [{ modName: 'Basemental', fileName: 'local.ts4script' }],
    });

    expect(groups[0]).toMatchObject({
      title: 'Basemental',
      kind: 'profile',
      local: true,
      inProfile: true,
    });
  });
});
