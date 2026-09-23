'use client';

import { useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { filesystemToolsService } from '@/lib/services/FilesystemToolsService';
import { s4mmToolsService, type TgiCheckItem } from '@/lib/services/S4mmToolsService';
import S4mmPanelShell, { S4mmActionButton, S4mmEmptyState } from './S4mmPanelShell';

export default function TgiCheckerPanel({ onClose }: { onClose?: () => void }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [threshold, setThreshold] = useState(1);
  const [items, setItems] = useState<TgiCheckItem[] | null>(null);
  const [stats, setStats] = useState<{ fileCount: number; caspFileCount: number } | null>(null);

  async function runCheck() {
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
    setItems(null);
    try {
      const result = await s4mmToolsService.checkTgi(modsPath, threshold);
      setItems(result.items);
      setStats({ fileCount: result.fileCount, caspFileCount: result.caspFileCount });
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Check failed',
        message: error?.message || 'Unable to run the TGI check.',
        duration: 3500,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <S4mmPanelShell
      title="TGI checker (CAS)"
      description="Checks CAS parts for broken TGI references (missing meshes or textures). References satisfied by game files cannot be verified and may appear as missing."
      onClose={onClose}
      loading={loading}
      actions={<S4mmActionButton onClick={() => void runCheck()} disabled={loading}>Run check</S4mmActionButton>}
    >
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Report
        </label>
        <select
          value={threshold}
          onChange={(event) => setThreshold(Number(event.target.value))}
          className="rounded-lg px-3 py-1.5 text-sm"
          style={{ backgroundColor: 'var(--ui-hover)', color: 'var(--text-primary)' }}
        >
          <option value={1}>Only fully broken CAS parts</option>
          <option value={0.5}>More than half of references missing</option>
          <option value={0}>Any missing reference</option>
        </select>
        {stats && (
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {stats.caspFileCount} CAS parts in {stats.fileCount} files checked
          </span>
        )}
      </div>

      {items && items.length === 0 && <S4mmEmptyState message="No broken TGI references found." />}

      <div className="space-y-2">
        {(items ?? []).map((item) => (
          <div
            key={`${item.path}/${item.name}`}
            className="rounded-xl px-4 py-3"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {item.name}
                </p>
                <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {item.path}
                </p>
              </div>
              <div
                className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: 'rgba(255, 99, 99, 0.16)', color: '#ff8484' }}
              >
                {item.missingReferences}/{item.totalReferences} missing
              </div>
            </div>
          </div>
        ))}
      </div>
    </S4mmPanelShell>
  );
}
