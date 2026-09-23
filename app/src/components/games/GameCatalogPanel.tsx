'use client';

import { useState } from 'react';
import { ArrowSquareOut, FolderOpen, Spinner } from '@phosphor-icons/react';
import { useGame } from '@/context/GameContext';
import { contentPathKey, readStoredContentRoot, type ContentPathGame } from '@/lib/gameContentPaths';

interface GameContentItem {
  name: string;
  path: string;
  kind: 'modkit' | 'pak' | 'canvas' | 'mod-folder' | 'printer' | 'package';
}

const KIND_LABEL: Record<GameContentItem['kind'], string> = {
  modkit: 'ModKit',
  pak: 'Pak',
  canvas: 'Canvas',
  'mod-folder': 'Mod folder',
  printer: '3D Printer',
  package: 'Package',
};

export default function GameCatalogPanel() {
  const { game } = useGame();
  const [scanning, setScanning] = useState(false);
  const [roots, setRoots] = useState<string[]>([]);
  const [items, setItems] = useState<GameContentItem[] | null>(null);
  const [error, setError] = useState('');

  async function openLink(url: string) {
    await window.electron.ipcRenderer.invoke('shell:openExternal', url);
  }

  async function scan() {
    setScanning(true);
    setError('');
    try {
      const contentRoot = contentPathKey(game.id)
        ? await readStoredContentRoot(game.id as ContentPathGame)
        : '';
      const result = await window.electron.ipcRenderer.invoke('games:scan-content', {
        gameId: game.id,
        contentRoot: contentRoot || undefined,
      });
      if (result && result.success === false) {
        throw new Error(result.error || 'Scan failed');
      }
      setRoots(result.roots ?? []);
      setItems(result.items ?? []);
    } catch (scanError: unknown) {
      setError(scanError instanceof Error ? scanError.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 pb-12">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="rounded-lg border border-white/10 bg-neutral-900 p-8">
          <div className="text-sm font-bold uppercase tracking-wide text-brand-green">{game.name}</div>
          <h2 className="mt-2 text-4xl font-bold text-white">{game.name} in CC Café</h2>
          <p className="mt-3 max-w-2xl text-neutral-400">{game.summary}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {game.catalogs.map((catalog) => (
              <button
                key={catalog.url}
                type="button"
                onClick={() => void openLink(catalog.url)}
                className="inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-2.5 font-bold text-black hover:bg-brand-dark cursor-pointer"
              >
                <ArrowSquareOut size={18} />
                {catalog.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void scan()}
              disabled={scanning}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 font-bold text-white hover:bg-white/20 disabled:opacity-50 cursor-pointer"
            >
              {scanning ? <Spinner size={18} className="animate-spin" /> : <FolderOpen size={18} />}
              {scanning ? 'Scanning' : 'Scan installed content'}
            </button>
          </div>
        </div>

        {error ? <div className="rounded-lg border border-red-500/40 px-5 py-4 text-red-300">{error}</div> : null}

        {items ? (
          <div className="overflow-hidden rounded-lg border border-white/10 bg-neutral-900">
            <div className="border-b border-white/10 px-5 py-4">
              <div className="font-bold text-white">{items.length} installed</div>
              <div className="mt-1 truncate text-xs text-neutral-500">{roots.join(' · ')}</div>
            </div>
            {items.length === 0 ? (
              <div className="px-5 py-8 text-neutral-400">
                Nothing was found for {game.name}. Set the folder in Settings, or install the game once so the usual folders exist.
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {items.map((item) => (
                  <div key={item.path} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-white">{item.name}</div>
                      <div className="truncate text-xs text-neutral-500">{item.path}</div>
                    </div>
                    <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-neutral-300">
                      {KIND_LABEL[item.kind]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
