'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { getCompatStorageItem, setCompatStorageItem } from '@/lib/utils/storageCompat';
import { GAME_IDS, getGame, isGameId, type GameDefinition, type GameId } from '@/lib/games';

const STORAGE_KEY = 'cccafe_active_game';

interface GameContextValue {
  gameId: GameId;
  game: GameDefinition;
  setGameId: (gameId: GameId) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

function readStoredGame(): GameId {
  const stored = getCompatStorageItem(STORAGE_KEY);
  return isGameId(stored) ? stored : 'sims4';
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [gameId, setGameIdState] = useState<GameId>(readStoredGame);

  const value = useMemo<GameContextValue>(() => ({
    gameId,
    game: getGame(gameId),
    setGameId: (next) => {
      setGameIdState(next);
      setCompatStorageItem(STORAGE_KEY, next);
    },
  }), [gameId]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    return {
      gameId: 'sims4',
      game: getGame('sims4'),
      setGameId: () => undefined,
    };
  }
  return context;
}

export { GAME_IDS };
