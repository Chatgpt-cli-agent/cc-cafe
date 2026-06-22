import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

/**
 * In a packaged Electron app the Prisma schema and seed database live under
 * `resources/prisma` (read-only inside an AppImage/deb package). Copy the seed
 * `dev.db` into the user's writable data directory once and point Prisma at it.
 */
export function setupProductionDatabase(): void {
  if (!app.isPackaged) {
    return;
  }

  const userData = app.getPath('userData');
  const dbDir = path.join(userData, 'prisma');
  const dbPath = path.join(dbDir, 'dev.db');

  if (!fs.existsSync(dbPath)) {
    const template = path.join(process.resourcesPath, 'prisma', 'dev.db');
    if (fs.existsSync(template)) {
      fs.mkdirSync(dbDir, { recursive: true });
      fs.copyFileSync(template, dbPath);
    }
  }

  process.env.DATABASE_URL = `file:${dbPath}`;
}

setupProductionDatabase();
