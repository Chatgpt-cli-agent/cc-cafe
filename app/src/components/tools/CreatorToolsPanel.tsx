'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { filesystemToolsService } from '@/lib/services/FilesystemToolsService';
import { s4mmToolsService, type CreatorPackageInfo } from '@/lib/services/S4mmToolsService';
import S4mmPanelShell, { S4mmActionButton, S4mmEmptyState } from './S4mmPanelShell';

async function pickImage(): Promise<string | null> {
  const result = await window.electron.ipcRenderer.invoke('dialog:open', {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
  });
  if (!result || result.canceled || !result.filePaths?.[0]) return null;
  return result.filePaths[0];
}

async function pickOutput(defaultPath: string): Promise<string | null> {
  const result = await window.electron.ipcRenderer.invoke('dialog:save', {
    defaultPath,
    filters: [{ name: 'Sims 4 package', extensions: ['package'] }],
  });
  if (!result || result.canceled || !result.filePath) return null;
  return result.filePath;
}

export default function CreatorToolsPanel({ onClose }: { onClose?: () => void }) {
  const { showToast } = useToast();
  const [working, setWorking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existing, setExisting] = useState<CreatorPackageInfo[] | null>(null);
  const [showTips, setShowTips] = useState(true);
  const [tipsColor, setTipsColor] = useState('#FFFFFF');

  const runScan = useCallback(async () => {
    const modsPath = await filesystemToolsService.getModsPath();
    if (!modsPath) return;

    setLoading(true);
    try {
      const result = await s4mmToolsService.scanCreatorPackages(modsPath);
      setExisting(result.items);
    } catch {
      setExisting([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runScan();
  }, [runScan]);

  async function createPackage(kind: 'loading-screen' | 'main-menu') {
    const image = await pickImage();
    if (!image) return;

    const modsPath = await filesystemToolsService.getModsPath();
    const defaultName = kind === 'loading-screen' ? 'CC-Cafe-LoadingScreen.package' : 'CC-Cafe-MainMenu.package';
    const output = await pickOutput(modsPath ? `${modsPath}/${defaultName}` : defaultName);
    if (!output) return;

    setWorking(true);
    try {
      if (kind === 'loading-screen') {
        await s4mmToolsService.createLoadingScreen(output, image, { showTips, tipsColor });
      } else {
        await s4mmToolsService.createMainMenu(output, image);
      }
      showToast({
        type: 'success',
        title: kind === 'loading-screen' ? 'Loading screen created' : 'Main menu created',
        message: `Package saved to ${output}.`,
        duration: 3500,
      });
      void runScan();
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Creation failed',
        message: error?.message || 'Unable to create the package.',
        duration: 3500,
      });
    } finally {
      setWorking(false);
    }
  }

  async function handleRandomize() {
    const loadingScreens = (existing ?? []).filter((item) => item.kind === 'loading-screen');
    if (loadingScreens.length < 2) {
      showToast({
        type: 'warning',
        title: 'Not enough loading screens',
        message: 'At least two loading screen packages are needed to randomize.',
        duration: 3000,
      });
      return;
    }

    setWorking(true);
    try {
      const filePaths = loadingScreens.map((item) => `${item.path}/${item.name}`);
      const result = await s4mmToolsService.randomizeLoadingScreens(filePaths);
      const activated = result.onChanges[0]?.newFileName ?? 'a loading screen';
      showToast({
        type: 'success',
        title: 'Loading screen randomized',
        message: `${activated} is now active.`,
        duration: 3500,
      });
      void runScan();
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Randomize failed',
        message: error?.message || 'Unable to randomize loading screens.',
        duration: 3500,
      });
    } finally {
      setWorking(false);
    }
  }

  return (
    <S4mmPanelShell
      title="Loading screen & main menu creator"
      description="Turns an image into a custom loading screen or main menu override package (1920x1080, resized automatically)."
      onClose={onClose}
      loading={working || loading}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <S4mmActionButton onClick={() => void createPackage('loading-screen')} disabled={working}>
          Create loading screen…
        </S4mmActionButton>
        <S4mmActionButton onClick={() => void createPackage('main-menu')} disabled={working}>
          Create main menu…
        </S4mmActionButton>
        <S4mmActionButton tone="secondary" onClick={() => void handleRandomize()} disabled={working}>
          Randomize active loading screen
        </S4mmActionButton>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}>
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
          <input type="checkbox" checked={showTips} onChange={(event) => setShowTips(event.target.checked)} />
          Show loading screen tips
        </label>
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
          Tips color
          <input
            type="color"
            value={tipsColor}
            onChange={(event) => setTipsColor(event.target.value.toUpperCase())}
            disabled={!showTips}
          />
        </label>
      </div>

      <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        Existing override packages
      </h3>
      {existing && existing.length === 0 && (
        <S4mmEmptyState message="No loading screen or main menu packages found in the Mods folder." />
      )}
      <div className="space-y-2">
        {(existing ?? []).map((item) => (
          <div
            key={`${item.path}/${item.name}`}
            className="flex items-center justify-between gap-4 rounded-xl px-4 py-3"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {item.name}
              </p>
              <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                {item.path}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: 'var(--ui-hover)', color: 'var(--text-primary)' }}
              >
                {item.kind === 'loading-screen' ? 'Loading screen' : 'Main menu'}
              </span>
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={
                  item.active
                    ? { backgroundColor: 'rgba(70, 200, 155, 0.18)', color: '#72efc4' }
                    : { backgroundColor: 'var(--ui-hover)', color: 'var(--text-secondary)' }
                }
              >
                {item.active ? 'Active' : 'Off'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </S4mmPanelShell>
  );
}
