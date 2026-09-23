import { describe, expect, it } from 'vitest';
import { GAMES, getGame } from '@/lib/games';

describe('game catalog', () => {
  it('keeps Sims 4 on CurseForge and gives inZOI Canvas plus Paralives Workshop', () => {
    expect(GAMES.sims4.curseforgeGameId).toBe(78062);
    expect(GAMES.inzoi.catalogs.map((link) => link.label)).toEqual(['CurseForge', 'Canvas']);
    expect(GAMES.inzoi.catalogs[1].url).toContain('canvas.playinzoi.com');
    expect(GAMES.paralives.curseforgeSlug).toBeNull();
    expect(GAMES.paralives.catalogs[0].url).toContain('1118520');
  });

  it('falls back to Sims 4 for an unknown id', () => {
    expect(getGame('nope').id).toBe('sims4');
  });
});
