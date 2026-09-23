'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { filesystemToolsService } from '@/lib/services/FilesystemToolsService';
import { s4mmToolsService, type MergedFileInfo } from '@/lib/services/S4mmToolsService';
import S4mmPanelShell, { S4mmActionButton, S4mmEmptyState } from './S4mmPanelShell';

async function pickFolder(): Promise<string | null> {
  const result = await window.electron.ipcRenderer.invoke('dialog:open', {
    properties: ['openDirectory', 'createDirectory'],
  });
  if (!result || result.canceled || !result.filePaths?.[0]) return null;
  return result.filePaths[0];
}

export default function MergeToolPanel({ onClose }: { onClose?: () => void }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [items, setItems] = useState<MergedFileInfo[] | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

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
      const result = await s4mmToolsService.scanMergedPackages(modsPath);
      setItems(result.items);
      setFileCount(result.fileCount);
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Scan failed',
        message: error?.message || 'Unable to scan merged packages.',
        duration: 3500,
      });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void runScan();
  }, [runScan]);

  async function handleUnmergeAll(item: MergedFileInfo) {
    const destination = await pickFolder();
    if (!destination) return;

    setWorking(true);
    try {
      await s4mmToolsService.mergeAction('unmerge-all', `${item.path}/${item.name}`, destination);
      showToast({
        type: 'success',
        title: 'Extraction complete',
        message: `${item.packages.length} packages extracted to ${destination}.`,
        duration: 3500,
      });
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Extraction failed',
        message: error?.message || 'Unable to extract packages.',
        duration: 3500,
      });
    } finally {
      setWorking(false);
    }
  }

  async function handleExtractOne(item: MergedFileInfo, packageName: string) {
    const destination = await pickFolder();
    if (!destination) return;

    const pkg = item.packages.find((candidate) => candidate.name === packageName);
    if (!pkg) return;

    setWorking(true);
    try {
      await s4mmToolsService.mergeAction('extract', `${item.path}/${item.name}`, destination, [pkg]);
      showToast({
        type: 'success',
        title: 'Package extracted',
        message: `${pkg.name}.package saved to ${destination}.`,
        duration: 3500,
      });
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Extraction failed',
        message: error?.message || 'Unable to extract package.',
        duration: 3500,
      });
    } finally {
      setWorking(false);
    }
  }

  return (
    <S4mmPanelShell
      title="Merged packages"
      description="Finds Sims 4 Studio merged packages and extracts the original packages contained in them."
      onClose={onClose}
      loading={loading || working}
      actions={<S4mmActionButton onClick={() => void runScan()} disabled={loading}>Rescan</S4mmActionButton>}
    >
      {items && items.length === 0 && (
        <S4mmEmptyState message={`No merged packages found (${fileCount} files scanned).`} />
      )}

      <div className="space-y-2">
        {(items ?? []).map((item) => {
          const key = `${item.path}/${item.name}`;
          const isExpanded = expanded === key;
          return (
            <div key={key} className="rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}>
              <div className="flex items-center justify-between gap-4">
                <button className="min-w-0 text-left" onClick={() => setExpanded(isExpanded ? null : key)}>
                  <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {item.name}
                  </p>
                  <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {item.path} — {item.packages.length} packages inside
                  </p>
                </button>
                <S4mmActionButton tone="secondary" onClick={() => void handleUnmergeAll(item)} disabled={working}>
                  Extract all…
                </S4mmActionButton>
              </div>

              {isExpanded && (
                <div className="mt-3 space-y-1">
                  {item.packages.map((pkg) => (
                    <div
                      key={pkg.name}
                      className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm"
                      style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', color: 'var(--text-secondary)' }}
                    >
                      <span className="min-w-0 truncate">
                        {pkg.name} <span className="text-xs">({pkg.resources.length} resources)</span>
                      </span>
                      <S4mmActionButton
                        tone="secondary"
                        onClick={() => void handleExtractOne(item, pkg.name)}
                        disabled={working}
                      >
                        Extract…
                      </S4mmActionButton>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </S4mmPanelShell>
  );
}
