import { app } from 'electron';

export function isDev(): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  if (process.env.NODE_ENV === 'production') return false;
  return !app.isPackaged;
}
