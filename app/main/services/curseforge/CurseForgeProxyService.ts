import { CurseForgeClient, CurseForgeGameEnum, CurseForgeModsSearchSortField, CurseForgeSortOrder } from 'curseforge-api';
import axios from 'axios';
import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { AdvancedSearchService } from '../search/AdvancedSearchService';
import { resolveAppDataRoot } from '../../utils/appPaths';

/**
 * Options for searching mods on CurseForge
 */
export interface SearchModsOptions {
  apiKey: string;
  query?: string;
  pageSize?: number;
  pageIndex?: number;
  sortBy?: 'downloads' | 'date' | 'popularity' | 'relevance';
  categoryName?: string;
  authorId?: number;
}

/**
 * Transformed mod data from CurseForge API
 */
export interface TransformedMod {
  id: number;
  name: string;
  slug: string;
  summary: string;
  description: string;
  downloadCount: number;
  dateModified: string;
  dateCreated: string;
  logo: string | null;
  screenshots: string[];
  authors: Array<{ name: string; id: number }>;
  categories: string[];
  websiteUrl: string | null;
  latestFiles: TransformedFile[];
}

/**
 * Transformed file data from CurseForge API
 */
export interface TransformedFile {
  id: number;
  displayName: string;
  fileName: string;
  fileDate: string;
  fileLength: number;
  downloadUrl: string;
  gameVersions: string[];
}

/**
 * Search result with pagination info
 */
export interface CurseForgeSearchResult {
  mods: TransformedMod[];
  pagination: {
    index: number;
    pageSize: number;
    resultCount: number;
    totalCount: number;
  };
}

interface ProfileMod {
  modId?: number | string;
  localModId?: string;
  isLocal?: boolean;
  modName: string;
  versionId?: number;
  versionNumber?: string;
  fileHash: string;
  fileName: string;
  installDate: string;
  enabled: boolean;
  cacheLocation: string;
  logo?: string;
  authors?: string[];
  lastUpdateDate?: string;
}

interface ModProfile {
  id: string;
  mods: ProfileMod[];
}

/**
 * Proxy service for CurseForge API
 * Handles authentication and data transformation
 *
 * @note The user's API key is retrieved from encrypted storage and used per-request
 */
export class CurseForgeProxyService {
  private readonly SIMS4_GAME_ID = CurseForgeGameEnum.TheSims4; // 78062
  private readonly SIMS4_CLASS_IDS = {
    mods: 5089,
    cas: 5339,
    objects: 5437,
    translations: 8140,
  } as const;
  private readonly advancedSearch = new AdvancedSearchService();
  private readonly referer = process.platform === 'darwin'
    ? 'app://s4mmm-electron-app-mac'
    : 'app://s4mm-electron-app-win';

