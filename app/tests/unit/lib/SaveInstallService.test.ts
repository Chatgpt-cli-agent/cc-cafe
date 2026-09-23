import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SaveInstallService } from '@/lib/services/SaveInstallService';
import type { CachedModFile } from '@/types/profile';

describe('SaveInstallService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockIpc(options: { existingTargets: string[]; sourceFiles: string[] }) {
    const invoke = vi.mocked(window.electron.ipcRenderer.invoke);
    invoke.mockImplementation(async (channel: string, ...args: unknown[]) => {
      switch (channel) {
        case 'path:documentDir':
          return '/home/user/Documents';
        case 'path:join':
          return (args as string[]).join('/');
        case 'fs:exists':
          return (
            options.existingTargets.includes(args[0] as string) ||
            options.sourceFiles.includes(args[0] as string)
          );
        case 'fs:mkdir':
          return undefined;
        case 'fs:rename':
          return undefined;
        case 'fs:copyFile':
          return undefined;
        default:
          throw new Error(`Unexpected IPC call: ${channel}`);
      }
    });
    return invoke;
  }

  it('flattens save files into the Saves folder root, backing up existing slots first', async () => {
    const files: CachedModFile[] = [
      {
        relativePath: 'Saves/Slot_00000002.save',
        fileName: 'Slot_00000002.save',
        fileSize: 100,
      },
      {
        relativePath: 'Slot_00000002.save.ver0',
        fileName: 'Slot_00000002.save.ver0',
        fileSize: 50,
      },
    ];
    const savesTarget = '/home/user/Documents/Electronic Arts/The Sims 4/saves';
    const invoke = mockIpc({
      existingTargets: [`${savesTarget}/Slot_00000002.save`],
      sourceFiles: [
        '/tmp/cache/Saves/Slot_00000002.save',
        '/tmp/cache/Slot_00000002.save.ver0',
      ],
    });

    const service = new SaveInstallService();
    const result = await service.installSavesFromCache('/tmp/cache', files);

    expect(result.installed).toEqual(['Slot_00000002.save', 'Slot_00000002.save.ver0']);
    expect(result.backups).toHaveLength(1);
    expect(result.backups[0]).toMatch(/^\/home\/user\/Documents\/Electronic Arts\/The Sims 4\/saves\/Slot_00000002\.save\.cc-cafe-backup-/);
    expect(invoke).toHaveBeenCalledWith('fs:copyFile', '/tmp/cache/Saves/Slot_00000002.save', `${savesTarget}/Slot_00000002.save`);
    expect(invoke).toHaveBeenCalledWith('fs:copyFile', '/tmp/cache/Slot_00000002.save.ver0', `${savesTarget}/Slot_00000002.save.ver0`);
  });

  it('skips non-save files', async () => {
    mockIpc({ existingTargets: [], sourceFiles: [] });

    const result = await new SaveInstallService().installSavesFromCache('/tmp/cache', [
      { relativePath: 'README.txt', fileName: 'README.txt', fileSize: 1 },
      { relativePath: 'preview.png', fileName: 'preview.png', fileSize: 1 },
    ]);

    expect(result.installed).toEqual([]);
    expect(result.backups).toEqual([]);
  });

  it('rejects path traversal that would escape the cache directory', async () => {
    mockIpc({ existingTargets: [], sourceFiles: [] });

    const result = await new SaveInstallService().installSavesFromCache('/tmp/cache', [
      { relativePath: '../Outside/evil.save', fileName: 'evil.save', fileSize: 1 },
    ]);

    expect(result.installed).toEqual([]);
  });

  it('uses the standard EA saves folder when possible', async () => {
    const invoke = mockIpc({ existingTargets: [], sourceFiles: [] });

    const savesDir = await new SaveInstallService().resolveSavesDir();

    expect(savesDir).toBe('/home/user/Documents/Electronic Arts/The Sims 4/saves');
    expect(invoke).toHaveBeenCalledWith('fs:mkdir', savesDir, { recursive: true });
  });
});