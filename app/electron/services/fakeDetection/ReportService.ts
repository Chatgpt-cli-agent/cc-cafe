/**
 * Service for managing mod reports, warnings, and creator bans.
 *
 * This intentionally uses a local JSON store instead of Prisma. The Prisma
 * query engine is a native Rust library and has crashed inside Electron on
 * this Linux/KDE setup while loading the Mods page.
 */

import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import type {
  ReportSubmission,
  ModWarningStatus,
  BatchWarningResponse,
  ReportResult,
  CreatorBanStatus,
} from '../../types/fakeDetection.types';
import { logger } from '../../utils/logger';

interface StoredReport {
  modId: number;
  machineId: string;
  reason: string;
  fakeScore: number;
  createdAt: string;
}

interface StoredWarning {
  modId: number;
  reportCount: number;
  isAutoWarned: boolean;
  warningReason: string;
  creatorId: number | null;
  updatedAt: string;
}

interface StoredBannedCreator {
  creatorId: number;
  creatorName: string;
  modsBannedCount: number;
  updatedAt: string;
}

interface ReportStore {
  reports: StoredReport[];
  warnings: StoredWarning[];
  bannedCreators: StoredBannedCreator[];
}

const EMPTY_STORE: ReportStore = {
  reports: [],
  warnings: [],
  bannedCreators: [],
};

const CONFIG = {
  REPORTS_FOR_WARNING: 3,
  WARNINGS_FOR_BAN: 3,
};

const emptyWarningStatus = (): ModWarningStatus => ({
  hasWarning: false,
  reportCount: 0,
  isAutoWarned: false,
  creatorBanned: false,
});

export class ReportService {
  private storePath: string | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  private getStorePath(): string {
    if (!this.storePath) {
      this.storePath = path.join(app.getPath('userData'), 'fake-detection-store.json');
    }

    return this.storePath;
  }

  private async readStore(): Promise<ReportStore> {
    try {
      const raw = await fs.readFile(this.getStorePath(), 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ReportStore>;

      return {
        reports: Array.isArray(parsed.reports) ? parsed.reports : [],
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
        bannedCreators: Array.isArray(parsed.bannedCreators) ? parsed.bannedCreators : [],
      };
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        logger.warn('Failed to read fake detection store; using empty store', { error });
      }

      return { ...EMPTY_STORE };
    }
  }

  private async writeStore(store: ReportStore): Promise<void> {
    const write = async () => {
      const storePath = this.getStorePath();
      await fs.mkdir(path.dirname(storePath), { recursive: true });
      await fs.writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, 'utf-8');
    };

