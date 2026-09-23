export interface CafeDexEntry {
  key: string;
  gameId: string;
  name: string;
  path: string;
  fingerprint: number | null;
  broken: boolean;
  note: string;
  lastSeenAt: string;
  missing: boolean;
}

export interface CafeDexSighting {
  key: string;
  name: string;
  path: string;
  fingerprint: number | null;
}

export interface CafeDexPatch {
  broken?: boolean;
  note?: string;
}

const NOTE_LIMIT = 2000;

export function cafeDexKey(file: { fingerprint?: number | null; path: string }): string {
  if (typeof file.fingerprint === 'number' && Number.isFinite(file.fingerprint)) {
    return `fp:${file.fingerprint}`;
  }
  return `path:${file.path}`;
}

export function cleanCafeDexNote(note: string): string {
  return note.replace(/\0/g, '').slice(0, NOTE_LIMIT);
}

/**
 * Fold a scan into the saved record. Broken marks and notes stay on the
 * fingerprint, including files that were not in this scan.
 */
export function syncCafeDex(
  existing: CafeDexEntry[],
  gameId: string,
  sightings: CafeDexSighting[],
  now: string
): CafeDexEntry[] {
  const seen = new Map<string, CafeDexSighting>();
  for (const sighting of sightings) {
    if (!sighting.key) continue;
    seen.set(sighting.key, sighting);
  }

  const previous = new Map(
    existing.filter((entry) => entry.gameId === gameId).map((entry) => [entry.key, entry])
  );
  const nextForGame: CafeDexEntry[] = [];

  for (const [key, sighting] of seen) {
    const prior = previous.get(key);
    nextForGame.push({
      key,
      gameId,
      name: sighting.name,
      path: sighting.path,
      fingerprint: sighting.fingerprint,
      broken: prior?.broken ?? false,
      note: prior?.note ?? '',
      lastSeenAt: now,
      missing: false,
    });
    previous.delete(key);
  }

  for (const leftover of previous.values()) {
    nextForGame.push({ ...leftover, missing: true });
  }

  const others = existing.filter((entry) => entry.gameId !== gameId);
  return [...others, ...nextForGame].sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
}

export function updateCafeDex(
  existing: CafeDexEntry[],
  gameId: string,
  key: string,
  patch: CafeDexPatch
): CafeDexEntry[] {
  let found = false;
  const next = existing.map((entry) => {
    if (entry.gameId !== gameId || entry.key !== key) return entry;
    found = true;
    return {
      ...entry,
      broken: patch.broken ?? entry.broken,
      note: patch.note === undefined ? entry.note : cleanCafeDexNote(patch.note),
    };
  });
  if (!found) {
    throw new Error('CafeDex has no record for that mod. Scan the folder first.');
  }
  return next;
}
