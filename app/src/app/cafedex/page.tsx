'use client';

import { useEffect, useMemo, useState } from 'react';
import { Notebook, Spinner, Warning } from '@phosphor-icons/react';
import Layout from '@/components/layouts/Layout';
import { useGame } from '@/context/GameContext';
import { useToast } from '@/context/ToastContext';
import { cafeDexKey, type CafeDexEntry, type CafeDexSighting } from '@/lib/cafeDex';
import { readStoredContentRoot, type ContentPathGame } from '@/lib/gameContentPaths';
import { filesystemToolsService } from '@/lib/services/FilesystemToolsService';
import { s4mmToolsService } from '@/lib/services/S4mmToolsService';

type CafeDexFilter = 'all' | 'broken' | 'notes' | 'missing';

function assertList(result: CafeDexEntry[] | { success?: boolean; error?: string }): CafeDexEntry[] {
  if (result && !Array.isArray(result) && result.success === false) {
    throw new Error(result.error || 'CafeDex failed');
  }
  return result as CafeDexEntry[];
}

export default function CafeDexPage() {
  return (
    <Layout>
      <CafeDexPanel />
    </Layout>
  );
}

function CafeDexPanel() {
  const { game } = useGame();
  const { showToast } = useToast();
  const [entries, setEntries] = useState<CafeDexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState<CafeDexFilter>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    window.electron.ipcRenderer
      .invoke('cafedex:list', { gameId: game.id })
      .then((result) => {
        if (!cancelled) setEntries(assertList(result));
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [game.id]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (filter === 'broken' && !entry.broken) return false;
      if (filter === 'notes' && !entry.note.trim()) return false;
      if (filter === 'missing' && !entry.missing) return false;
      if (!needle) return true;
      return entry.name.toLowerCase().includes(needle) || entry.note.toLowerCase().includes(needle);
    });
  }, [entries, filter, query]);

  const brokenCount = entries.filter((entry) => entry.broken).length;

  async function scan() {
    setScanning(true);
    try {
      const sightings = await collectSightings(game.id);
      const result = await window.electron.ipcRenderer.invoke('cafedex:sync', {
        gameId: game.id,
        sightings,
      });
      setEntries(assertList(result));
      showToast({
        type: 'success',
        title: 'CafeDex updated',
        message: `${sightings.length} mods recorded for ${game.name}.`,
        duration: 2500,
      });
    } catch (error: unknown) {
      showToast({
        type: 'error',
        title: 'CafeDex scan failed',
        message: error instanceof Error ? error.message : 'Unable to scan.',
        duration: 4000,
      });
    } finally {
      setScanning(false);
    }
  }

  async function save(entry: CafeDexEntry, patch: { broken?: boolean; note?: string }) {
    const result = await window.electron.ipcRenderer.invoke('cafedex:update', {
      gameId: game.id,
      key: entry.key,
      ...patch,
    });
    setEntries(assertList(result));
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 pb-12">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="rounded-lg border border-white/10 bg-neutral-900 p-8">
          <div className="text-sm font-bold uppercase tracking-wide text-brand-green">CafeDex</div>
          <h2 className="mt-2 text-4xl font-bold text-white">Your mod record</h2>
          <p className="mt-3 max-w-2xl text-neutral-400">
            CafeDex remembers the mods in this scan, which ones you marked broken, and the note you wrote. The files stay in the game folder.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void scan()}
              disabled={scanning}
              className="inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-2.5 font-bold text-black hover:bg-brand-dark disabled:opacity-50 cursor-pointer"
            >
              {scanning ? <Spinner size={18} className="animate-spin" /> : <Notebook size={18} />}
              {scanning ? 'Scanning' : 'Scan into CafeDex'}
            </button>
            <div className="text-sm text-neutral-400">
              {entries.length} recorded · {brokenCount} broken
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ['all', 'All'],
              ['broken', 'Broken'],
              ['notes', 'With notes'],
              ['missing', 'Missing from scan'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold cursor-pointer ${
                filter === id ? 'bg-white text-black' : 'bg-white/10 text-white'
              }`}
            >
              {label}
            </button>
          ))}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or note"
            className="min-w-48 flex-1 rounded-full border border-white/10 bg-neutral-900 px-4 py-1.5 text-sm text-white outline-none"
          />
        </div>

        <div className="overflow-hidden rounded-lg border border-white/10 bg-neutral-900">
          {loading ? (
            <div className="px-5 py-8 text-neutral-400">Loading CafeDex…</div>
          ) : visible.length === 0 ? (
            <div className="px-5 py-8 text-neutral-400">
              {entries.length === 0
                ? `Scan ${game.name} to start the record.`
                : 'Nothing matches this filter.'}
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {visible.map((entry) => (
                <CafeDexRow key={entry.key} entry={entry} onSave={save} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CafeDexRow({
  entry,
  onSave,
}: {
  entry: CafeDexEntry;
  onSave: (entry: CafeDexEntry, patch: { broken?: boolean; note?: string }) => Promise<void>;
}) {
  const [note, setNote] = useState(entry.note);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNote(entry.note);
  }, [entry.note]);

  async function commit(patch: { broken?: boolean; note?: string }) {
    setSaving(true);
    try {
      await onSave(entry, patch);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {entry.broken ? <Warning size={16} className="shrink-0 text-amber-400" /> : null}
            <div className="truncate font-semibold text-white">{entry.name}</div>
          </div>
          <div className="truncate text-xs text-neutral-500">{entry.path}</div>
          {entry.missing ? <div className="mt-1 text-xs text-amber-400">Not in the last scan</div> : null}
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={entry.broken}
            onChange={(event) => void commit({ broken: event.target.checked })}
          />
          Broken
        </label>
      </div>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        onBlur={() => {
          if (note !== entry.note) void commit({ note });
        }}
        rows={2}
        placeholder="Note"
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
      />
      {saving ? <div className="text-xs text-neutral-500">Saving…</div> : null}
    </div>
  );
}

async function collectSightings(gameId: string): Promise<CafeDexSighting[]> {
  if (gameId === 'sims4') {
    const root = await filesystemToolsService.getModsPath();
    if (!root) {
      throw new Error('Set your Sims 4 Mods folder in Settings first.');
    }
    const scan = await s4mmToolsService.scanFingerprints(root);
    return scan.files.map((file) => ({
      key: cafeDexKey(file),
      name: file.name,
      path: file.path,
      fingerprint: file.fingerprint,
    }));
  }

  const contentRoot = await readStoredContentRoot(gameId as ContentPathGame);
  const result = await window.electron.ipcRenderer.invoke('games:scan-content', {
    gameId,
    contentRoot: contentRoot || undefined,
  });
  if (result && result.success === false) {
    throw new Error(result.error || 'Scan failed');
  }
  const items = (result.items ?? []) as { name: string; path: string }[];
  return items.map((item) => ({
    key: cafeDexKey({ path: item.path }),
    name: item.name,
    path: item.path,
    fingerprint: null,
  }));
}
