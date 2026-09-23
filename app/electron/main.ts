import { app, BrowserWindow, ipcMain, protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { pathToFileURL } from 'url';
import { isDev } from './utils';

let mainWindow: BrowserWindow | null = null;
let ipcHandlersRegistered = false;

const OUT_DIR = path.join(app.getAppPath(), 'out');
const logStartup = (...args: unknown[]) => {
  console.log('[Main]', ...args);
};
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

function resolveExportedFile(urlPath: string): string | null {
  const decodedPath = decodeURIComponent(urlPath).replace(/^\/+/, '') || 'index.html';
  const normalizedPath = path.normalize(decodedPath);

  if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
    return null;
  }

  let filePath = path.join(OUT_DIR, normalizedPath);
  const isStaticAsset = /\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|otf|json|ico|txt|map)$/i.test(normalizedPath);

  if (isStaticAsset && !fs.existsSync(filePath)) {
    const rscMatch = normalizedPath.match(/^(.*?)(__next\.[^/\\]+)\.__PAGE__\.txt$/);
    if (rscMatch) {
      const rscPath = path.join(OUT_DIR, rscMatch[1], rscMatch[2], '__PAGE__.txt');
      if (fs.existsSync(rscPath)) {
        filePath = rscPath;
      }
    }
  }

  if (!isStaticAsset && !path.extname(filePath)) {
    const htmlPath = `${filePath}.html`;
    if (fs.existsSync(htmlPath)) {
      filePath = htmlPath;
    } else {
      const indexPath = path.join(filePath, 'index.html');
      if (fs.existsSync(indexPath)) {
        filePath = indexPath;
      }
    }
  }

  const relativePath = path.relative(OUT_DIR, filePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }

  return filePath;
}

async function fetchAppFile(filePath: string): Promise<Response> {
  if (!fs.existsSync(filePath)) {
    return new Response('Not Found', {
      status: 404,
      headers: { 'Content-Security-Policy': CONTENT_SECURITY_POLICY },
    });
  }

  const response = await net.fetch(pathToFileURL(filePath).toString());
  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  headers.set('X-Content-Type-Options', 'nosniff');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Register custom protocol for serving static files
function registerAppProtocol() {
  protocol.handle('app', async (request) => {
    try {
      const url = new URL(request.url);

      const filePath = resolveExportedFile(url.pathname);
      if (!filePath) {
        return new Response('Forbidden', {
          status: 403,
          headers: { 'Content-Security-Policy': CONTENT_SECURITY_POLICY },
        });
      }

      console.log(`[Protocol] Request: ${request.url} -> File: ${filePath}`);

      return fetchAppFile(filePath);
    } catch (error: any) {
      console.error(`[Protocol] Error handling ${request.url}:`, error);
      return new Response('Protocol Error', {
        status: 500,
        headers: { 'Content-Security-Policy': CONTENT_SECURITY_POLICY },
      });
    }
  });
}

function createWindow() {
  logStartup('Creating window', {
    appPath: app.getAppPath(),
    outDir: OUT_DIR,
    icon: path.join(OUT_DIR, 'cccafe.png'),
    packaged: app.isPackaged,
  });

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 640,
    resizable: true,
    icon: path.join(OUT_DIR, 'cccafe.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (!ipcHandlersRegistered) {
    try {
      const { registerIpcHandlers } = require('./ipcHandlers') as typeof import('./ipcHandlers');
      registerIpcHandlers();
      ipcHandlersRegistered = true;
      logStartup('IPC handlers registered');
    } catch (error) {
      console.error('[Main] Failed to register IPC handlers', error);
      throw error;
    }
  }

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[Main] Window failed to load', { errorCode, errorDescription, validatedURL });
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Main] Renderer process gone', details);
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.warn('[Main] Window became unresponsive');
  });

  if (isDev()) {
    void mainWindow.loadURL('http://localhost:3000/splash').catch((error) => {
      console.error('[Main] Failed to load dev URL', error);
    });
    mainWindow.webContents.openDevTools();
  } else {
    // Start on the splash screen, then it redirects into the app.
    void mainWindow.loadURL('app://app/splash').catch((error) => {
      console.error('[Main] Failed to load packaged URL', error);
    });
  }

  mainWindow.on('closed', () => {
    logStartup('Window closed');
    mainWindow = null;
  });
}

// Set up protocol before app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, allowServiceWorkers: true, supportFetchAPI: true } }
]);

app.on('ready', () => {
  logStartup('App ready');
  if (!isDev()) {
    registerAppProtocol();
  }
  createWindow();
});

app.on('window-all-closed', () => {
  logStartup('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  logStartup('Before quit');
});

app.on('will-quit', () => {
  logStartup('Will quit');
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Basic IPC handlers for now
ipcMain.handle('ping', async () => {
  return 'pong';
});
