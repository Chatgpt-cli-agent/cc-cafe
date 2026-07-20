'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { filesystemToolsService } from '@/lib/services/FilesystemToolsService';
import { s4mmToolsService, type HqTextureItem } from '@/lib/services/S4mmToolsService';
import S4mmPanelShell, { S4mmActionButton, S4mmEmptyState } from './S4mmPanelShell';

const SIZE_FILTERS = [
  { label: 'All textures', value: 0 },
  { label: '1024px and larger', value: 1024 },
  { label: '2048px and larger (HQ)', value: 2048 },
  { label: '4096px and larger', value: 4096 },
];

export default function HqTexturesPanel({ onClose }: { onClose?: () => void }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<HqTextureItem[] | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [minSize, setMinSize] = useState(2048);

  const runScan = useCallback(async () => {
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
    try {
      const result = await s4mmToolsService.scanHqTextures(modsPath);
      setItems(result.items);
      setFileCount(result.fileCount);
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Scan failed',
        message: error?.message || 'Unable to scan textures.',
        duration: 3500,
      });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void runScan();
  }, [runScan]);

  const filtered = (items ?? []).filter((item) => Math.max(item.maxWidth, item.maxHeight) >= minSize);

  return (
    <S4mmPanelShell
      title="HQ textures"
      description="Finds CAS textures (LRLE/RLE2) and reports their dimensions so oversized HQ textures can be identified."
      onClose={onClose}
      loading={loading}
      actions={<S4mmActionButton onClick={() => void runScan()} disabled={loading}>Rescan</S4mmActionButton>}
    >
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Show
        </label>
        <select
          value={minSize}
          onChange={(event) => setMinSize(Number(event.target.value))}
          className="rounded-lg px-3 py-1.5 text-sm"
          style={{ backgroundColor: 'var(--ui-hover)', color: 'var(--text-primary)' }}
        >
          {SIZE_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>
        {items && (
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {filtered.length} of {items.length} textured packages ({fileCount} files scanned)
          </span>
        )}
      </div>

      {items && filtered.length === 0 && <S4mmEmptyState message="No packages match the current size filter." />}

      <div className="space-y-2">
        {filtered.map((item) => (
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
                style={{ backgroundColor: 'var(--ui-hover)', color: 'var(--text-primary)' }}
              >
                {item.maxWidth}x{item.maxHeight}
              </div>
            </div>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {item.textures.filter((texture) => texture.success).length} textures:{' '}
              {item.textures
                .filter((texture) => texture.success)
                .slice(0, 6)
                .map((texture) => `${texture.width}x${texture.height}`)
                .join(', ')}
              {item.textures.length > 6 ? ', …' : ''}
            </p>
          </div>
        ))}
      </div>
    </S4mmPanelShell>
  );
}
