'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import {
  DISABLE_PACKS_SELECTION_KEY,
  disablePacksService,
} from '@/lib/services/DisablePacksService';
import { getCompatStorageItem, setCompatStorageItem } from '@/lib/utils/storageCompat';
import { ArrowClockwise, CheckCircle, Folder, GridFour, Trash, WarningCircle } from '@phosphor-icons/react';

const CATALOG = disablePacksService.getCatalog();

function getPackThumbnail(value: string): string {
  return `https://data.gametimedev.de/community/dlc/${value}.webp`;
}

export default function DisablePacksPanel({ onClose }: { onClose?: () => void }) {
  const { showToast } = useToast();
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [installedCodes, setInstalledCodes] = useState<Set<string>>(new Set<string>());
  const [loadingInstalled, setLoadingInstalled] = useState(true);
  const [isSavingUserSettings, setIsSavingUserSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<number | 'all'>('all');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const saved = getCompatStorageItem(DISABLE_PACKS_SELECTION_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSelectedCodes(parsed.filter((value) => typeof value === 'string'));
        }
      } catch {
        // Ignore malformed state.
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setCompatStorageItem(DISABLE_PACKS_SELECTION_KEY, JSON.stringify(selectedCodes));
  }, [selectedCodes]);

  useEffect(() => {
    void refreshInstalled();
  }, []);

  async function refreshInstalled() {
    setLoadingInstalled(true);
    try {
      const codes = await disablePacksService.getInstalledPackCodes();
      setInstalledCodes(codes);
    } finally {
      setLoadingInstalled(false);
    }
  }

  const selectedSet = useMemo(() => new Set(selectedCodes.map((code) => code.toUpperCase())), [selectedCodes]);
  const launchCommand = useMemo(() => disablePacksService.buildLaunchArguments(selectedCodes), [selectedCodes]);
  const userSettingsLine = useMemo(() => disablePacksService.buildUserSettingsLine(selectedCodes), [selectedCodes]);
  const visibleGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return CATALOG.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const matchesGroup = activeGroup === 'all' || group.id === activeGroup;
        const matchesQuery =
          !query ||
          item.name.toLowerCase().includes(query) ||
          item.value.toLowerCase().includes(query) ||
          group.name.toLowerCase().includes(query);
        return matchesGroup && matchesQuery;
      }),
    })).filter((group) => group.items.length > 0);
  }, [activeGroup, searchQuery]);

  function togglePack(code: string) {
    const normalized = code.toUpperCase();
    setSelectedCodes((current) =>
      current.includes(normalized) ? current.filter((value) => value !== normalized) : [...current, normalized]
    );
  }

  function selectInstalled() {
    setSelectedCodes(Array.from(installedCodes));
  }

  function clearSelection() {
    setSelectedCodes([]);
  }

  async function copyCommand() {
    if (!launchCommand) {
      return;
    }

    await navigator.clipboard.writeText(launchCommand);
    showToast({
      type: 'success',
      title: 'Command copied',
      message: 'Paste it into EA App Advanced Launch Options.',
      duration: 2500,
    });
  }

  async function applyUserSettings() {
    setIsSavingUserSettings(true);

    try {
      const result = await disablePacksService.writeUserSettings(selectedCodes);
      showToast({
        type: 'success',
        title: 'UserSettings updated',
        message: `${result.line} saved to ${result.path}`,
        duration: 4000,
      });
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Could not update UserSettings',
        message: error?.message || 'Unable to write the pack skip line.',
        duration: 5000,
      });
    } finally {
      setIsSavingUserSettings(false);
    }
  }

  return (
    <section
      className="rounded-[18px] border overflow-hidden"
      style={{
        backgroundColor: 'var(--ui-panel)',
        borderColor: 'var(--border-color)',
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b px-5 py-5" style={{ borderColor: 'var(--border-color)' }}>
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Disable packs
            </h2>
            <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: 'rgba(124, 242, 98, 0.16)', color: '#72efc4' }}>
              Ready
            </span>
          </div>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Select the packs you do not want to load, then copy the EA App launch argument.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
              style={{ backgroundColor: 'var(--ui-hover)', color: 'var(--text-primary)' }}
            >
              Close
            </button>
          )}
          <button
            onClick={refreshInstalled}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors"
            style={{ backgroundColor: 'var(--ui-hover)', color: 'var(--text-primary)' }}
          >
            <ArrowClockwise size={18} className={loadingInstalled ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-5 px-5 py-5 xl:grid-cols-[minmax(0,1.6fr)_360px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={selectInstalled}
              className="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
              style={{ backgroundColor: '#7cf262', color: '#111' }}
            >
              Select installed
            </button>
            <button
              onClick={clearSelection}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors"
              style={{ backgroundColor: 'var(--ui-hover)', color: 'var(--text-primary)' }}
            >
              <Trash size={16} />
              Clear
            </button>
            <div className="ml-auto flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <CheckCircle size={16} color="#72efc4" />
              {selectedCodes.length} selected
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search packs..."
              className="w-full rounded-full border px-4 py-3 text-sm outline-none"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              onClick={() => setActiveGroup('all')}
              className="rounded-full px-4 py-3 text-sm font-semibold transition-colors"
              style={{
                backgroundColor: activeGroup === 'all' ? '#7cf262' : 'var(--ui-hover)',
                color: activeGroup === 'all' ? '#111' : 'var(--text-primary)',
              }}
            >
              All groups
            </button>
          </div>

          <div className="space-y-4">
            {visibleGroups.map((group) => (
              <div key={group.id} className="rounded-[16px] border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                  <div>
                    <div className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {group.name}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {group.items.length} packs shown
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveGroup(group.id)}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                    style={{ backgroundColor: activeGroup === group.id ? '#7cf262' : 'var(--ui-hover)', color: activeGroup === group.id ? '#111' : 'var(--text-primary)' }}
                  >
                    Focus group
                  </button>
                </div>

                <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((item) => {
                    const code = item.value.toUpperCase();
                    const selected = selectedSet.has(code);
                    const installed = installedCodes.has(code);

                    return (
                      <button
                        key={code}
                        onClick={() => togglePack(code)}
                        className="group overflow-hidden rounded-[14px] border text-left transition-transform hover:-translate-y-0.5"
                        style={{
                          borderColor: selected ? '#7cf262' : 'var(--border-color)',
                          backgroundColor: selected ? 'rgba(124, 242, 98, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                        }}
                      >
                        <div className="relative aspect-square w-full overflow-hidden">
                          <img
                            src={getPackThumbnail(code)}
                            alt={item.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
                            <span className="rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white">
                              {code}
                            </span>
                            {installed && (
                              <span className="rounded-full bg-[#7cf262] px-2 py-0.5 text-[11px] font-semibold text-black">
                                Installed
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1 px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold leading-5" style={{ color: 'var(--text-primary)' }}>
                                {item.name}
                              </div>
                              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                EA App code
                              </div>
                            </div>
                            {selected && <CheckCircle size={18} color="#72efc4" weight="fill" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[16px] border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
            <div className="flex items-center gap-2">
              <Folder size={18} color="var(--text-secondary)" />
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {loadingInstalled ? 'Detecting installed packs...' : `${installedCodes.size} installed packs`}
              </div>
            </div>
            <p className="mt-2 text-sm leading-5" style={{ color: 'var(--text-secondary)' }}>
              CC Café uses the game installation folders to detect which packs exist on disk. The same pack codes are used for the EA App launch argument.
            </p>
          </div>

          <div className="rounded-[16px] border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
            <div className="flex items-center gap-2">
              <GridFour size={18} color="var(--text-secondary)" />
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                EA App command
              </div>
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Open EA App &gt; Library &gt; The Sims 4 &gt; View Properties &gt; Advanced launch options.
            </p>
            <div className="mt-3">
              <textarea
                readOnly
                value={launchCommand || 'Select packs to generate the command.'}
                rows={4}
                className="w-full resize-none rounded-2xl border px-3 py-3 text-sm outline-none"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <button
              onClick={copyCommand}
              disabled={!launchCommand}
              className="mt-3 w-full rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed"
              style={{
                backgroundColor: launchCommand ? '#7cf262' : 'var(--ui-hover)',
                color: launchCommand ? '#111' : 'var(--text-secondary)',
                opacity: launchCommand ? 1 : 0.7,
              }}
            >
              Copy command
            </button>
          </div>

          <div className="rounded-[16px] border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
            <div className="flex items-center gap-2">
              <Folder size={18} color="var(--text-secondary)" />
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                UserSettings.ini
              </div>
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              CC Café also supports writing the `packstoskipmount` line directly in the user settings file.
            </p>
            <div className="mt-3">
              <textarea
                readOnly
                value={userSettingsLine}
                rows={3}
                className="w-full resize-none rounded-2xl border px-3 py-3 text-sm outline-none"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <button
              onClick={applyUserSettings}
              disabled={isSavingUserSettings}
              className="mt-3 w-full rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed"
              style={{
                backgroundColor: isSavingUserSettings ? 'var(--ui-hover)' : '#7cf262',
                color: isSavingUserSettings ? 'var(--text-secondary)' : '#111',
                opacity: isSavingUserSettings ? 0.85 : 1,
              }}
            >
              {isSavingUserSettings ? 'Saving...' : selectedCodes.length > 0 ? 'Write UserSettings.ini' : 'Clear skip line'}
            </button>
          </div>

          <div className="rounded-[16px] border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
            <div className="flex items-center gap-2">
              <WarningCircle size={18} color="#f59e0b" />
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                What this does
              </div>
            </div>
            <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              These packs stay installed. The launcher argument tells the game to skip mounting them for that launch, which matches the current EA App method.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
