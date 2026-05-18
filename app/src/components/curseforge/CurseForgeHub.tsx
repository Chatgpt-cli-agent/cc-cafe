'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowsClockwise, Broom, CheckCircle, DownloadSimple, Pause, Play, Spinner, WarningCircle } from '@phosphor-icons/react';
import ModList from '@/components/mod/ModList';
import FilterBar from '@/components/mod/FilterBar';
import { searchCurseForgeMods } from '@/lib/curseforgeApi';
import { modInstallationService } from '@/lib/services/ModInstallationService';
import { useProfiles } from '@/context/ProfileContext';
import { useToast } from '@/context/ToastContext';
import { useUpdates } from '@/context/UpdateContext';
import { CurseForgeAuthor, CurseForgeMod } from '@/types/curseforge';
import { ViewMode } from '@/hooks/useViewMode';
import { formatFileSize, formatRelativeDate } from '@/utils/formatters';
import { getCompatStorageItem, setCompatStorageItem } from '@/lib/utils/storageCompat';
import { BRANDING } from '@/lib/branding';

type HubTab = 'home' | 'browse' | 'creators' | 'downloads' | 'updates';
type SortOption = 'downloads' | 'date' | 'trending' | 'relevance';
type FilterChip = 'all' | 'updates' | 'early-access' | 'installed';

interface CurseForgeHubProps {
  searchQuery: string;
  sortBy: SortOption;
  category: string;
  viewMode: ViewMode;
  activeFilter: FilterChip;
  scrollIndex: number;
  onSortChange: (sort: SortOption) => void;
  onFilterChange: (filter: FilterChip) => void;
  onCategoryChange: (category: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
}

interface FollowedCreator {
  id: number;
  name: string;
}

type DownloadStatus = 'pending' | 'downloading' | 'installing' | 'complete' | 'failed';

interface DownloadRecord {
  id: string;
  modId: number;
  modName: string;
  creatorName: string;
  logo: string | null;
  status: DownloadStatus;
  progress: number;
  message: string;
  error?: string;
}

const FOLLOWED_CREATORS_KEY = 'cccafe_followed_creators';
const DEFAULT_FOLLOWED_CREATORS: FollowedCreator[] = [{ id: 103907262, name: 'lot51' }];

const StorageHelper = {
  async decryptData(encryptedData: string, password: string = 'cccafe-settings'): Promise<string | null> {
    try {
      const encoder = new TextEncoder();
      const passwordEncoded = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', passwordEncoded);
      const key = await crypto.subtle.importKey('raw', hashBuffer, 'AES-GCM', false, ['decrypt']);
      const binaryString = atob(encryptedData);
      const combined = new Uint8Array(binaryString.length);
      for (let i = 0; i < combined.length; i++) {
        combined[i] = binaryString.charCodeAt(i);
      }
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: combined.slice(0, 12) },
        key,
        combined.slice(12)
      );
      return new TextDecoder().decode(decrypted);
    } catch {
      return null;
    }
  },
};

