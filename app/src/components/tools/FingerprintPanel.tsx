'use client';

import { useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { filesystemToolsService } from '@/lib/services/FilesystemToolsService';
import { getCurseForgeApiKey } from '@/lib/curseforgeApi';
import {
  s4mmToolsService,
  type FingerprintMatch,
  type FingerprintedFile,
} from '@/lib/services/S4mmToolsService';
import S4mmPanelShell, { S4mmActionButton, S4mmEmptyState } from './S4mmPanelShell';

interface MatchedRow {
  file: FingerprintedFile;
  match: FingerprintMatch | null;
}

export default function FingerprintPanel({ onClose }: { onClose?: () => void }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [rows, setRows] = useState<MatchedRow[] | null>(null);
  const [showOnlyMatched, setShowOnlyMatched] = useState(true);

  async function runScan() {
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

    const apiKey = await getCurseForgeApiKey();
    if (!apiKey) {
      showToast({
        type: 'error',
        title: 'CurseForge API key missing',
        message: 'Configure your CurseForge API key in Settings first.',
        duration: 3500,
      });
      return;
    }

    setLoading(true);
    setRows(null);
    try {
      setProgressText('Computing fingerprints…');
      const scan = await s4mmToolsService.scanFingerprints(modsPath);

      setProgressText(`Matching ${scan.files.length} fingerprints against CurseForge…`);
      const fingerprints = scan.files.map((file) => file.fingerprint);
      const matchResult = await s4mmToolsService.matchFingerprints(apiKey, fingerprints);

      const matchMap = new Map(matchResult.matches.map((match) => [match.fingerprint, match]));
      setRows(
        scan.files.map((file) => ({
          file,
          match: matchMap.get(file.fingerprint) ?? null,
        }))
      );

      showToast({
        type: 'success',
        title: 'Fingerprint match complete',
        message: `${matchResult.matches.length} of ${scan.files.length} files identified on CurseForge.`,
        duration: 3500,
      });
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Fingerprint scan failed',
        message: error?.message || 'Unable to fingerprint files.',
        duration: 3500,
      });
    } finally {
      setLoading(false);
      setProgressText('');
    }
  }

  const visibleRows = (rows ?? []).filter((row) => !showOnlyMatched || row.match);

  return (
    <S4mmPanelShell
      title="CurseForge fingerprint matcher"
      description="Computes CurseForge fingerprints for local files and identifies which mods they belong to, even after renaming."
      onClose={onClose}
      loading={loading}
      actions={<S4mmActionButton onClick={() => void runScan()} disabled={loading}>Scan & match</S4mmActionButton>}
    >
      {progressText && (
        <p className="mb-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {progressText}
        </p>
      )}

      {rows && (
        <div className="mb-4 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
            <input
              type="checkbox"
              checked={showOnlyMatched}
              onChange={(event) => setShowOnlyMatched(event.target.checked)}
            />
            Show only matched files
          </label>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {rows.filter((row) => row.match).length} matched / {rows.length} files
          </span>
        </div>
      )}

      {rows && visibleRows.length === 0 && <S4mmEmptyState message="No files to show." />}

      <div className="space-y-2">
        {visibleRows.map((row) => (
          <div
            key={`${row.file.path}/${row.file.name}`}
            className="flex items-center justify-between gap-4 rounded-xl px-4 py-3"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {row.file.name}
              </p>
              <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                {row.match ? `CurseForge: ${row.match.displayName} (mod ${row.match.modId})` : row.file.path}
              </p>
            </div>
            <span
              className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
              style={
                row.match
                  ? { backgroundColor: 'rgba(70, 200, 155, 0.18)', color: '#72efc4' }
                  : { backgroundColor: 'var(--ui-hover)', color: 'var(--text-secondary)' }
              }
            >
              {row.match ? 'Matched' : 'Unknown'}
            </span>
          </div>
        ))}
      </div>
    </S4mmPanelShell>
  );
}
