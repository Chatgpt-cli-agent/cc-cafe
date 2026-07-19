'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { s4mmToolsService, type SaveDataSummary, type SaveFileInfo } from '@/lib/services/S4mmToolsService';
import S4mmPanelShell, { S4mmActionButton, S4mmEmptyState } from './S4mmPanelShell';

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export default function SaveFilesPanel({ onClose }: { onClose?: () => void }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [savesPath, setSavesPath] = useState('');
  const [resolvedPath, setResolvedPath] = useState('');
  const [items, setItems] = useState<SaveFileInfo[] | null>(null);
  const [summary, setSummary] = useState<{ name: string; data: SaveDataSummary } | null>(null);

  const loadSaves = useCallback(
    async (pathOverride?: string) => {
      setLoading(true);
      setSummary(null);
      try {
        const result = await s4mmToolsService.listSaves(pathOverride);
        setItems(result.items);
        setResolvedPath(result.savesPath);
      } catch (error: any) {
        showToast({
          type: 'error',
          title: 'Failed to read saves',
          message: error?.message || 'Unable to list save files.',
          duration: 3500,
        });
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    void loadSaves();
  }, [loadSaves]);

  async function pickFolder() {
    const result = await window.electron.ipcRenderer.invoke('dialog:open', {
      properties: ['openDirectory'],
    });
    if (!result || result.canceled || !result.filePaths?.[0]) return;
    setSavesPath(result.filePaths[0]);
    void loadSaves(result.filePaths[0]);
  }

  async function readSummary(item: SaveFileInfo) {
    setLoading(true);
    try {
      const data = await s4mmToolsService.readSave(`${item.path}/${item.name}`);
      setSummary({ name: item.name, data });
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Failed to decode save',
        message: error?.message || 'Unable to decode this save file.',
        duration: 3500,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <S4mmPanelShell
      title="Save files"
      description="Reads The Sims 4 save files (protobuf decoded) to show slot names and household data."
      onClose={onClose}
      loading={loading}
      actions={
        <>
          <S4mmActionButton tone="secondary" onClick={() => void pickFolder()} disabled={loading}>
            Choose folder…
          </S4mmActionButton>
          <S4mmActionButton onClick={() => void loadSaves(savesPath || undefined)} disabled={loading}>
            Reload
          </S4mmActionButton>
        </>
      }
    >
      <p className="mb-4 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
        Folder: {resolvedPath || 'detecting…'}
      </p>

      {items && items.length === 0 && (
        <S4mmEmptyState message="No save files found. Choose your Sims 4 saves folder manually." />
      )}

      <div className="space-y-2">
        {(items ?? []).map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between gap-4 rounded-xl px-4 py-3"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {item.slotName || item.name}
              </p>
              <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                {item.name} — {formatSize(item.size)} — {new Date(item.modifiedAt).toLocaleString()}
              </p>
            </div>
            <S4mmActionButton tone="secondary" onClick={() => void readSummary(item)} disabled={loading}>
              Details
            </S4mmActionButton>
          </div>
        ))}
      </div>

      {summary && (
        <div className="mt-4 rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {summary.data.slotName || summary.name}
          </h3>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {summary.data.householdCount} households — {summary.data.simCount} sims
          </p>
          {summary.data.simNames.length > 0 && (
            <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {summary.data.simNames.slice(0, 30).join(', ')}
              {summary.data.simNames.length > 30 ? ', …' : ''}
            </p>
          )}
        </div>
      )}
    </S4mmPanelShell>
  );
}