  private assertApiKey(apiKey: string | undefined): asserts apiKey is string {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('CurseForge API key is not configured. Add it in Settings.');
    }
  }

  private createClient(apiKey: string): CurseForgeClient {
    return new CurseForgeClient(apiKey, {
      fetch: (input, init = {}) => {
        const headers = new Headers(init.headers);
        headers.set('Accept', 'application/json');
        headers.set('Content-Type', 'application/json');
        headers.set('User-Agent', 'Sims 4 Mod Manager');
        headers.set('Referer', this.referer);

        return fetch(input, {
          ...init,
          headers,
        });
      },
    });
  }

  private getHeaders(apiKey: string): Record<string, string> {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Sims 4 Mod Manager',
      Referer: this.referer,
      'x-api-key': apiKey,
    };
  }

  private async readProfiles(): Promise<ModProfile[]> {
    const profilesDir = path.join(await resolveAppDataRoot(), 'Profiles');
    const metadataPath = path.join(profilesDir, 'profiles.meta.json');

    try {
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8')) as { profiles?: string[] };
      const profileIds = Array.isArray(metadata.profiles) ? metadata.profiles : [];
      const profiles = await Promise.all(
        profileIds.map(async (profileId) => {
          try {
            return JSON.parse(await fs.readFile(path.join(profilesDir, `${profileId}.json`), 'utf-8')) as ModProfile;
          } catch {
            return null;
          }
        })
      );

      return profiles.filter((profile): profile is ModProfile => Boolean(profile));
    } catch {
      return [];
    }
  }

  private async readCachedCurseForgeMods(): Promise<Record<string, TransformedMod>> {
    const cachePath = await this.getCurseForgeCachePath();

    try {
      return JSON.parse(await fs.readFile(cachePath, 'utf-8')) as Record<string, TransformedMod>;
    } catch {
      return {};
    }
  }

  private async writeCachedCurseForgeMods(cache: Record<string, TransformedMod>): Promise<void> {
    const cachePath = await this.getCurseForgeCachePath();
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
  }

  private async getCurseForgeCachePath(): Promise<string> {
    return path.join(await resolveAppDataRoot(), 'CurseForge', 'mods-cache.json');
  }

  private profileModToTransformedMod(mod: ProfileMod): TransformedMod {
    const numericId = typeof mod.modId === 'number' ? mod.modId : Number(mod.modId);
    const id = Number.isFinite(numericId) && numericId > 0
      ? numericId
      : this.localModIdToStableNumber(mod.localModId || mod.fileHash || mod.fileName);
    const authorNames = mod.authors && mod.authors.length > 0 ? mod.authors : ['Local'];

    return {
      id,
      name: mod.modName || mod.fileName,
      slug: (mod.modName || mod.fileName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      summary: mod.isLocal ? 'Local mod installed in CC Cafe' : mod.fileName,
      description: '',
      downloadCount: 0,
      dateModified: mod.lastUpdateDate || mod.installDate || new Date().toISOString(),
      dateCreated: mod.installDate || new Date().toISOString(),
      logo: mod.logo || null,
      screenshots: [],
      authors: authorNames.map((name, index) => ({ name, id: index + 1 })),
      categories: mod.isLocal ? ['Local'] : [],
      websiteUrl: typeof mod.modId === 'number' ? `https://www.curseforge.com/sims4/mods/${mod.modId}` : null,
      latestFiles: [
        {
          id: mod.versionId || 0,
          displayName: mod.versionNumber || mod.fileName,
          fileName: mod.fileName,
          fileDate: mod.lastUpdateDate || mod.installDate || new Date().toISOString(),
          fileLength: 0,
          downloadUrl: '',
          gameVersions: [],
        },
      ],
    };
  }

  private localModIdToStableNumber(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index++) {
      hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
    }
    return Math.abs(hash) + 1_000_000_000;
  }

  private async getProfileMods(): Promise<ProfileMod[]> {
    const profiles = await this.readProfiles();
    const modMap = new Map<string, ProfileMod>();

    for (const profile of profiles) {
      for (const mod of profile.mods || []) {
        const key = `${mod.modId ?? ''}:${mod.localModId ?? ''}:${mod.fileHash}`;
        if (!modMap.has(key)) {
          modMap.set(key, mod);
        }
      }
    }

    return Array.from(modMap.values());
  }

  private async fetchModsByIds(apiKey: string, modIds: number[]): Promise<TransformedMod[]> {
    if (modIds.length === 0) {
      return [];
    }

    const results: TransformedMod[] = [];
    const batchSize = 100;

    for (let index = 0; index < modIds.length; index += batchSize) {
      const batch = modIds.slice(index, index + batchSize);
      const response = await axios.post(
        'https://api.curseforge.com/v1/mods',
        { modIds: batch },
        { headers: this.getHeaders(apiKey) }
      );

      results.push(
        ...response.data.data
          .filter((mod: any) => mod && mod.gameId === this.SIMS4_GAME_ID)
          .map((mod: any) => this.transformMod(mod))
      );
    }

    return results;
  }

  private getClassIdForCategory(categoryName?: string): number | undefined {
    if (!categoryName) {
      return undefined;
    }

    const normalized = categoryName.toLowerCase();
    if (normalized === 'mods') {
      return this.SIMS4_CLASS_IDS.mods;
    }
    if (normalized === 'create a sim') {
      return this.SIMS4_CLASS_IDS.cas;
    }
    if (normalized === 'build mode' || normalized === 'buy mode' || normalized === 'rooms') {
      return this.SIMS4_CLASS_IDS.objects;
    }
    if (normalized === 'translations') {
      return this.SIMS4_CLASS_IDS.translations;
    }

    return undefined;
  }

  private async searchLiveMods(options: SearchModsOptions): Promise<CurseForgeSearchResult> {
    const { apiKey, query, pageSize = 50, pageIndex = 0, sortBy = 'downloads', categoryName, authorId } = options;
    const normalizedApiKey = apiKey?.trim();
    this.assertApiKey(normalizedApiKey);

    const normalizedQuery = query?.trim() || '';
    const hasTextQuery = normalizedQuery.length > 0;
    const fetchSize = hasTextQuery ? 150 : Math.min(pageSize, 50);
    const params: Record<string, string | number> = {
      gameId: this.SIMS4_GAME_ID,
      pageSize: Math.min(fetchSize, 50),
      index: hasTextQuery ? 0 : pageIndex * pageSize,
      sortField: this.getSortField(sortBy),
      sortOrder: 'desc',
    };

    const classId = this.getClassIdForCategory(categoryName);
    if (classId) {
      params.classId = classId;
    }

    if (categoryName && !classId) {
      const categoryId = await this.getCategoryIdByName(normalizedApiKey, categoryName);
      if (categoryId !== undefined) {
        params.categoryId = categoryId;
      }
    }

    if (normalizedQuery) {
      params.searchFilter = normalizedQuery;
    }

    if (authorId) {
      params.authorId = authorId;
    }

    const firstResult = await axios.get('https://api.curseforge.com/v1/mods/search', {
      headers: this.getHeaders(normalizedApiKey),
      params,
    });

    let allMods = firstResult.data.data.map((mod: any) => this.transformMod(mod));
    const totalCountFromApi = firstResult.data.pagination?.totalCount ?? allMods.length;

    if (hasTextQuery && fetchSize > 50) {
      const additionalFetches = Math.ceil((fetchSize - 50) / 50);
      const additionalResults = await Promise.all(
        Array.from({ length: additionalFetches }, (_unused, index) => axios.get(
          'https://api.curseforge.com/v1/mods/search',
          {
            headers: this.getHeaders(normalizedApiKey),
            params: {
              ...params,
              index: (index + 1) * 50,
            },
          }
        ))
      );

      for (const result of additionalResults) {
        allMods.push(...result.data.data.map((mod: any) => this.transformMod(mod)));
      }
    }

    let finalMods = allMods;
    if (hasTextQuery) {
      const scoredMods = this.advancedSearch.searchAndScore(allMods, normalizedQuery);
      finalMods = scoredMods.sort((a, b) => {
        if (b.searchScore !== a.searchScore) {
          return b.searchScore - a.searchScore;
        }

        if (sortBy === 'relevance') {
          return 0;
        }

        switch (sortBy) {
          case 'date':
            return new Date(b.dateModified).getTime() - new Date(a.dateModified).getTime();
          case 'popularity':
          case 'downloads':
            return b.downloadCount - a.downloadCount;
          default:
            return 0;
        }
      });
    }

    const paginatedMods = hasTextQuery
      ? finalMods.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize)
      : finalMods;

    const cachedMods = await this.readCachedCurseForgeMods();
    for (const mod of paginatedMods) {
      cachedMods[mod.id] = mod;
    }
    await this.writeCachedCurseForgeMods(cachedMods);

    return {
      mods: paginatedMods,
      pagination: {
        index: pageIndex,
        pageSize,
        resultCount: paginatedMods.length,
        totalCount: hasTextQuery ? finalMods.length : totalCountFromApi,
      },
    };
  }

  /**
   * Searches for mods on CurseForge with advanced search scoring
   * @param options Search options including API key, query, pagination, and sort
   * @returns Transformed mods with pagination info
   * @throws Error if API call fails
   *
   * @note When a text query is provided, this method fetches more results from CurseForge
   *       (up to 150 mods) and applies advanced scoring to prioritize search relevance
   *       over the original sort order. The user's sort preference is used as a secondary
   *       sort criterion for mods with equal search scores.
   */
  async searchMods(options: SearchModsOptions): Promise<CurseForgeSearchResult> {
    const { query, pageSize = 50, pageIndex = 0, sortBy = 'downloads', categoryName } = options;
    const apiKey = options.apiKey?.trim();
    let liveSearchError: unknown;

    if (apiKey) {
      try {
        return await this.searchLiveMods({
          ...options,
          apiKey,
        });
      } catch (error) {
        liveSearchError = error;
        console.warn('[CurseForge] Live browse failed; falling back to local cache:', error);
      }
    }

    const profileMods = await this.getProfileMods();
    const cachedMods = await this.readCachedCurseForgeMods();
    const numericModIds = profileMods
      .map((mod) => (typeof mod.modId === 'number' ? mod.modId : Number(mod.modId)))
      .filter((modId) => Number.isInteger(modId) && modId > 0);
    const uniqueNumericModIds = [...new Set(numericModIds)];
    const missingModIds = uniqueNumericModIds.filter((modId) => !cachedMods[modId]);

    if (apiKey && missingModIds.length > 0) {
      try {
        const fetchedMods = await this.fetchModsByIds(apiKey, missingModIds);
        for (const mod of fetchedMods) {
          cachedMods[mod.id] = mod;
        }
        await this.writeCachedCurseForgeMods(cachedMods);
      } catch (error) {
        console.warn('[CurseForge] Failed to refresh local CurseForge cache:', error);
      }
    }

    let allMods = profileMods.map((profileMod) => {
      const modId = typeof profileMod.modId === 'number' ? profileMod.modId : Number(profileMod.modId);
      return Number.isInteger(modId) && cachedMods[modId]
        ? cachedMods[modId]
        : this.profileModToTransformedMod(profileMod);
    });

    if (allMods.length === 0 && liveSearchError) {
      const message = liveSearchError instanceof Error ? liveSearchError.message : 'Unknown error';
      throw new Error(`CurseForge browse failed: ${message}`);
    }

    if (categoryName) {
      const categoryFilter = categoryName.toLowerCase();
      allMods = allMods.filter((mod) => mod.categories.some((category) => category.toLowerCase() === categoryFilter));
    }

    // Apply advanced search scoring if we have a text query
    let finalMods = allMods;
    const hasTextQuery = query && query.trim().length > 0;
    if (hasTextQuery) {
      const scoredMods = this.advancedSearch.searchAndScore(allMods, query);

      // Sort by search score (primary), then by user's sort preference (secondary)
      // UNLESS sortBy is 'relevance', in which case only use search score
      finalMods = scoredMods.sort((a, b) => {
        // Primary sort: search score (descending)
        if (b.searchScore !== a.searchScore) {
          return b.searchScore - a.searchScore;
        }

        // If sortBy is 'relevance', don't apply secondary sort
        if (sortBy === 'relevance') {
          return 0;
        }

        // Secondary sort: user's preference (for other sort options)
        switch (sortBy) {
          case 'downloads':
            return b.downloadCount - a.downloadCount;
          case 'date':
            return new Date(b.dateModified).getTime() - new Date(a.dateModified).getTime();
          case 'popularity':
            return b.downloadCount - a.downloadCount; // Popularity ≈ downloads
          default:
            return 0;
        }
      });
    }

    if (!hasTextQuery) {
      switch (sortBy) {
        case 'date':
          finalMods = finalMods.sort((a, b) => new Date(b.dateModified).getTime() - new Date(a.dateModified).getTime());
          break;
        case 'popularity':
        case 'downloads':
          finalMods = finalMods.sort((a, b) => b.downloadCount - a.downloadCount);
          break;
        default:
          finalMods = finalMods.sort((a, b) => a.name.localeCompare(b.name));
          break;
      }
    }

    const startIndex = pageIndex * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedMods = finalMods.slice(startIndex, endIndex);

    const transformed: CurseForgeSearchResult = {
      mods: paginatedMods,
      pagination: {
        index: pageIndex,
        pageSize: pageSize,
        resultCount: paginatedMods.length,
        totalCount: finalMods.length
      }
    };

    return transformed;
  }

  /**
   * Converts a category name to its corresponding category ID
   * @param apiKey CurseForge API key
   * @param categoryName The name of the category (e.g., "Teen", "Clothing")
   * @returns The category ID, or undefined if not found
   * @private
   */
  private async getCategoryIdByName(apiKey: string, categoryName: string): Promise<number | undefined> {
    this.assertApiKey(apiKey);
    const categories = await this.getCategories(apiKey);
    const category = categories.find(cat => cat.name.toLowerCase() === categoryName.toLowerCase());
    return category?.id;
  }

  /**
   * Gets details of a specific mod
   * @param apiKey CurseForge API key
   * @param modId CurseForge mod ID
   * @returns Transformed mod details
   * @throws Error if mod not found
   */
  async getMod(apiKey: string, modId: number): Promise<TransformedMod> {
    const normalizedApiKey = apiKey?.trim();
    this.assertApiKey(normalizedApiKey);

    // Fetch from API
    const modResponse = await axios.get(`https://api.curseforge.com/v1/mods/${modId}`, {
      headers: this.getHeaders(normalizedApiKey),
    });
    const mod = modResponse.data.data;

    // Also fetch detailed info to get the full description
    try {
      const response = await fetch(`https://api.curseforge.com/v1/mods/${modId}`, {
        headers: {
          'X-API-Key': normalizedApiKey,
          'User-Agent': 'Sims 4 Mod Manager',
          'Referer': this.referer,
        },
      });
      if (response.ok) {
        const data = await response.json() as any;
        if (data.data?.description) {
          (mod as any).description = data.data.description;
        }
      }
    } catch (error) {
      // Silently fail if full description fetch fails
    }

    const transformed = this.transformMod(mod);

    return transformed;
  }

  async getDownloadUrl(apiKey: string, modId: number, fileId?: number): Promise<{
    modId: number;
    modName: string;
    fileId: number;
    fileName: string;
    downloadUrl: string;
    fileSize: number;
  }> {
    const normalizedApiKey = apiKey?.trim();
    this.assertApiKey(normalizedApiKey);

    const mod = await this.getMod(normalizedApiKey, modId);
    const selectedFile = fileId
      ? mod.latestFiles.find((file) => file.id === fileId)
      : mod.latestFiles[0];

    if (!selectedFile) {
      throw new Error(`No downloadable file found for ${mod.name}`);
    }

    let downloadUrl = selectedFile.downloadUrl;
    if (!downloadUrl) {
      const response = await axios.get(
        `https://api.curseforge.com/v1/mods/${modId}/files/${selectedFile.id}/download-url`,
        { headers: this.getHeaders(normalizedApiKey) }
      );
      downloadUrl = response.data.data;
    }

    if (!downloadUrl) {
      throw new Error(`CurseForge did not return a download URL for ${selectedFile.fileName}`);
    }

    return {
      modId,
      modName: mod.name,
      fileId: selectedFile.id,
      fileName: selectedFile.fileName,
      downloadUrl,
      fileSize: selectedFile.fileLength,
    };
  }

  /**
   * Converts sort parameter to CurseForge API enum
   * @private
   */
  private getSortField(sortBy: string): CurseForgeModsSearchSortField {
    switch (sortBy) {
      case 'downloads':
        return CurseForgeModsSearchSortField.TotalDownloads;
      case 'date':
        return CurseForgeModsSearchSortField.LastUpdated;
      case 'popularity':
        return CurseForgeModsSearchSortField.Popularity;
      case 'relevance':
        // When no text query, relevance fallback to popularity
        return CurseForgeModsSearchSortField.Popularity;
      default:
        return CurseForgeModsSearchSortField.TotalDownloads;
    }
  }

  /**
   * Gets all available categories for Sims 4 mods from CurseForge
   * @param apiKey CurseForge API key
   * @returns Array of categories
   * @throws Error if API call fails
   */
  async getCategories(apiKey: string): Promise<Array<{ id: number; name: string }>> {
    const normalizedApiKey = apiKey?.trim();
    this.assertApiKey(normalizedApiKey);

    // Fetch categories from API
    const categoriesResponse = await axios.get('https://api.curseforge.com/v1/categories', {
      headers: this.getHeaders(normalizedApiKey),
      params: {
        gameId: this.SIMS4_GAME_ID,
      },
    });

    // Transform to our format (id and name only)
    const categories = categoriesResponse.data.data.map((cat: any) => ({
      id: cat.id,
      name: cat.name
    }));

    return categories;
  }

  /**
   * Transforms CurseForge mod data to our internal format
   * @private
   */
  private transformMod(mod: any): TransformedMod {
    return {
      id: mod.id,
      name: mod.name,
      slug: mod.slug,
      summary: mod.summary,
      description: mod.description || mod.links?.sourceUrl || '',
      downloadCount: mod.downloadCount || 0,
      dateModified: mod.dateModified ? new Date(mod.dateModified).toISOString() : new Date().toISOString(),
      dateCreated: mod.dateCreated ? new Date(mod.dateCreated).toISOString() : new Date().toISOString(),
      logo: mod.logo?.url || null,
      screenshots: mod.screenshots?.map((s: any) => s.url) || [],
      authors: mod.authors?.map((a: any) => ({
        name: a.name,
        id: a.id
      })) || [],
      categories: mod.categories?.map((c: any) => c.name) || [],
      websiteUrl: mod.links?.websiteUrl || null,
      latestFiles: mod.latestFiles?.map((f: any) => ({
        id: f.id,
        displayName: f.displayName,
        fileName: f.fileName,
        fileDate: f.fileDate ? new Date(f.fileDate).toISOString() : new Date().toISOString(),
        fileLength: f.fileLength || 0,
        downloadUrl: f.downloadUrl || '',
        gameVersions: f.gameVersions || []
      })) || []
    };
  }
}

export const curseForgeProxyService = new CurseForgeProxyService();
