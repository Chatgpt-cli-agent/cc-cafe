'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { filesystemToolsService } from '@/lib/services/FilesystemToolsService';
import {
  s4mmToolsService,
  type ModsIndexProgress,
  type ModsIndexStatus,
} from '@/lib/services/S4mmToolsService';
import S4mmPanelShell, { S4mmActionButton, S4mmEmptyState } from './S4mmPanelShell';

function formatTimestamp(value: number | null): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export default function ModsIndexPanel({ onClose }: { onClose?: () => void }) {
  const { showToast } = useToast();
  const [status, setStatus] = useState<ModsIndexStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ModsIndexProgress | null>(null);

  async function refreshStatus() {
    try {
      const next = await s4mmToolsService.getModsIndexStatus();
      setStatus(next);
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Could not load index status',
        message: error?.message || 'Unable to read the mods file index.',
        duration: 3000,
      });
    }
  }

  useEffect(() => {
    void refreshStatus();
    const unsubscribe = s4mmToolsService.onModsIndexProgress((event) => {
      setProgress(event);
    });
    return unsubscribe;
  }, []);

  async function runRebuild(full: boolean) {
    const modsPath = await filesystemToolsService.getModsPath();
    if (!modsPath) {
      showToast({
        type: 'error',
        title: 'Mods folder not configured',
        message: 'Open Settings and configure your Sims 4 Mods folder first.',
        duration: 3000,
      });
      return;
    }

    setLoading(true);
    setProgress({ phase: 'scan', current: 0, total: 0, message: 'Starting…' });
    try {
      const result = await s4mmToolsService.rebuildModsIndex(modsPath, full);
      await refreshStatus();
      showToast({
        type: 'success',
        title: full ? 'Full rebuild complete' : 'Index sync complete',
        message: `${result.upserted} updated, ${result.unchanged} unchanged, ${result.pruned} pruned in ${formatDuration(result.durationMs)}.`,
        duration: 4000,
      });
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Index rebuild failed',
        message: error?.message || 'Unable to rebuild the mods file index.',
        duration: 3500,
      });
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  async function clearIndex() {
    setLoading(true);
    try {
      await s4mmToolsService.clearModsIndex();
      await refreshStatus();
      showToast({
        type: 'success',
        title: 'Index cleared',
        message: 'The mods file index was removed.',
        duration: 2500,
      });
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Clear failed',
        message: error?.message || 'Unable to clear the mods file index.',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  }

  const progressPercent =
    progress && progress.total > 0 ? Math.min(100, Math.round((progress.current / progress.total) * 100)) : 0;

  return (
    <S4mmPanelShell
      title="Mods file index"
      description="Build a local SQLite index of your Mods folder (fingerprints, package classification, resource TGIs) so S4MM tools can query it instead of rescanning every package."
      onClose={onClose}
      loading={loading}
      actions={
        <>
          <S4mmActionButton onClick={() => void runRebuild(false)} disabled={loading}>
            Sync index
          </S4mmActionButton>
          <S4mmActionButton onClick={() => void runRebuild(true)} disabled={loading} tone="secondary">
            Full rebuild
          </S4mmActionButton>
          <S4mmActionButton onClick={() => void clearIndex()} disabled={loading || !status?.fileCount} tone="danger">
            Clear
          </S4mmActionButton>
        </>
      }
    >
      {progress && (
        <div className="mb-4">
          <div className="mb-1 flex justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>{progress.message || progress.phase}</span>
            <span>{progress.total > 0 ? `${progressPercent}%` : '…'}</span>
          </div>
          <div className="h-2 overflow-hidden rounded" style={{ backgroundColor: 'var(--ui-hover)' }}>
            <div
              className="h-full transition-all"
              style={{ width: `${progressPercent}%`, backgroundColor: '#7cf262' }}
            />
          </div>
          {progress.fileName && (
            <p className="mt-1 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
              {progress.fileName}
            </p>
          )}
        </div>
      )}

      {!status ? (
        <S4mmEmptyState>Loading index status…</S4mmEmptyState>
      ) : status.fileCount === 0 ? (
        <S4mmEmptyState>
          No index yet. Run Sync index once to catalog your Mods folder. Fingerprint, merge, TGI, HQ texture, and
          region map tools will use it automatically afterward.
        </S4mmEmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Files indexed" value={String(status.fileCount)} />
          <Stat label="Packages" value={String(status.packageCount)} />
          <Stat label="Scripts" value={String(status.scriptCount)} />
          <Stat label="Other (zip/rar)" value={String(status.otherCount)} />
          <Stat label="Resource entries" value={String(status.entryCount)} />
          <Stat label="Fingerprints" value={String(status.fingerprintCount)} />
          <Stat label="Merged packages" value={String(status.mergedCount)} />
          <Stat label="CAS packages" value={String(status.caspCount)} />
          <Stat label="Last rebuild" value={formatTimestamp(status.lastRebuildAt)} />
          <Stat label="Indexed root" value={status.rootPath || '—'} wide />
        </div>
      )}
    </S4mmPanelShell>
  );
}

function Stat({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div
      className={wide ? 'sm:col-span-2 lg:col-span-3' : undefined}
      style={{ color: 'var(--text-primary)' }}
    >
      <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </div>
      <div className="mt-1 break-all text-sm font-medium">{value}</div>
    </div>
  );
}
