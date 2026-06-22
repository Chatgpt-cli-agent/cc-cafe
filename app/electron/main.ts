import './bootstrap';
import { app, BrowserWindow, ipcMain, protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { pathToFileURL } from 'url';
import { isDev } from './utils';
import { registerIpcHandlers } from './ipcHandlers';

let mainWindow: BrowserWindow | null = null;

const OUT_DIR = path.join(app.getAppPath(), 'out');
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
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Register IPC handlers
  registerIpcHandlers();

  if (isDev()) {
    mainWindow.loadURL('http://localhost:3000/splash');
    mainWindow.webContents.openDevTools();
  } else {
    // Start on the splash screen, then it redirects into the app.
    mainWindow.loadURL('app://app/splash');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Set up protocol before app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, allowServiceWorkers: true, supportFetchAPI: true } }
]);

app.on('ready', () => {
  if (!isDev()) {
    registerAppProtocol();
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
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
