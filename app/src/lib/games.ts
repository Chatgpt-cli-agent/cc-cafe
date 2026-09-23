export const GAME_IDS = ['sims4', 'inzoi', 'paralives'] as const;
export type GameId = (typeof GAME_IDS)[number];

export interface GameCatalogLink {
  label: string;
  url: string;
}

export interface GameDefinition {
  id: GameId;
  name: string;
  /** CurseForge website/API slug. Null when the game is not on CurseForge. */
  curseforgeSlug: string | null;
  /** Known CurseForge game id. InZOI is resolved from its slug at search time. */
  curseforgeGameId: number | null;
  catalogs: GameCatalogLink[];
  summary: string;
}

export const GAMES: Record<GameId, GameDefinition> = {
  sims4: {
    id: 'sims4',
    name: 'The Sims 4',
    curseforgeSlug: 'sims4',
    curseforgeGameId: 78062,
    catalogs: [
      { label: 'CurseForge', url: 'https://www.curseforge.com/sims4' },
    ],
    summary: 'Packages and script mods in the Sims 4 Mods folder.',
  },
  inzoi: {
    id: 'inzoi',
    name: 'inZOI',
    curseforgeSlug: 'inzoi',
    curseforgeGameId: null,
    catalogs: [
      { label: 'CurseForge', url: 'https://www.curseforge.com/inzoi' },
      { label: 'Canvas', url: 'https://canvas.playinzoi.com/en-US/explore' },
    ],
    summary: 'CurseForge mods, ModKit folders, pak files, and Canvas creations.',
  },
  paralives: {
    id: 'paralives',
    name: 'Paralives',
    curseforgeSlug: null,
    curseforgeGameId: null,
    catalogs: [
      { label: 'Steam Workshop', url: 'https://steamcommunity.com/app/1118520/workshop/' },
      { label: 'Modding guides', url: 'https://paralives.wiki.gg/wiki/Portal:Modding_guides' },
    ],
    summary: 'Steam Workshop content stored as .mod folders.',
  },
};

export function isGameId(value: string | null | undefined): value is GameId {
  return value === 'sims4' || value === 'inzoi' || value === 'paralives';
}

export function getGame(id: string | null | undefined): GameDefinition {
  return isGameId(id) ? GAMES[id] : GAMES.sims4;
}
