import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/services/DiskPerformanceService', () => ({
  diskPerformanceService: {
    getPoolSize: vi.fn().mockResolvedValue(1),
  },
}));

import { getSingleArchiveWrapperName, SymlinkService } from '@/lib/services/SymlinkService';

describe('SymlinkService Creator / item layout', () => {
  const invoke = vi.fn();

  beforeEach(() => {
    invoke.mockReset();
    invoke.mockImplementation(async (channel: string, ...args: unknown[]) => {
      switch (channel) {
        case 'path:join':
          return path.join(...(args as string[]));
        case 'fs:exists':
          return false;
        case 'fs:readDir':
          return [];
        case 'fs:copyDir':
        case 'fs:writeFile':
          return undefined;
        default:
          throw new Error(`Unexpected IPC call: ${channel}`);
      }
    });

    (window as any).electron = { ipcRenderer: { invoke } };
  });

  it('copies a mod to Creator/Item and tracks the nested item directory', async () => {
    const service = new SymlinkService();

    const result = await service.activateProfile('/The Sims 4/Mods', [
      {
        source: '/cache/mod-hash/files',
        creatorName: 'SayuriiW',
        modName: 'Fashion Designer',
        installLayoutMode: 'creator-cc-folder',
        files: [{ fileName: 'fashion.package', relativePath: 'fashion.package', size: 1 }],
      },
    ]);

    const expectedTarget = path.join('/The Sims 4/Mods', 'SayuriiW', 'Fashion Designer');
    expect(result.success).toBe(true);
    expect(invoke).toHaveBeenCalledWith('fs:copyDir', '/cache/mod-hash/files', expectedTarget);

    const manifestCall = invoke.mock.calls.find(([channel]) => channel === 'fs:writeFile');
    expect(manifestCall).toBeDefined();
    expect(JSON.parse(manifestCall![2] as string)).toEqual({
      version: 2,
      entries: [{ path: expectedTarget, type: 'dir' }],
    });
  });

  it('sanitizes both folder names and falls back for a missing creator', async () => {
    const service = new SymlinkService();

    await service.activateProfile('/Mods', [
      {
        source: '/cache/files',
        modName: 'Fashion: Designer?',
        installLayoutMode: 'creator-cc-folder',
      },
    ]);

    expect(invoke).toHaveBeenCalledWith(
      'fs:copyDir',
      '/cache/files',
      path.join('/Mods', 'Unknown Creator', 'Fashion_ Designer_')
    );
  });

  it('copies the contents of one archive wrapper into the item directory', async () => {
    invoke.mockImplementation(async (channel: string, ...args: unknown[]) => {
      switch (channel) {
        case 'path:join':
          return path.join(...(args as string[]));
        case 'fs:exists':
          return false;
        case 'fs:readDir':
          return [{ name: 'Felixandre CHATEAU Part 2', isDirectory: true }];
        case 'fs:copyDir':
        case 'fs:writeFile':
          return undefined;
        default:
          throw new Error(`Unexpected IPC call: ${channel}`);
      }
    });
    const service = new SymlinkService();

    await service.activateProfile('/Mods', [{
      source: '/cache/files',
      creatorName: 'felixandresims',
      modName: 'CHATEAU_Part_2',
      installLayoutMode: 'creator-cc-folder',
    }]);

    expect(invoke).toHaveBeenCalledWith(
      'fs:copyDir',
      path.join('/cache/files', 'Felixandre CHATEAU Part 2'),
      path.join('/Mods', 'felixandresims', 'CHATEAU_Part_2')
    );
  });
});

describe('getSingleArchiveWrapperName', () => {
  it('ignores archive metadata around one wrapper directory', () => {
    expect(getSingleArchiveWrapperName([
      { name: '__MACOSX', isDirectory: true },
      { name: '.DS_Store', isDirectory: false },
      { name: 'Felixandre CHATEAU Part 2', isDirectory: true },
    ])).toBe('Felixandre CHATEAU Part 2');
  });

  it('preserves multiple meaningful archive roots', () => {
    expect(getSingleArchiveWrapperName([
      { name: 'Packages', isDirectory: true },
      { name: 'Required', isDirectory: true },
    ])).toBeNull();
  });
});
