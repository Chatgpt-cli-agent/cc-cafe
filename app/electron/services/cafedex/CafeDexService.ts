import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import {
  syncCafeDex,
  updateCafeDex,
  type CafeDexEntry,
  type CafeDexPatch,
  type CafeDexSighting,
} from './cafeDex';

interface CafeDexStore {
  entries: CafeDexEntry[];
}

export class CafeDexService {
  private storePath: string | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  private getStorePath(): string {
    if (!this.storePath) {
      this.storePath = path.join(app.getPath('userData'), 'cafedex.json');
    }
    return this.storePath;
  }

  private async readStore(): Promise<CafeDexStore> {
    try {
      const raw = await fs.readFile(this.getStorePath(), 'utf-8');
      const parsed = JSON.parse(raw) as Partial<CafeDexStore>;
      return { entries: Array.isArray(parsed.entries) ? parsed.entries : [] };
    } catch (error: unknown) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      if (code !== 'ENOENT') {
        console.warn('Failed to read CafeDex store', error);
      }
      return { entries: [] };
    }
  }

  private async writeStore(store: CafeDexStore): Promise<void> {
    const write = async () => {
      const storePath = this.getStorePath();
      await fs.mkdir(path.dirname(storePath), { recursive: true });
      await fs.writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, 'utf-8');
    };
    this.writeQueue = this.writeQueue.then(write, write);
    await this.writeQueue;
  }

  async list(gameId: string): Promise<CafeDexEntry[]> {
    const store = await this.readStore();
    return store.entries
      .filter((entry) => entry.gameId === gameId)
      .sort((a, b) => Number(b.broken) - Number(a.broken) || a.name.localeCompare(b.name));
  }

  async sync(gameId: string, sightings: CafeDexSighting[]): Promise<CafeDexEntry[]> {
    const store = await this.readStore();
    store.entries = syncCafeDex(store.entries, gameId, sightings, new Date().toISOString());
    await this.writeStore(store);
    return this.list(gameId);
  }

  async update(gameId: string, key: string, patch: CafeDexPatch): Promise<CafeDexEntry[]> {
    const store = await this.readStore();
    store.entries = updateCafeDex(store.entries, gameId, key, patch);
    await this.writeStore(store);
    return this.list(gameId);
  }
}

export const cafeDexService = new CafeDexService();