    this.writeQueue = this.writeQueue.then(write, write);
    await this.writeQueue;
  }

  async submitReport(modId: number, report: ReportSubmission): Promise<ReportResult> {
    const store = await this.readStore();
    const existing = store.reports.find((item) => item.modId === modId && item.machineId === report.machineId);

    if (existing) {
      return { success: false, alreadyReported: true };
    }

    store.reports.push({
      modId,
      machineId: report.machineId,
      reason: report.reason,
      fakeScore: report.fakeScore,
      createdAt: new Date().toISOString(),
    });

    const reportCount = store.reports.filter((item) => item.modId === modId).length;

    if (report.fakeScore >= 50) {
      this.addOrUpdateWarningInStore(
        store,
        modId,
        0,
        true,
        `Suspicious content detected: ${report.reason}`,
        report.creatorId,
        report.creatorName
      );
    } else if (reportCount >= CONFIG.REPORTS_FOR_WARNING) {
      this.addOrUpdateWarningInStore(
        store,
        modId,
        reportCount,
        false,
        `Reported by ${reportCount} users`,
        report.creatorId,
        report.creatorName
      );
    }

    await this.writeStore(store);

    logger.info(`New report submitted for mod ${modId}`, {
      machineId: `${report.machineId.substring(0, 8)}...`,
      fakeScore: report.fakeScore,
    });

    return { success: true, message: 'Report submitted successfully' };
  }

  async addAutoWarning(
    modId: number,
    reason: string,
    creatorId?: number,
    creatorName?: string
  ): Promise<void> {
    const store = await this.readStore();
    this.addOrUpdateWarningInStore(store, modId, 0, true, reason, creatorId, creatorName);
    await this.writeStore(store);
  }

  async getWarningStatus(modId: number, creatorId?: number): Promise<ModWarningStatus> {
    const store = await this.readStore();
    const warning = store.warnings.find((item) => item.modId === modId);
    const checkedCreatorId = warning?.creatorId || creatorId;
    const creatorBanned = checkedCreatorId
      ? store.bannedCreators.some((item) => item.creatorId === checkedCreatorId)
      : false;

    if (!warning) {
      return { ...emptyWarningStatus(), creatorBanned };
    }

    return {
      hasWarning: true,
      reportCount: warning.reportCount,
      isAutoWarned: warning.isAutoWarned,
      warningReason: warning.warningReason,
      creatorBanned,
    };
  }

  async getBatchWarningStatus(
    modIds: number[],
    creatorIds?: number[]
  ): Promise<BatchWarningResponse> {
    const store = await this.readStore();
    const warningByModId = new Map(store.warnings.map((warning) => [warning.modId, warning]));
    const bannedCreatorIds = new Set(store.bannedCreators.map((creator) => creator.creatorId));
    const result: BatchWarningResponse = {};

    modIds.forEach((modId, index) => {
      const warning = warningByModId.get(modId);
      const creatorId = warning?.creatorId || creatorIds?.[index];
      const creatorBanned = creatorId ? bannedCreatorIds.has(creatorId) : false;

      result[modId] = warning
        ? {
            hasWarning: true,
            reportCount: warning.reportCount,
            isAutoWarned: warning.isAutoWarned,
            warningReason: warning.warningReason,
            creatorBanned,
          }
        : { ...emptyWarningStatus(), creatorBanned };
    });

    return result;
  }

  async isCreatorBanned(creatorId: number): Promise<CreatorBanStatus> {
    const store = await this.readStore();
    const banned = store.bannedCreators.find((item) => item.creatorId === creatorId);

    return {
      banned: !!banned,
      reason: banned ? `Creator has ${banned.modsBannedCount} mods with warnings` : undefined,
      modsBannedCount: banned?.modsBannedCount,
    };
  }

  async getCreatorFakeRatio(creatorId: number, totalMods: number = 10): Promise<number> {
    const store = await this.readStore();
    const warnedCount = store.warnings.filter((warning) => warning.creatorId === creatorId).length;

    if (warnedCount === 0 || totalMods === 0) {
      return 0;
    }

    return Math.min(warnedCount / totalMods, 1);
  }

  async getReportCount(modId: number): Promise<number> {
    const store = await this.readStore();
    return store.reports.filter((report) => report.modId === modId).length;
  }

  async hasAlreadyReported(modId: number, machineId: string): Promise<boolean> {
    const store = await this.readStore();
    return store.reports.some((report) => report.modId === modId && report.machineId === machineId);
  }

  private addOrUpdateWarningInStore(
    store: ReportStore,
    modId: number,
    reportCount: number,
    isAutoWarned: boolean,
    warningReason: string,
    creatorId?: number,
    creatorName?: string
  ): void {
    const existing = store.warnings.find((warning) => warning.modId === modId);
    const now = new Date().toISOString();

    if (existing) {
      existing.reportCount = reportCount;
      existing.isAutoWarned = existing.isAutoWarned || isAutoWarned;
      existing.warningReason = warningReason;
      existing.creatorId = creatorId ?? existing.creatorId;
      existing.updatedAt = now;
    } else {
      store.warnings.push({
        modId,
        reportCount,
        isAutoWarned,
        warningReason,
        creatorId: creatorId ?? null,
        updatedAt: now,
      });
    }

    if (creatorId) {
      this.checkCreatorBanInStore(store, creatorId, creatorName);
    }
  }

  private checkCreatorBanInStore(store: ReportStore, creatorId: number, creatorName?: string): void {
    const warnedModsCount = store.warnings.filter((warning) => warning.creatorId === creatorId).length;

    if (warnedModsCount < CONFIG.WARNINGS_FOR_BAN) {
      return;
    }

    const now = new Date().toISOString();
    const existing = store.bannedCreators.find((creator) => creator.creatorId === creatorId);

    if (existing) {
      existing.modsBannedCount = warnedModsCount;
      existing.creatorName = creatorName || existing.creatorName;
      existing.updatedAt = now;
      return;
    }

    store.bannedCreators.push({
      creatorId,
      creatorName: creatorName || 'Unknown',
      modsBannedCount: warnedModsCount,
      updatedAt: now,
    });
  }
}

export const reportService = new ReportService();