function readFollowedCreators(): FollowedCreator[] {
  if (typeof window === 'undefined') return [];
  const stored = getCompatStorageItem(FOLLOWED_CREATORS_KEY);
  if (stored === null) {
    return DEFAULT_FOLLOWED_CREATORS;
  }
  try {
    const parsed = JSON.parse(stored || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFollowedCreators(creators: FollowedCreator[]) {
  setCompatStorageItem(FOLLOWED_CREATORS_KEY, JSON.stringify(creators));
}

function pushCreatorRoute(creator: FollowedCreator) {
  window.history.pushState(null, '', `/?tab=creators&creatorId=${creator.id}&creatorName=${encodeURIComponent(creator.name)}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function CompactModCard({ mod }: { mod: CurseForgeMod }) {
  const author = mod.authors[0];

  return (
    <div className="min-w-[220px] max-w-[220px]">
      <Link href={`/mods?id=${mod.id}`} className="block group">
        <div className="aspect-square rounded-lg overflow-hidden bg-neutral-900">
          {mod.logo ? (
            <Image
              src={mod.logo}
              alt={mod.name}
              width={220}
              height={220}
              unoptimized
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-4xl text-neutral-500">?</div>
          )}
        </div>
        <div className="mt-3">
          <div className="truncate text-sm font-semibold text-white">{mod.name}</div>
          <button
            type="button"
            className="truncate text-sm text-neutral-400 underline hover:text-brand-green cursor-pointer"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (author) pushCreatorRoute(author);
            }}
          >
            by {author?.name || 'Unknown'}
          </button>
        </div>
      </Link>
    </div>
  );
}

function Section({ title, mods }: { title: string; mods: CurseForgeMod[] }) {
  return (
    <section className="mt-10">
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      <div className="mt-3 border-t border-white/10 pt-4 flex gap-5 overflow-x-auto pb-3">
        {mods.map((mod) => (
          <CompactModCard key={mod.id} mod={mod} />
        ))}
      </div>
    </section>
  );
}

export default function CurseForgeHub({
  searchQuery,
  sortBy,
  category,
  viewMode,
  activeFilter,
  scrollIndex,
  onSortChange,
  onFilterChange,
  onCategoryChange,
  onViewModeChange,
}: CurseForgeHubProps) {
  const { activeProfile, refreshProfiles } = useProfiles();
  const { showToast, updateToast } = useToast();
  const {
    availableUpdates,
    updateCount,
    isChecking,
    isUpdating,
    lastCheckTime,
    checkForUpdates,
    updateMod,
    updateAllMods,
  } = useUpdates();
  const [activeTab, setActiveTab] = useState<HubTab>('home');
  const [popularMods, setPopularMods] = useState<CurseForgeMod[]>([]);
  const [recentMods, setRecentMods] = useState<CurseForgeMod[]>([]);
  const [creatorMods, setCreatorMods] = useState<CurseForgeMod[]>([]);
  const [selectedCreator, setSelectedCreator] = useState<FollowedCreator | null>(null);
  const [followedCreators, setFollowedCreators] = useState<FollowedCreator[]>([]);
  const [isLoadingHome, setIsLoadingHome] = useState(false);
  const [isLoadingCreator, setIsLoadingCreator] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [isQueuePaused, setIsQueuePaused] = useState(false);
  const [downloadRecords, setDownloadRecords] = useState<DownloadRecord[]>([]);
  const isQueuePausedRef = useRef(false);

  useEffect(() => {
    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab') as HubTab | null;
      const creatorId = Number(params.get('creatorId'));
      const creatorName = params.get('creatorName');
      setActiveTab(tab && ['home', 'browse', 'creators', 'downloads', 'updates'].includes(tab) ? tab : 'home');
      setSelectedCreator(
        Number.isInteger(creatorId) && creatorId > 0 && creatorName
          ? { id: creatorId, name: creatorName }
          : null
      );
    };

    setFollowedCreators(readFollowedCreators());
    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  useEffect(() => {
    const loadHome = async () => {
      setIsLoadingHome(true);
      try {
        const [popular, recent] = await Promise.all([
          searchCurseForgeMods({ pageSize: 8, pageIndex: 0, sortBy: 'popularity' }),
          searchCurseForgeMods({ pageSize: 8, pageIndex: 0, sortBy: 'date' }),
        ]);
        setPopularMods(popular.mods);
        setRecentMods(recent.mods);
      } finally {
        setIsLoadingHome(false);
      }
    };

    loadHome().catch((error) => console.error('[CurseForgeHub] Failed to load home:', error));
  }, []);

  useEffect(() => {
    if (!selectedCreator) {
      setCreatorMods([]);
      return;
    }

    const loadCreator = async () => {
      setIsLoadingCreator(true);
      try {
        const result = await searchCurseForgeMods({
          authorId: selectedCreator.id,
          pageSize: 50,
          pageIndex: 0,
          sortBy: 'popularity',
        });
        setCreatorMods(result.mods);
      } finally {
        setIsLoadingCreator(false);
      }
    };

    loadCreator().catch((error) => console.error('[CurseForgeHub] Failed to load creator:', error));
  }, [selectedCreator]);

  const creators = useMemo(() => {
    const map = new Map<number, CurseForgeAuthor>();
    [...popularMods, ...recentMods, ...creatorMods].forEach((mod) => {
      mod.authors.forEach((author) => map.set(author.id, author));
    });
    followedCreators.forEach((creator) => map.set(creator.id, creator));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [popularMods, recentMods, creatorMods, followedCreators]);

  const isFollowingSelectedCreator = selectedCreator
    ? followedCreators.some((creator) => creator.id === selectedCreator.id)
    : false;

  const setTab = (tab: HubTab) => {
    window.history.pushState(null, '', tab === 'home' ? '/' : `/?tab=${tab}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const toggleFollowCreator = (creator: FollowedCreator) => {
    const next = followedCreators.some((item) => item.id === creator.id)
      ? followedCreators.filter((item) => item.id !== creator.id)
      : [...followedCreators, creator];
    setFollowedCreators(next);
    writeFollowedCreators(next);
  };

  const getModsPath = async () => {
    const encryptedModsPath = getCompatStorageItem('cccafe_mods_path');
    if (!encryptedModsPath) return null;
    return StorageHelper.decryptData(encryptedModsPath);
  };

  const downloadAllCreatorMods = async () => {
    if (!selectedCreator || creatorMods.length === 0 || isDownloadingAll) return;

    const modsPath = await getModsPath();
    if (!modsPath) {
      showToast({
        type: 'error',
        title: 'Mods folder not configured',
        message: 'Set your Sims 4 Mods folder in Settings first.',
        duration: 3500,
      });
      return;
    }

    setIsDownloadingAll(true);
    setActiveTab('downloads');
    window.history.pushState(null, '', '/?tab=downloads');
    const queuedRecords = creatorMods.map((mod) => ({
      id: `${mod.id}-${Date.now()}`,
      modId: mod.id,
      modName: mod.name,
      creatorName: selectedCreator.name,
      logo: mod.logo,
      status: activeProfile?.mods.some((profileMod) => profileMod.modId === mod.id) ? 'complete' as const : 'pending' as const,
      progress: activeProfile?.mods.some((profileMod) => profileMod.modId === mod.id) ? 100 : 0,
      message: activeProfile?.mods.some((profileMod) => profileMod.modId === mod.id) ? 'Already installed' : 'Queued',
    }));
    setDownloadRecords((records) => [...queuedRecords, ...records.filter((record) => record.status === 'complete' || record.status === 'failed')]);

    const toastId = showToast({
      type: 'download',
      title: `Brewing ${selectedCreator.name}`,
      message: `0 of ${creatorMods.length} mods installed`,
      progress: 0,
      duration: 0,
    });

    let installed = 0;
    let failed = 0;

    for (const mod of creatorMods) {
      const alreadyInstalled = activeProfile?.mods.some((profileMod) => profileMod.modId === mod.id);
      if (alreadyInstalled) {
        installed++;
        continue;
      }

      try {
        while (isQueuePausedRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        setDownloadRecords((records) => records.map((record) => record.modId === mod.id ? {
          ...record,
          status: 'downloading',
          progress: 1,
          message: 'Starting download',
        } : record));

        await modInstallationService.installMod(mod.id, modsPath, (progress) => {
          const baseProgress = (installed / creatorMods.length) * 100;
          const itemProgress = progress.percent / creatorMods.length;
          setDownloadRecords((records) => records.map((record) => record.modId === mod.id ? {
            ...record,
            status: progress.stage === 'installing' || progress.stage === 'extracting' ? 'installing' : 'downloading',
            progress: progress.percent,
            message: progress.message,
          } : record));
          updateToast(toastId, {
            message: `${installed + 1} of ${creatorMods.length}: ${progress.message}`,
            progress: Math.min(99, Math.round(baseProgress + itemProgress)),
          });
        });
        installed++;
        setDownloadRecords((records) => records.map((record) => record.modId === mod.id ? {
          ...record,
          status: 'complete',
          progress: 100,
          message: 'Installed',
        } : record));
        await refreshProfiles();
      } catch (error) {
        failed++;
        setDownloadRecords((records) => records.map((record) => record.modId === mod.id ? {
          ...record,
          status: 'failed',
          progress: 100,
          message: 'Failed',
          error: error instanceof Error ? error.message : String(error),
        } : record));
        console.error(`[CurseForgeHub] Failed to install ${mod.name}:`, error);
      }
    }

    updateToast(toastId, {
      type: failed > 0 ? 'info' : 'success',
      title: failed > 0 ? 'Brewing finished with errors' : 'Brewing complete',
      message: `${installed} installed${failed > 0 ? `, ${failed} failed` : ''}.`,
      progress: 100,
      duration: 5000,
    });
    setIsDownloadingAll(false);
  };

  const toggleQueuePaused = (paused: boolean) => {
    isQueuePausedRef.current = paused;
    setIsQueuePaused(paused);
  };

  const clearDownloadRecords = () => {
    setDownloadRecords((records) => records.filter((record) => record.status === 'downloading' || record.status === 'installing'));
  };

  const activeDownload = downloadRecords.find((record) => record.status === 'downloading' || record.status === 'installing');
  const pendingCount = downloadRecords.filter((record) => record.status === 'pending').length;
  const completedCount = downloadRecords.filter((record) => record.status === 'complete').length;
  const failedCount = downloadRecords.filter((record) => record.status === 'failed').length;
  const updateRows = useMemo(() => {
    if (!activeProfile) return [];
    return Array.from(availableUpdates.values())
      .map((update) => ({
        update,
        mod: activeProfile.mods.find((profileMod) => profileMod.modId === update.modId),
      }))
      .filter((row) => Boolean(row.mod));
  }, [activeProfile, availableUpdates]);

  const tabs: Array<{ id: HubTab; label: string }> = [
    { id: 'home', label: BRANDING.curseforge.home },
    { id: 'browse', label: BRANDING.curseforge.browse },
    { id: 'creators', label: BRANDING.curseforge.creatorMenu },
    { id: 'downloads', label: BRANDING.curseforge.orders },
    { id: 'updates', label: BRANDING.curseforge.freshBatch },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <div className="px-8 pt-7 pb-4">
        <h1 className="text-3xl font-bold text-white">CurseForge</h1>
        <div className="mt-5 inline-flex rounded-full bg-white/5 p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={`px-7 py-2.5 rounded-full text-sm font-bold transition-colors cursor-pointer ${
                activeTab === tab.id ? 'bg-brand-green text-black' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'browse' && (
        <>
          <FilterBar
            onSortChange={onSortChange}
            activeSort={sortBy}
            onFilterChange={onFilterChange}
            activeFilter={activeFilter}
            onCategoryChange={onCategoryChange}
            selectedCategory={category}
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
          />
          <ModList
            searchQuery={searchQuery}
            sortBy={sortBy}
            category={category}
            viewMode={viewMode}
            activeFilter={activeFilter}
            scrollIndex={scrollIndex}
          />
        </>
      )}

      {activeTab === 'home' && (
        <div className="flex-1 overflow-y-auto px-8 pb-12">
          <div className="mt-4 min-h-48 flex items-center justify-center rounded-lg bg-neutral-950">
            <div className="text-7xl font-bold tracking-tight text-white">curseforge</div>
          </div>
          {isLoadingHome ? (
            <div className="py-12 flex justify-center text-neutral-400"><Spinner className="animate-spin" size={32} /></div>
          ) : (
            <>
          {followedCreators.length > 0 && (
                <section className="mt-8">
                  <h2 className="text-xl font-bold text-white">{BRANDING.curseforge.favoritesMenu}</h2>
                  <div className="mt-3 flex gap-3 flex-wrap">
                    {followedCreators.map((creator) => (
                      <button
                        type="button"
                        key={creator.id}
                        onClick={() => pushCreatorRoute(creator)}
                        className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10 cursor-pointer"
                      >
                        <div className="text-sm text-neutral-400">{BRANDING.curseforge.baristas}</div>
                        <div className="font-bold text-white">{creator.name}</div>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <Section title="Fresh Picks" mods={popularMods} />
              <Section title={BRANDING.curseforge.recentUpdates} mods={recentMods} />
            </>
          )}
        </div>
      )}

      {activeTab === 'creators' && (
        <div className="flex-1 overflow-y-auto px-8 pb-12">
          {selectedCreator ? (
            <>
              <button
                type="button"
                onClick={() => setTab('creators')}
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm font-bold text-neutral-300 hover:text-white cursor-pointer"
              >
                <ArrowLeft size={18} /> Go Back
              </button>
              <div className="mt-5 flex items-center gap-8 border-b border-white/10 pb-8">
                <div className="h-32 w-32 rounded-full border-2 border-white bg-neutral-500 flex items-center justify-center text-5xl font-bold text-white">
                  {selectedCreator.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-neutral-400">{BRANDING.curseforge.baristas}</div>
                  <h2 className="text-4xl font-bold text-white">{selectedCreator.name}</h2>
                  <div className="mt-3 flex gap-3">
                    <button
                      type="button"
                      onClick={() => toggleFollowCreator(selectedCreator)}
                      className="rounded-full bg-brand-green px-6 py-2 font-bold text-black hover:bg-brand-dark cursor-pointer"
                    >
                      {isFollowingSelectedCreator ? BRANDING.curseforge.favoritedAction : BRANDING.curseforge.favoriteAction}
                    </button>
                    <button
                      type="button"
                      onClick={downloadAllCreatorMods}
                      disabled={isDownloadingAll || creatorMods.length === 0}
                      className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2 font-bold text-white hover:bg-white/20 disabled:opacity-50 cursor-pointer"
                    >
                      {isDownloadingAll ? <Spinner size={18} className="animate-spin" /> : <DownloadSimple size={18} />}
                      {BRANDING.curseforge.orderAll}
                    </button>
                  </div>
                </div>
              </div>
              {isLoadingCreator ? (
                <div className="py-12 flex justify-center text-neutral-400"><Spinner className="animate-spin" size={32} /></div>
              ) : (
                <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-5">
                  {creatorMods.map((mod) => <CompactModCard key={mod.id} mod={mod} />)}
                </div>
              )}
            </>
          ) : (
            <div className="mt-4">
              <h2 className="text-xl font-bold text-white">{BRANDING.curseforge.creatorMenu}</h2>
              <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
                {creators.map((creator) => (
                  <button
                    type="button"
                    key={creator.id}
                    onClick={() => pushCreatorRoute(creator)}
                    className="rounded-lg border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10 cursor-pointer"
                  >
                    <div className="text-sm text-neutral-400">{BRANDING.curseforge.baristas}</div>
                    <div className="mt-1 text-lg font-bold text-white">{creator.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'downloads' && (
        <div className="flex-1 overflow-y-auto px-8 pb-12">
          <div className="mx-auto max-w-5xl">
            <div className="relative overflow-hidden rounded-lg bg-neutral-900 min-h-64 border border-white/5">
              <div className="absolute -bottom-24 left-10 h-80 w-[88%] rounded-[50%] bg-brand-green/55 blur-sm" />
              <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 via-neutral-900/80 to-neutral-900/40" />
              <div className="relative z-10 flex h-64 items-center justify-center">
                <div className="rounded-lg bg-neutral-800/95 px-8 py-4 text-lg font-bold text-neutral-200 shadow-xl">
                  {activeDownload
                    ? `${BRANDING.downloads.downloadingContent} ${activeDownload.modName} - ${activeDownload.progress}%`
                    : isQueuePaused
                    ? 'Brewing paused'
                      : 'No active downloads'}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => toggleQueuePaused(true)}
                disabled={isQueuePaused || !isDownloadingAll}
                className="inline-flex items-center justify-center gap-3 rounded-lg bg-white/5 py-4 font-bold text-neutral-300 hover:bg-white/10 disabled:opacity-40 cursor-pointer"
              >
                <Pause size={22} /> Pause {BRANDING.downloads.queue.toLowerCase()}
              </button>
              <button
                type="button"
                onClick={() => toggleQueuePaused(false)}
                disabled={!isQueuePaused}
                className="inline-flex items-center justify-center gap-3 rounded-lg bg-white/5 py-4 font-bold text-neutral-300 hover:bg-white/10 disabled:opacity-40 cursor-pointer"
              >
                <Play size={22} /> Resume {BRANDING.downloads.queue.toLowerCase()}
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-lg bg-neutral-900 border border-white/5">
              <div className="border-b-2 border-brand-green px-5 py-4 text-center font-bold text-white">
                {isQueuePaused ? `Resume ${BRANDING.downloads.queue.toLowerCase()}` : activeDownload ? BRANDING.downloads.brewing : BRANDING.downloads.queue}
              </div>
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <div className="text-lg text-neutral-300">
                    {downloadRecords.length === 0
                      ? 'There are no items in your brewing queue'
                      : `${pendingCount} pending, ${completedCount} complete${failedCount > 0 ? `, ${failedCount} failed` : ''}`}
                  </div>
                  {activeProfile?.mods.length ? (
                    <div className="mt-1 text-sm text-neutral-500">
                      {activeProfile.mods.length} mods installed in the active profile
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={clearDownloadRecords}
                  disabled={downloadRecords.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 font-bold text-neutral-400 hover:bg-white/10 disabled:opacity-40 cursor-pointer"
                >
                  <Broom size={20} /> Clear queue
                </button>
              </div>
            </div>

            {downloadRecords.length > 0 && (
              <div className="mt-5 space-y-3">
                {downloadRecords.map((record) => (
                  <div key={record.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-neutral-800">
                        {record.logo ? (
                          <Image src={record.logo} alt={record.modName} width={56} height={56} unoptimized className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold text-white">{record.modName}</div>
                        <div className="truncate text-sm text-neutral-400">{record.creatorName} - {record.message}</div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-800">
                          <div
                            className={`h-full rounded-full ${record.status === 'failed' ? 'bg-red-500' : 'bg-brand-green'}`}
                            style={{ width: `${record.progress}%` }}
                          />
                        </div>
                        {record.error ? <div className="mt-2 text-xs text-red-300">{record.error}</div> : null}
                      </div>
                      <div className="w-28 text-right text-sm font-bold">
                        {record.status === 'complete' ? (
                          <span className="inline-flex items-center gap-1 text-brand-green"><CheckCircle size={18} /> Done</span>
                        ) : record.status === 'failed' ? (
                          <span className="inline-flex items-center gap-1 text-red-400"><WarningCircle size={18} /> Failed</span>
                        ) : record.status === 'pending' ? (
                          <span className="text-neutral-400">Pending</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-neutral-200"><Spinner size={18} className="animate-spin" /> {record.progress}%</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'updates' && (
        <div className="flex-1 overflow-y-auto px-8 pb-12">
          <div className="mx-auto max-w-5xl">
            <div className="rounded-lg border border-white/10 bg-neutral-900 overflow-hidden">
              <div className="relative min-h-56 p-8">
                <div className="absolute -right-20 -bottom-28 h-72 w-96 rounded-full bg-brand-green/35 blur-md" />
                <div className="relative z-10 flex h-full flex-col justify-between gap-10">
                  <div>
                    <div className="text-sm font-bold uppercase tracking-wide text-brand-green">{BRANDING.curseforge.freshBatch}</div>
                    <h2 className="mt-2 text-4xl font-bold text-white">
                      {updateCount > 0 ? `${updateCount} update${updateCount === 1 ? '' : 's'} available` : 'Everything is up to date'}
                    </h2>
                    <p className="mt-3 max-w-2xl text-neutral-400">
                      {activeProfile
                        ? `Checking installed CurseForge mods in ${activeProfile.name}.`
                        : 'Select an active profile to check installed CurseForge mods.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => checkForUpdates()}
                      disabled={isChecking || !activeProfile}
                      className="inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-2.5 font-bold text-black hover:bg-brand-dark disabled:opacity-50 cursor-pointer"
                    >
                      {isChecking ? <Spinner size={18} className="animate-spin" /> : <ArrowsClockwise size={18} />}
                      {isChecking ? 'Brewing' : BRANDING.curseforge.checkFreshBatch}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateAllMods()}
                      disabled={isUpdating || updateRows.length === 0}
                      className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 font-bold text-white hover:bg-white/20 disabled:opacity-50 cursor-pointer"
                    >
                      {isUpdating ? <Spinner size={18} className="animate-spin" /> : <DownloadSimple size={18} />}
                      {isUpdating ? 'Updating' : 'Update all'}
                    </button>
                    {lastCheckTime ? (
                      <span className="text-sm text-neutral-500">Last checked {formatRelativeDate(lastCheckTime.toISOString())}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="text-3xl font-bold text-white">{activeProfile?.mods.filter((mod) => !mod.isLocal && typeof mod.modId === 'number').length || 0}</div>
                <div className="text-sm text-neutral-400">CurseForge mods</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="text-3xl font-bold text-brand-green">{updateRows.length}</div>
                <div className="text-sm text-neutral-400">Ready to update</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="text-3xl font-bold text-white">{activeProfile?.mods.length || 0}</div>
                <div className="text-sm text-neutral-400">Installed total</div>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-lg border border-white/10 bg-neutral-900">
              <div className="border-b-2 border-brand-green px-5 py-4 font-bold text-white">
                {BRANDING.curseforge.freshBatch}
              </div>
              {updateRows.length === 0 ? (
                <div className="px-5 py-8 text-neutral-400">
                  {isChecking ? 'Checking installed mods...' : 'There are no updates waiting in this profile.'}
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {updateRows.map(({ update, mod }) => (
                    <div key={update.modId} className="p-5">
                      <div className="flex items-center gap-4">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-neutral-800">
                          {mod?.logo ? (
                            <Image src={mod.logo} alt={update.modName} width={64} height={64} unoptimized className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-neutral-500">?</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-lg font-bold text-white">{update.modName}</div>
                          <div className="mt-1 text-sm text-neutral-400">
                            {update.currentVersionName || 'Current version'} {'->'} {update.latestVersionName || update.latestFileName}
                          </div>
                          <div className="mt-1 flex gap-4 text-xs text-neutral-500">
                            <span>{formatFileSize(update.latestFileSize || 0)}</span>
                            <span>Checked {formatRelativeDate(update.checkedAt)}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateMod(update.modId)}
                          disabled={isUpdating}
                          className="inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-2 font-bold text-black hover:bg-brand-dark disabled:opacity-50 cursor-pointer"
                        >
                          {isUpdating ? <Spinner size={18} className="animate-spin" /> : <DownloadSimple size={18} />}
                          Update
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

