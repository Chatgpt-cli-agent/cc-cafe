/**
 * Unit tests for DiskPerformanceService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiskPerformanceService } from '@/lib/services/DiskPerformanceService';

const invoke = vi.mocked(window.electron.ipcRenderer.invoke);

function mockElectron({
  configExists = true,
  config,
  benchmark,
}: {
  configExists?: boolean;
  config?: unknown;
  benchmark?: { writeSpeed: number; readSpeed: number; driveType: string };
} = {}) {
  invoke.mockImplementation(async (channel: string, ...args: any[]) => {
    switch (channel) {
      case 'path:appDataDir':
        return '/mock/appdata';
      case 'path:join':
        return args.join('/');
      case 'fs:exists':
        return args[0]?.endsWith('performance.json') ? configExists : true;
      case 'fs:mkdir':
      case 'fs:writeFile':
        return true;
      case 'fs:readTextFile':
        return JSON.stringify(config);
      case 'disk:benchmark':
        return benchmark ?? { writeSpeed: 500, readSpeed: 700, driveType: 'NVMe' };
      default:
        return undefined;
    }
  });
}

function configFor(speed: number, poolSize = 5, benchmarkVersion = 2) {
  return {
    poolSize,
    diskSpeedMBps: speed,
    lastBenchmark: '2025-01-01T00:00:00Z',
    benchmarkVersion,
  };
}

describe('DiskPerformanceService', () => {
  let service: DiskPerformanceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DiskPerformanceService();
    mockElectron({ configExists: false });
  });

  describe('calculatePoolSize (via getPoolSize)', () => {
    it('should return default pool size (5) when not benchmarked', async () => {
      const poolSize = await service.getPoolSize();

      expect(poolSize).toBe(5);
    });
  });

  describe('classifyDiskType', () => {
    it('should classify < 100 MB/s as HDD', async () => {
      mockElectron({ config: configFor(50, 3) });

      await service.initialize();

      expect(await service.getDiskType()).toBe('hdd');
    });

    it('should classify 100-300 MB/s as SSD', async () => {
      mockElectron({ config: configFor(200, 8) });

      await service.initialize();

      expect(await service.getDiskType()).toBe('ssd');
    });

    it('should classify > 300 MB/s as NVMe', async () => {
      mockElectron({ config: configFor(900, 12) });

      await service.initialize();

      expect(await service.getDiskType()).toBe('nvme');
    });
  });

  describe('poolSize mapping', () => {
    const testCases = [
      { speed: 30, expectedPool: 3, description: 'slow HDD (< 50 MB/s)' },
      { speed: 75, expectedPool: 5, description: 'fast HDD / slow SSD (50-100 MB/s)' },
      { speed: 150, expectedPool: 8, description: 'SATA SSD (100-200 MB/s)' },
      { speed: 500, expectedPool: 12, description: 'NVMe (> 200 MB/s)' },
      { speed: 1000, expectedPool: 12, description: 'fast NVMe (> 200 MB/s)' },
    ];

    testCases.forEach(({ speed, expectedPool, description }) => {
      it(`should return pool size ${expectedPool} for ${description}`, async () => {
        mockElectron({ config: configFor(speed, expectedPool) });

        await service.initialize();

        expect(await service.getPoolSize()).toBe(expectedPool);
      });
    });
  });

  describe('isFirstRun', () => {
    it('should return true when no config exists', async () => {
      mockElectron({ configExists: false });

      expect(await service.isFirstRun()).toBe(true);
    });

    it('should return false when config exists', async () => {
      mockElectron({ config: configFor(100, 5) });

      expect(await service.isFirstRun()).toBe(false);
    });
  });

  describe('config version handling', () => {
    it('should invalidate config with old version', async () => {
      mockElectron({ config: configFor(100, 5, 1) });

      await service.initialize();

      expect(await service.getConfig()).toBeNull();
    });
  });

  describe('runBenchmark', () => {
    it('should call Electron benchmark command and save results', async () => {
      mockElectron({
        configExists: false,
        benchmark: { writeSpeed: 500, readSpeed: 700, driveType: 'NVMe' },
      });

      const progressCalls: number[] = [];
      const config = await service.runBenchmark((progress) => {
        progressCalls.push(progress);
      });

      expect(invoke).toHaveBeenCalledWith('disk:benchmark', { testPath: '/mock/appdata' });
      expect(config.diskSpeedMBps).toBe(500);
      expect(config.poolSize).toBe(12);
      expect(config.benchmarkVersion).toBe(2);
      expect(invoke).toHaveBeenCalledWith(
        'fs:writeFile',
        '/mock/appdata/CC Cafe/performance.json',
        expect.any(String)
      );
      expect(progressCalls).toContain(90);
      expect(progressCalls).toContain(100);
    });
  });

  describe('getDiskSpeed', () => {
    it('should return null when not benchmarked', async () => {
      mockElectron({ configExists: false });

      expect(await service.getDiskSpeed()).toBeNull();
    });

    it('should return speed when benchmarked', async () => {
      mockElectron({ config: configFor(850, 12) });

      await service.initialize();

      expect(await service.getDiskSpeed()).toBe(850);
    });
  });
});
