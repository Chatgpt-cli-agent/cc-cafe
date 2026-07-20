'use client';

import { useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { filesystemToolsService } from '@/lib/services/FilesystemToolsService';
import { s4mmToolsService, type RegionMapItem } from '@/lib/services/S4mmToolsService';
import S4mmPanelShell, { S4mmActionButton, S4mmEmptyState } from './S4mmPanelShell';

// Region indices and default Z bounds mirror the S4MM 2.0 region map tool
// (regions 2 = CALF, 3 = KNEE with a -0.1..0.9 Z range by default).
const DEFAULT_BOUNDS = { min: -0.1, max: 0.9 };

export default function RegionMapPanel({ onClose }: { onClose?: () => void }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checkCalf, setCheckCalf] = useState(true);
  const [checkKnee, setCheckKnee] = useState(true);
  const [compareAgainstBase, setCompareAgainstBase] = useState(true);
  const [ignoreSmallMeshes, setIgnoreSmallMeshes] = useState(32);
  const [items, setItems] = useState<RegionMapItem[] | null>(null);
  const [scannedCount, setScannedCount] = useState(0);

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

    const types: { type: number; bounds: any }[] = [];
    if (checkCalf) types.push({ type: 2, bounds: { z: { ...DEFAULT_BOUNDS } } });
    if (checkKnee) types.push({ type: 3, bounds: { z: { ...DEFAULT_BOUNDS } } });
    if (types.length === 0) {
      showToast({
        type: 'warning',
        title: 'No regions selected',
        message: 'Enable at least one region check.',
        duration: 2500,
      });
      return;
    }

    setLoading(true);
    setItems(null);
    try {
      const scan = await s4mmToolsService.scanRegionMaps(modsPath);
      setScannedCount(scan.files.length);
      if (scan.files.length === 0) {
        setItems([]);
        return;
      }
      const result = await s4mmToolsService.processRegionMaps(scan.files, types, {
        compareAgainstBase,
        ignoreSmallMeshes,
      });
      setItems(result.items);
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Check failed',
        message: error?.message || 'Unable to run the region map check.',
        duration: 3500,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <S4mmPanelShell
      title="Region map checker"
      description="Finds CAS meshes that extend beyond the body region they are mapped to (for example shoes that deform the calf or knee)."
      onClose={onClose}
      loading={loading}
      actions={<S4mmActionButton onClick={() => void runCheck()} disabled={loading}>Run check</S4mmActionButton>}
    >
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}>
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
          <input type="checkbox" checked={checkCalf} onChange={(event) => setCheckCalf(event.target.checked)} />
          Check calf region
        </label>
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
          <input type="checkbox" checked={checkKnee} onChange={(event) => setCheckKnee(event.target.checked)} />
          Check knee region
        </label>
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
          <input
            type="checkbox"
            checked={compareAgainstBase}
            onChange={(event) => setCompareAgainstBase(event.target.checked)}
          />
          Compare against base mesh
        </label>
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
          Ignore meshes below
          <input
            type="number"
            min={0}
            value={ignoreSmallMeshes}
            onChange={(event) => setIgnoreSmallMeshes(Math.max(0, Number(event.target.value)))}
            className="w-20 rounded-lg px-2 py-1 text-sm"
            style={{ backgroundColor: 'var(--ui-hover)', color: 'var(--text-primary)' }}
          />
          faces
        </label>
      </div>

      {items && items.length === 0 && (
        <S4mmEmptyState
          message={
            scannedCount === 0
              ? 'No packages with region maps found.'
              : `No region issues detected in ${scannedCount} packages with region maps.`
          }
        />
      )}

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
                style={{ backgroundColor: 'rgba(255, 180, 84, 0.16)', color: '#ffc36e' }}
              >
                {item.issues.length} issues
              </div>
            </div>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Regions affected: {Array.from(new Set(item.issues.map((issue) => issue.region))).join(', ')}
            </p>
          </div>
        ))}
      </div>
    </S4mmPanelShell>
  );
}
