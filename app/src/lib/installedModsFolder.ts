/**
 * Groups files found in the Sims 4 Mods folder into the mods a player
 * actually has installed, using CurseForge fingerprint matches first and
 * profile file names as a fallback.
 */

import { detectModSource, type ModSourceHit } from '@/lib/modSource';

export interface FolderFileRef {
  path: string;
  name: string;
  fingerprint: number;
  source?: string | null;
  sourceEvidence?: 'link' | 'filename' | 'folder' | null;
}

export interface FolderMatchRef {
  fingerprint: number;
  modId: number;
  displayName: string;
  fileName: string;
}

export interface ProfileModRef {
  modId?: number | string;
  modName: string;
  fileName: string;
  logo?: string;
}

export interface InstalledFolderGroup {
  key: string;
  title: string;
  files: string[];
  kind: 'curseforge' | 'profile' | 'folder';
  inProfile: boolean;
  /** True when the mod is not in the CurseForge catalog. Those cards get the folder mark. */
  local: boolean;
  modId?: number;
  logo?: string;
  source?: string | null;
  sourceEvidence?: 'link' | 'filename' | 'folder' | null;
}

export function isLocalInstalledMod(group: Pick<InstalledFolderGroup, 'kind'>): boolean {
  return group.kind !== 'curseforge';
}

const SOURCE_RANK: Record<NonNullable<ModSourceHit['evidence']>, number> = {
  link: 0,
  filename: 1,
  folder: 2,
};

function sourceForFile(file: FolderFileRef, relative: string): Pick<InstalledFolderGroup, 'source' | 'sourceEvidence'> {
  if (file.source) {
    return { source: file.source, sourceEvidence: file.sourceEvidence ?? 'folder' };
  }
  const hit = detectModSource({ relativePath: relative });
  return { source: hit?.label ?? null, sourceEvidence: hit?.evidence ?? null };
}

function preferSource(
  current: Pick<InstalledFolderGroup, 'source' | 'sourceEvidence'>,
  next: Pick<InstalledFolderGroup, 'source' | 'sourceEvidence'>
): Pick<InstalledFolderGroup, 'source' | 'sourceEvidence'> {
  if (!next.source) return current;
  if (!current.source) return next;
  const currentRank = SOURCE_RANK[current.sourceEvidence ?? 'folder'];
  const nextRank = SOURCE_RANK[next.sourceEvidence ?? 'folder'];
  return nextRank < currentRank ? next : current;
}

function normalize(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

export function relativeModPath(modsPath: string, file: FolderFileRef): string {
  const full = `${normalize(file.path)}/${file.name}`;
  const root = normalize(modsPath);
  const prefix = `${root}/`;
  if (full.toLowerCase().startsWith(prefix.toLowerCase())) {
    return full.slice(prefix.length);
  }
  return file.name;
}

export function groupInstalledFolderFiles(input: {
  modsPath: string;
  files: FolderFileRef[];
  matches: FolderMatchRef[];
  profileMods: ProfileModRef[];
}): InstalledFolderGroup[] {
  const matchByFingerprint = new Map<number, FolderMatchRef>();
  for (const match of input.matches) {
    if (!matchByFingerprint.has(match.fingerprint)) {
      matchByFingerprint.set(match.fingerprint, match);
    }
  }

  const profileByFile = new Map<string, ProfileModRef>();
  const profileByModId = new Map<number, ProfileModRef>();
  const profileModIds = new Set<number>();
  for (const mod of input.profileMods) {
    profileByFile.set(mod.fileName.toLowerCase(), mod);
    if (typeof mod.modId === 'number') {
      profileModIds.add(mod.modId);
      profileByModId.set(mod.modId, mod);
    }
  }

  const groups = new Map<string, InstalledFolderGroup>();

  for (const file of input.files) {
    const relative = relativeModPath(input.modsPath, file);
    const match = matchByFingerprint.get(file.fingerprint);
    const profileByName = profileByFile.get(file.name.toLowerCase());

    let key: string;
    let title: string;
    let kind: InstalledFolderGroup['kind'];
    let modId: number | undefined;
    let inProfile: boolean;
    let logo: string | undefined;
    const foundSource = sourceForFile(file, relative);

    if (match) {
      key = `curseforge:${match.modId}`;
      title = match.displayName || match.fileName || file.name;
      kind = 'curseforge';
      modId = match.modId;
      inProfile = profileModIds.has(match.modId) || Boolean(profileByName);
      logo = profileByName?.logo ?? profileByModId.get(match.modId)?.logo;
    } else if (profileByName) {
      key = `profile:${profileByName.fileName.toLowerCase()}`;
      title = profileByName.modName || file.name;
      kind = 'profile';
      modId = typeof profileByName.modId === 'number' ? profileByName.modId : undefined;
      inProfile = true;
      logo = profileByName.logo;
    } else {
      key = `folder:${relative.toLowerCase()}`;
      title = file.name;
      kind = 'folder';
      inProfile = false;
    }

    const local = isLocalInstalledMod({ kind });
    const existing = groups.get(key);
    if (existing) {
      if (!existing.files.includes(relative)) {
        existing.files.push(relative);
      }
      existing.inProfile = existing.inProfile || inProfile;
      existing.logo = existing.logo ?? logo;
      const preferred = preferSource(existing, foundSource);
      existing.source = preferred.source;
      existing.sourceEvidence = preferred.sourceEvidence;
      continue;
    }

    groups.set(key, {
      key,
      title,
      files: [relative],
      kind,
      inProfile,
      local,
      modId,
      logo,
      source: foundSource.source,
      sourceEvidence: foundSource.sourceEvidence,
    });
  }

  const rank: Record<InstalledFolderGroup['kind'], number> = {
    curseforge: 0,
    profile: 1,
    folder: 2,
  };

  return Array.from(groups.values()).sort((a, b) => {
    const kindOrder = rank[a.kind] - rank[b.kind];
    if (kindOrder !== 0) return kindOrder;
    return a.title.localeCompare(b.title);
  });
}
