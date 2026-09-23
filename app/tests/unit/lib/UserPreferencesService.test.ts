import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserPreferencesService } from '@/lib/services/UserPreferencesService';

describe('UserPreferencesService install layout migration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(window.electron.ipcRenderer.invoke).mockImplementation(async (channel: string, ...args: unknown[]) => {
      if (channel === 'path:documentDir') return '/home/new-user/Documents';
      if (channel === 'path:join') return args.join('/');
      if (channel === 'fs:mkdir') return undefined;
      throw new Error(`Unexpected IPC: ${channel}`);
    });
  });

  it('uses the game-mirror library for a new installation', async () => {
    const service = new UserPreferencesService();
    await service.initialize();

    expect(service.getInstallLayoutMode()).toBe('game-mirror');
    expect(service.getLibraryRoot()).toBe('/home/new-user/Documents/CC Cafe Library');
  });

  it('migrates the obsolete drive default and persists the replacement', async () => {
    localStorage.setItem('cccafe_user_preferences', JSON.stringify({ libraryRoot: '/mnt/San-Myshuno/JDownloader' }));
    const service = new UserPreferencesService();
    service.getPreferences(); // Synchronous consumers may run before startup finishes.
    await service.initialize();
    expect(service.getLibraryRoot()).toBe('/home/new-user/Documents/CC Cafe Library');
    expect(JSON.parse(localStorage.getItem('cccafe_user_preferences')!).libraryRoot).toBe(service.getLibraryRoot());
  });

  it('preserves a chosen library on a different drive', async () => {
    localStorage.setItem('cccafe_user_preferences', JSON.stringify({ libraryRoot: '/mnt/NewDrive/My Library' }));
    const service = new UserPreferencesService();
    await service.initialize();
    expect(service.getLibraryRoot()).toBe('/mnt/NewDrive/My Library');
  });

  it('migrates the previous default CC-folder layout', async () => {
    localStorage.setItem(
      'cccafe_user_preferences',
      JSON.stringify({ installLayoutMode: 'cc-folder' })
    );

    const service = new UserPreferencesService();
    await service.initialize();

    expect(service.getInstallLayoutMode()).toBe('creator-cc-folder');
  });

  it('preserves an explicitly selected non-default layout', async () => {
    localStorage.setItem(
      'cccafe_user_preferences',
      JSON.stringify({ installLayoutMode: 'creator-folder' })
    );

    const service = new UserPreferencesService();
    await service.initialize();

    expect(service.getInstallLayoutMode()).toBe('creator-folder');
  });
});
