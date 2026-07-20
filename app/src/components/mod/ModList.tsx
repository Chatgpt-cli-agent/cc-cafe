'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import ModListItem from '@/components/mod/ModListItem';
import ModCard from '@/components/mod/ModCard';
import { searchCurseForgeMods } from '@/lib/curseforgeApi';
import { getBatchWarningStatus } from '@/lib/fakeDetectionApi';
import { userPreferencesService } from '@/lib/services/UserPreferencesService';
import { getCompatSessionStorageItem, setCompatSessionStorageItem } from '@/lib/utils/storageCompat';
import { CurseForgeMod } from '@/types/curseforge';
import { ViewMode } from '@/hooks/useViewMode';
import { useSearchState } from '@/context/SearchStateContext';
import { useTranslation } from 'react-i18next';
import type { ModWarningStatus } from '@/types/fakeDetection';

interface ModListProps {
  searchQuery: string;
  sortBy: 'downloads' | 'date' | 'trending' | 'relevance';
  category?: string;
  authorId?: number;
  viewMode: ViewMode;
  activeFilter?: 'all' | 'updates' | 'early-access' | 'installed';
  scrollIndex?: number;
}

interface PaginationState {
  index: number;
  pageSize: number;
  resultCount: number;
  totalCount: number;
}

interface CachedSearchResult {
  mods: CurseForgeMod[];
  pagination: PaginationState;
  hasMore: boolean;
  scrollIndex: number;
  savedAt: number;
}

const SEARCH_CACHE_PREFIX = 'cccafe_modlist_cache:';
const SEARCH_CACHE_TTL = 1000 * 60 * 10;

