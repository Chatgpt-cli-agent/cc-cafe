import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ModCacheService, isSaveFileName } from '@/lib/services/ModCacheService';

describe('isSaveFileName', () => {
  it('recognizes slot saves and their rotating backups', () => {
    expect(isSaveFileName('Slot_00000014.save')).toBe(true);
    expect(isSaveFileName('slot_00000002.save.ver0')).toBe(true);
    expect(isSaveFileName('Slot_00000002.save.ver4')).toBe(true);
  });

  it('ignores mod content', () => {
    expect(isSaveFileName('hair.package')).toBe(false);
    expect(isSaveFileName('mod.ts4script')).toBe(false);
    expect(isSaveFileName('lot.trayitem')).toBe(false);
  });
});

describe('ModCacheService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an archive when the extraction IPC reports failure', async () => {
    const invoke = vi.mocked(window.electron.ipcRenderer.invoke);
    invoke.mockImplementation(async (channel: string, ...args: unknown[]) => {
      switch (channel) {
        case 'path:appDataDir':
          return '/tmp/cc-cafe-test';
        case 'path:join':
          return (args as string[]).join('/');
        case 'fs:exists':
          return true;
        case 'fs:mkdir':
          return undefined;
        case 'fs:remove':
          return undefined;
        case 'fs:readTextFile':
          return JSON.stringify({ version: '1.0.0', entries: {}, lastCleanup: '' });
        case 'crypto:hashFile':
          return 'archive-hash';
        case 'extract-zip':
          return { success: false, error: 'extractor unavailable' };
        default:
          throw new Error(`Unexpected IPC call: ${channel}`);
      }
    });

    const service = new ModCacheService();

    await expect(
      service.addToCache(123, 'broken.zip', '/tmp/broken.zip', 'profile-1')
    ).rejects.toThrow('extractor unavailable');

    expect(invoke).toHaveBeenCalledWith(
      'fs:remove',
      '/tmp/cc-cafe-test/CC Cafe/ModsCache/archive-hash',
      { recursive: true }
    );
    expect(invoke).not.toHaveBeenCalledWith('fs:writeFile', expect.anything(), expect.anything());
  });

  it('rebuilds a legacy cache entry that contains no extracted files', async () => {
    const invoke = vi.mocked(window.electron.ipcRenderer.invoke);
    const emptyEntry = {
      fileHash: 'archive-hash',
      modId: 123,
      fileName: 'mod.zip',
      fileSize: 100,
      downloadedAt: '',
      usedByProfiles: ['profile-1'],
      files: [],
    };

    invoke.mockImplementation(async (channel: string, ...args: unknown[]) => {
      switch (channel) {
        case 'path:appDataDir':
          return '/tmp/cc-cafe-test';
        case 'path:join':
          return (args as string[]).join('/');
        case 'fs:exists':
          return true;
        case 'fs:mkdir':
        case 'fs:remove':
        case 'fs:writeFile':
          return undefined;
        case 'fs:readTextFile':
          return JSON.stringify({
            version: '1.0.0',
            entries: { 'archive-hash': emptyEntry },
            lastCleanup: '',
          });
        case 'fs:readDir':
          return [{ name: 'working.package', isDirectory: false }];
        case 'fs:stat':
          return { size: 100 };
        case 'crypto:hashFile':
          return 'archive-hash';
        case 'extract-zip':
          return { success: true };
        default:
          throw new Error(`Unexpected IPC call: ${channel}`);
      }
    });

    const cached = await new ModCacheService().addToCache(
      123,
      'mod.zip',
      '/tmp/mod.zip',
      'profile-1'
    );

    expect(invoke).toHaveBeenCalledWith('extract-zip', expect.anything());
    expect(cached.files).toEqual([
      { relativePath: 'working.package', fileName: 'working.package', fileSize: 0 },
    ]);
  });

  it('accepts an archive containing only save files', async () => {
    const invoke = vi.mocked(window.electron.ipcRenderer.invoke);

    invoke.mockImplementation(async (channel: string, ...args: unknown[]) => {
      switch (channel) {
        case 'path:appDataDir':
          return '/tmp/cc-cafe-test';
        case 'path:join':
          return (args as string[]).join('/');
        case 'fs:exists':
          return true;
        case 'fs:mkdir':
        case 'fs:remove':
        case 'fs:writeFile':
          return undefined;
        case 'fs:readTextFile':
          return JSON.stringify({
            version: '1.0.0',
            entries: {},
            lastCleanup: '',
          });
        case 'fs:readDir':
          return [
            { name: 'Slot_00000014.save', isDirectory: false },
            { name: 'Slot_00000014.save.ver0', isDirectory: false },
            { name: 'README.txt', isDirectory: false },
          ];
        case 'fs:stat':
          return { size: 100 };
        case 'crypto:hashFile':
          return 'save-archive-hash';
        case 'extract-zip':
          return { success: true };
        default:
          throw new Error(`Unexpected IPC call: ${channel}`);
      }
    });

    const cached = await new ModCacheService().addToCache(
      123,
      'Slot_00000014.zip',
      '/tmp/slot14.zip',
      'profile-1'
    );

    expect(cached.files).toEqual([
      { relativePath: 'Slot_00000014.save', fileName: 'Slot_00000014.save', fileSize: 0 },
      { relativePath: 'Slot_00000014.save.ver0', fileName: 'Slot_00000014.save.ver0', fileSize: 0 },
    ]);
  });
});
