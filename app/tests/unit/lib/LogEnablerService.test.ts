/**
 * Unit tests for LogEnablerService
 * Tests installation, uninstallation, and status checking of the Sims Log Enabler mod
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/apiClient', () => ({
  apiGet: vi.fn(),
}));

import { apiGet } from '@/lib/apiClient';

const invoke = vi.mocked(window.electron.ipcRenderer.invoke);

function mockInvoke(defaultExists = true) {
  invoke.mockImplementation(async (channel: string, ...args: any[]) => {
    switch (channel) {
      case 'path:join':
        return args.join('/');
      case 'fs:exists':
        return defaultExists;
      case 'fs:mkdir':
      case 'fs:writeFile':
      case 'fs:remove':
        return true;
      case 'tools:get-file':
        return new Uint8Array([1, 2, 3]);
      default:
        return undefined;
    }
  });
}

const mockMetadata = {
  version: '1.0.0',
  description: 'Test Log Enabler',
  files: [
    { filename: 'test.ts4script', hash: 'abc123', fileSize: 1234 },
    { filename: 'config.cfg', hash: 'def456', fileSize: 100 },
  ],
};

describe('LogEnablerService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockInvoke();
  });

  describe('getMetadata', () => {
    it('should return metadata from API', async () => {
      (apiGet as any).mockResolvedValue({
        success: true,
        data: mockMetadata,
      });

      const { LogEnablerService } = await import(
        '@/lib/services/LogEnablerService'
      );
      const service = new LogEnablerService();

      const result = await service.getMetadata();

      expect(result).toEqual(mockMetadata);
      expect(apiGet).toHaveBeenCalledWith('/api/v1/tools/sims-log-enabler/metadata');
    });

    it('should throw error when API returns failure', async () => {
      (apiGet as any).mockResolvedValue({
        success: false,
      });

      const { LogEnablerService } = await import(
        '@/lib/services/LogEnablerService'
      );
      const service = new LogEnablerService();

      await expect(service.getMetadata()).rejects.toThrow(
        'Failed to fetch Log Enabler metadata'
      );
    });
  });

  describe('isInstalled', () => {
    it('should return true when all files exist', async () => {
      (apiGet as any).mockResolvedValue({
        success: true,
        data: mockMetadata,
      });
      invoke.mockImplementation(async (channel: string, ...args: any[]) => {
        if (channel === 'path:join') return args.join('/');
        if (channel === 'fs:exists') return true;
        return true;
      });

      const { LogEnablerService } = await import(
        '@/lib/services/LogEnablerService'
      );
      const service = new LogEnablerService();

      const result = await service.isInstalled('/mods');

      expect(result).toBe(true);
    });

    it('should return false when a file is missing', async () => {
      (apiGet as any).mockResolvedValue({
        success: true,
        data: mockMetadata,
      });
      let existsCalls = 0;
      invoke.mockImplementation(async (channel: string, ...args: any[]) => {
        if (channel === 'path:join') return args.join('/');
        if (channel === 'fs:exists') {
          existsCalls++;
          return existsCalls === 1;
        }
        return true;
      });

      const { LogEnablerService } = await import(
        '@/lib/services/LogEnablerService'
      );
      const service = new LogEnablerService();

      const result = await service.isInstalled('/mods');

      expect(result).toBe(false);
    });

    it('should return false when metadata fetch fails', async () => {
      (apiGet as any).mockRejectedValue(new Error('Network error'));

      const { LogEnablerService } = await import(
        '@/lib/services/LogEnablerService'
      );
      const service = new LogEnablerService();

      const result = await service.isInstalled('/mods');

      expect(result).toBe(false);
    });
  });

  describe('install', () => {
    it('should install all files successfully', async () => {
      (apiGet as any).mockResolvedValue({
        success: true,
        data: mockMetadata,
      });
      mockInvoke(true);

      const { LogEnablerService } = await import(
        '@/lib/services/LogEnablerService'
      );
      const service = new LogEnablerService();

      const result = await service.install('/mods');

      expect(result.success).toBe(true);
      expect(invoke).toHaveBeenCalledWith('fs:writeFile', expect.any(String), expect.any(Uint8Array));
    });

    it('should return error when mods folder not found', async () => {
      invoke.mockImplementation(async (channel: string, ...args: any[]) => {
        if (channel === 'path:join') return args.join('/');
        if (channel === 'fs:exists') return false;
        return true;
      });

      const { LogEnablerService } = await import(
        '@/lib/services/LogEnablerService'
      );
      const service = new LogEnablerService();

      const result = await service.install('/nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Mods folder not found');
    });

    it('should return error when packaged tool file cannot be loaded', async () => {
      (apiGet as any).mockResolvedValue({
        success: true,
        data: mockMetadata,
      });
      invoke.mockImplementation(async (channel: string, ...args: any[]) => {
        if (channel === 'path:join') return args.join('/');
        if (channel === 'fs:exists') return true;
        if (channel === 'tools:get-file') return { success: false, error: 'Missing file' };
        return true;
      });

      const { LogEnablerService } = await import(
        '@/lib/services/LogEnablerService'
      );
      const service = new LogEnablerService();

      const result = await service.install('/mods');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing file');
    });

    it('should create install directory if it does not exist', async () => {
      (apiGet as any).mockResolvedValue({
        success: true,
        data: mockMetadata,
      });
      let existsCalls = 0;
      invoke.mockImplementation(async (channel: string, ...args: any[]) => {
        if (channel === 'path:join') return args.join('/');
        if (channel === 'fs:exists') {
          existsCalls++;
          return existsCalls === 1;
        }
        if (channel === 'tools:get-file') return new Uint8Array([1, 2, 3]);
        return true;
      });

      const { LogEnablerService } = await import(
        '@/lib/services/LogEnablerService'
      );
      const service = new LogEnablerService();

      await service.install('/mods');

      expect(invoke).toHaveBeenCalledWith('fs:mkdir', '/mods/Sims_Log_Enabler', {
        recursive: true,
      });
    });
  });

  describe('uninstall', () => {
    it('should remove the install folder', async () => {
      mockInvoke(true);

      const { LogEnablerService } = await import(
        '@/lib/services/LogEnablerService'
      );
      const service = new LogEnablerService();

      const result = await service.uninstall('/mods');

      expect(result.success).toBe(true);
      expect(invoke).toHaveBeenCalledWith('fs:remove', '/mods/Sims_Log_Enabler', {
        recursive: true,
      });
    });

    it('should succeed when folder does not exist', async () => {
      mockInvoke(false);

      const { LogEnablerService } = await import(
        '@/lib/services/LogEnablerService'
      );
      const service = new LogEnablerService();

      const result = await service.uninstall('/mods');

      expect(result.success).toBe(true);
      expect(invoke).not.toHaveBeenCalledWith('fs:remove', expect.any(String), expect.anything());
    });

    it('should return error on remove failure', async () => {
      invoke.mockImplementation(async (channel: string, ...args: any[]) => {
        if (channel === 'path:join') return args.join('/');
        if (channel === 'fs:exists') return true;
        if (channel === 'fs:remove') throw new Error('Permission denied');
        return true;
      });

      const { LogEnablerService } = await import(
        '@/lib/services/LogEnablerService'
      );
      const service = new LogEnablerService();

      const result = await service.uninstall('/mods');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });
  });
});