export default function ModList({ searchQuery, sortBy, category, authorId, viewMode, activeFilter = 'all', scrollIndex = 0 }: ModListProps) {
  const { t } = useTranslation();
  const { resetScrollIndex, setScrollIndex, setCacheKey, setCachedModsCount } = useSearchState();
  const [mods, setMods] = useState<CurseForgeMod[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warningStatuses, setWarningStatuses] = useState<Record<number, ModWarningStatus>>({});
  const [pagination, setPagination] = useState<PaginationState>({
    index: 0,
    pageSize: 50,
    resultCount: 0,
    totalCount: 0,
  });
  const [hasMore, setHasMore] = useState(true);
  const [gridColumns, setGridColumns] = useState(8);
  const paginationRef = useRef<PaginationState>(pagination);
  const listRef = useRef<any>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const hasRestoredScroll = useRef(false);
  const isRestoring = useRef(false);
  const scrollUpdateTimeout = useRef<NodeJS.Timeout | null>(null);

  const normalizedCategory = category ?? '';

  // Track previous filter values to detect actual changes vs remounts
  const prevFiltersRef = useRef<{
    searchQuery: string;
    sortBy: string;
    category: string;
    activeFilter: string;
  } | null>(null);

  /**
   * Dense S4MM-style column count based on available content width.
   */
  useEffect(() => {
    const updateGridColumns = () => {
      const width = window.innerWidth;
      if (width < 700) setGridColumns(3);
      else if (width < 900) setGridColumns(5);
      else if (width < 1100) setGridColumns(7);
      else if (width < 1300) setGridColumns(8);
      else if (width < 1500) setGridColumns(9);
      else if (width < 1700) setGridColumns(10);
      else setGridColumns(11);
    };

    updateGridColumns();
    window.addEventListener('resize', updateGridColumns);
    return () => window.removeEventListener('resize', updateGridColumns);
  }, []);

  // Keep ref updated
  useEffect(() => {
    paginationRef.current = pagination;
  }, [pagination]);

  // Convert UI sort names to API sort names
  const apiSortBy = useMemo(() => {
    switch (sortBy) {
      case 'relevance':
        return 'relevance';
      case 'trending':
        return 'popularity';
      case 'date':
        return 'date';
      case 'downloads':
      default:
        return 'downloads';
    }
  }, [sortBy]);

  const searchCacheKey = useMemo(() => {
    return [
      searchQuery.trim().toLowerCase(),
      apiSortBy,
      normalizedCategory.toLowerCase(),
      authorId ?? 'all',
      activeFilter,
    ].join('|');
  }, [searchQuery, apiSortBy, normalizedCategory, authorId, activeFilter]);

  const readCachedSearchResult = useCallback((cacheKey: string): CachedSearchResult | null => {
    try {
      const raw = getCompatSessionStorageItem(`${SEARCH_CACHE_PREFIX}${cacheKey}`);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as CachedSearchResult;
      if (!parsed?.mods || !Array.isArray(parsed.mods)) return null;
      if (!parsed.savedAt || Date.now() - parsed.savedAt > SEARCH_CACHE_TTL) return null;
      return parsed;
    } catch {
      return null;
    }
  }, []);

  const saveCachedSearchResult = useCallback(
    (cacheKey: string, nextMods: CurseForgeMod[], nextPagination: PaginationState, nextHasMore: boolean) => {
      try {
        const payload: CachedSearchResult = {
          mods: nextMods,
          pagination: nextPagination,
          hasMore: nextHasMore,
          scrollIndex,
          savedAt: Date.now(),
        };
        setCompatSessionStorageItem(`${SEARCH_CACHE_PREFIX}${cacheKey}`, JSON.stringify(payload));
        setCacheKey(cacheKey);
        setCachedModsCount(nextMods.length);
      } catch (error) {
        console.debug('[ModList] Failed to save search cache', error);
      }
    },
    [scrollIndex, setCacheKey, setCachedModsCount]
  );

  const fetchModsForPage = useCallback(async (pageIndex: number) => {
    if (pageIndex === 0) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    const apiParams = {
      query: searchQuery || undefined,
      pageSize: 100,
      pageIndex,
      sortBy: apiSortBy as 'downloads' | 'date' | 'popularity' | 'relevance',
      categoryName: normalizedCategory || undefined,
      authorId,
    };

    try {
      const result = await searchCurseForgeMods(apiParams);

      setMods((prev) => (pageIndex === 0 ? result.mods : [...prev, ...result.mods]));

      const nextPagination = {
        index: pageIndex,
        pageSize: 100,
        resultCount: result.pagination.resultCount,
        totalCount: result.pagination.totalCount,
      };

      setPagination(nextPagination);

      // Check if there are more pages
      const loadedCount = (pageIndex + 1) * 100;
      const nextHasMore = loadedCount < result.pagination.totalCount && result.mods.length > 0;
      setHasMore(nextHasMore);

      if (pageIndex === 0) {
        saveCachedSearchResult(searchCacheKey, result.mods, nextPagination, nextHasMore);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || err.message || 'Failed to load mods';
      setError(errorMessage);
      if (pageIndex === 0) setMods([]);
    } finally {
      if (pageIndex === 0) {
        setIsLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  }, [searchQuery, apiSortBy, normalizedCategory, authorId, saveCachedSearchResult, searchCacheKey]);

  // Load first page when query or sort changes
  useEffect(() => {
    const currentFilters = {
      searchQuery,
      sortBy,
      category: normalizedCategory,
      activeFilter,
    };

    const prevFilters = prevFiltersRef.current;
    const filtersActuallyChanged = prevFilters !== null && (
      prevFilters.searchQuery !== currentFilters.searchQuery ||
      prevFilters.sortBy !== currentFilters.sortBy ||
      prevFilters.category !== currentFilters.category ||
      prevFilters.activeFilter !== currentFilters.activeFilter
    );

    setMods([]);
    setWarningStatuses({});
    setPagination({
      index: 0,
      pageSize: 100,
      resultCount: 0,
      totalCount: 0,
    });
    setError(null);
    setHasMore(true);

    // Only reset scroll position when filters ACTUALLY changed (not on mount/remount)
    // This preserves scroll position when navigating back
    if (filtersActuallyChanged) {
      resetScrollIndex();
    }

    // Save current filters for next comparison
    prevFiltersRef.current = currentFilters;

    // Reset scroll restoration flag to allow restoration on next navigation
    hasRestoredScroll.current = false;

    const cached = readCachedSearchResult(searchCacheKey);
    if (cached) {
      setMods(cached.mods);
      setPagination(cached.pagination);
      setHasMore(cached.hasMore);
      setError(null);
      setIsLoading(false);
      return;
    }

    fetchModsForPage(0);
  }, [searchQuery, sortBy, normalizedCategory, activeFilter, fetchModsForPage, resetScrollIndex, readCachedSearchResult, searchCacheKey]);

  /**
   * Fetch warning statuses for all displayed mods
   * Called whenever mods list changes
   */
  useEffect(() => {
    if (mods.length === 0) return;
    if (!userPreferencesService.getFakeModDetection()) return;

    const fetchWarnings = async () => {
      try {
        const modIds = mods.map((mod) => mod.id);
        // Map mod ID to creator ID (using first author)
        const creatorIds: Record<number, number> = {};
        mods.forEach((mod) => {
          if (mod.authors && mod.authors.length > 0) {
            creatorIds[mod.id] = mod.authors[0].id;
          }
        });

        const statuses = await getBatchWarningStatus(modIds, creatorIds);
        setWarningStatuses(statuses || {});
      } catch (err) {
        console.error('Failed to fetch warning statuses:', err);
        // Don't fail the whole page if warnings fail to load
      }
    };

    fetchWarnings();
  }, [mods]);

  const loadNextPage = useCallback(() => {
    if (!hasMore || isLoadingMore || isLoading) return;
    const nextPageIndex = paginationRef.current.index + 1;
    fetchModsForPage(nextPageIndex).catch(() => {
      setError('Failed to load more mods');
    });
  }, [hasMore, isLoadingMore, isLoading, fetchModsForPage]);

  /**
   * Restore list Virtuoso scroll position after mods are loaded.
   */
  useEffect(() => {
    if (viewMode !== 'list') return;
    if (isLoading) {
      hasRestoredScroll.current = false;
      return;
    }

    if (mods.length > 0 && scrollIndex > 0 && listRef.current && !hasRestoredScroll.current) {
      hasRestoredScroll.current = true;
      isRestoring.current = true;
      setTimeout(() => {
        listRef.current?.scrollToIndex({
          index: scrollIndex,
          align: 'start',
          behavior: 'auto',
        });
        setTimeout(() => {
          isRestoring.current = false;
        }, 200);
      }, 0);
    }
  }, [mods.length, scrollIndex, isLoading, viewMode]);

  /**
   * Native grid scroll: load more when the bottom sentinel enters view.
   * Avoids Virtuoso height bugs with dense S4MM-style tiles.
   */
  useEffect(() => {
    if (viewMode !== 'grid') return;
    const root = gridScrollRef.current;
    const sentinel = loadMoreSentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadNextPage();
        }
      },
      { root, rootMargin: '400px 0px', threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [viewMode, loadNextPage, mods.length]);

  /** Keep fetching while the grid content is shorter than the viewport. */
  useEffect(() => {
    if (viewMode !== 'grid') return;
    if (!hasMore || isLoadingMore || isLoading || mods.length === 0) return;
    const root = gridScrollRef.current;
    if (!root) return;
    if (root.scrollHeight <= root.clientHeight + 80) {
      loadNextPage();
    }
  }, [viewMode, hasMore, isLoadingMore, isLoading, mods.length, loadNextPage]);

  const handleGridScroll = useCallback(() => {
    if (isRestoring.current) return;
    const root = gridScrollRef.current;
    if (!root) return;
    if (scrollUpdateTimeout.current) clearTimeout(scrollUpdateTimeout.current);
    scrollUpdateTimeout.current = setTimeout(() => {
      // Approximate card index from scroll position for back-navigation restore.
      const approxRow = Math.floor(root.scrollTop / 160);
      setScrollIndex(approxRow * gridColumns);
    }, 150);
  }, [gridColumns, setScrollIndex]);

  const handleRangeChanged = useCallback(
    (range: any) => {
      if (isRestoring.current) return;
      if (scrollUpdateTimeout.current) clearTimeout(scrollUpdateTimeout.current);
      scrollUpdateTimeout.current = setTimeout(() => {
        setScrollIndex(range.startIndex ?? 0);
      }, 150);
    },
    [setScrollIndex]
  );

  useEffect(() => {
    return () => {
      if (scrollUpdateTimeout.current) clearTimeout(scrollUpdateTimeout.current);
    };
  }, []);


  // Loading state for first load
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-700 border-t-green-600 rounded-full animate-spin" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md rounded-lg p-8 border" style={{ backgroundColor: 'var(--ui-panel)', borderColor: 'var(--ui-border)' }}>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{t('mods.list.error')}</h3>
          <p className="text-red-200 mb-4" style={{ color: 'var(--text-secondary)' }}>{error}</p>
          <button
            onClick={() => fetchModsForPage(0)}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-medium text-white transition"
          >
            {t('mods.list.try_again')}
          </button>
        </div>
      </div>
    );
  }

  const gridColsClass =
    {
      3: 'grid-cols-3',
      5: 'grid-cols-5',
      7: 'grid-cols-7',
      8: 'grid-cols-8',
      9: 'grid-cols-9',
      10: 'grid-cols-10',
      11: 'grid-cols-11',
    }[gridColumns] || 'grid-cols-8';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {viewMode === 'list' && (
        <div
          className="grid flex-shrink-0 grid-cols-12 gap-4 border-b px-4 py-3 text-xs font-semibold uppercase tracking-wider lg:px-8"
          style={{ backgroundColor: 'var(--ui-dark)', color: 'var(--text-secondary)', borderColor: 'var(--ui-border)' }}
        >
          <div className="col-span-6 lg:col-span-5">{t('mods.list.column_mod')}</div>
          <div className="col-span-3 hidden md:block lg:col-span-2">{t('mods.list.column_categories')}</div>
          <div className="col-span-2 hidden lg:block">{t('mods.list.column_downloads')}</div>
          <div className="col-span-3 hidden text-right lg:col-span-2 lg:block">{t('mods.list.column_last_update')}</div>
          <div className="col-span-6 text-right md:col-span-3 lg:col-span-1" />
        </div>
      )}

      {mods.length > 0 ? (
        viewMode === 'list' ? (
          <Virtuoso
            ref={listRef}
            data={mods}
            className="min-h-0 flex-1"
            style={{ height: '100%' }}
            initialTopMostItemIndex={scrollIndex > 0 ? scrollIndex + 1 : 0}
            itemContent={(_index, mod) => (
              <div className="px-4 py-2 lg:px-8">
                <ModListItem mod={mod} warningStatus={warningStatuses[mod.id]} />
              </div>
            )}
            rangeChanged={handleRangeChanged}
            endReached={loadNextPage}
            increaseViewportBy={{ top: 200, bottom: 800 }}
            atBottomThreshold={400}
            overscan={20}
          />
        ) : (
          <div
            ref={gridScrollRef}
            onScroll={handleGridScroll}
            className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-8 pt-2 lg:px-8"
            style={{ overscrollBehavior: 'contain' }}
          >
            <div className={`grid ${gridColsClass} gap-x-3 gap-y-4`}>
              {mods.map((mod) => (
                <ModCard key={mod.id} mod={mod} warningStatus={warningStatuses[mod.id]} />
              ))}
            </div>
            <div ref={loadMoreSentinelRef} className="h-8 w-full" aria-hidden />
            {isLoadingMore && (
              <div className="py-4 text-center text-xs text-neutral-400">Loading more…</div>
            )}
            {!hasMore && mods.length > 0 && (
              <div className="py-4 text-center text-xs text-neutral-500">End of results</div>
            )}
          </div>
        )
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="py-12 text-center text-gray-500">
            <p>{t('mods.list.no_results')}</p>
          </div>
        </div>
      )}
    </div>
  );
}

