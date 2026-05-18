'use client';
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { filesystemToolsService } from '@/lib/services/FilesystemToolsService';
import {
  ccDetectService,
  type CcDetectScanResult,
  type CcPackageItem,
  type CcThumbnailPreviewResult,
} from '@/lib/services/CcDetectService';
import {
  ArrowClockwise,
  CheckCircle,
  Folder,
  FileMagnifyingGlass as FileMagnifyingGlassIcon,
  MagnifyingGlass,
  Spinner,
  WarningCircle,
} from '@phosphor-icons/react';

interface PreviewImage {
  name: string;
  url: string;
}

function blobUrlFromBytes(bytes: Uint8Array, filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase();
  const mime =
    extension === 'jpg' || extension === 'jpeg'
      ? 'image/jpeg'
      : extension === 'webp'
        ? 'image/webp'
        : extension === 'gif'
          ? 'image/gif'
          : 'image/png';
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return URL.createObjectURL(new Blob([copy.buffer], { type: mime }));
}

function imageName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.split('/').pop() || filePath;
}

export default function CcDetectPanel({ onClose }: { onClose?: () => void }) {
  const { showToast } = useToast();
  const [modsPath, setModsPath] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<CcDetectScanResult | null>(null);
  const [loadingScan, setLoadingScan] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CcPackageItem | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [previewMeta, setPreviewMeta] = useState<CcThumbnailPreviewResult | null>(null);

  const loadModsPath = useCallback(async () => {
    const path = await filesystemToolsService.getModsPath();
    setModsPath(path);
  }, []);

  const runScan = useCallback(
    async (rootPath = modsPath) => {
      if (!rootPath) {
        showToast({
          type: 'error',
          title: 'Mods folder not configured',
          message: 'Open Settings and configure your Sims 4 Mods folder first.',
          duration: 3000,
        });
        return;
      }

      setLoadingScan(true);
      setPreviewImages([]);
      setPreviewMeta(null);
      setSelectedItem(null);

      try {
        const result = await ccDetectService.scanPackages(rootPath);
        setScanResult(result);
        setSelectedItem(result.items[0] ?? null);
        showToast({
          type: 'success',
          title: 'Scan complete',
          message: `${result.fileCount} package files scanned.`,
          duration: 2200,
        });
      } catch (error: any) {
        showToast({
          type: 'error',
          title: 'Scan failed',
          message: error?.message || 'Unable to inspect package files.',
          duration: 4000,
        });
      } finally {
        setLoadingScan(false);
      }
    },
    [modsPath, showToast]
  );

  useEffect(() => {
    void loadModsPath();
  }, [loadModsPath]);

  useEffect(() => {
    if (!modsPath) {
      return;
    }

    void runScan(modsPath);
  }, [modsPath, runScan]);

  useEffect(() => {
    return () => {
      for (const image of previewImages) {
        URL.revokeObjectURL(image.url);
      }
    };
  }, [previewImages]);

  const stats = useMemo(() => {
    const total = scanResult?.fileCount ?? 0;
    const withThumbs = scanResult?.filesWithThumbnails ?? 0;
    const thumbCount = scanResult?.thumbnailCount ?? 0;
    return { total, withThumbs, thumbCount };
  }, [scanResult]);

  async function previewPackage(item: CcPackageItem) {
    setSelectedItem(item);
    setPreviewLoading(true);
    setPreviewImages([]);
    setPreviewMeta(null);

    try {
      if (!item.hasThumbnails || item.thumbnailCount === 0) {
        showToast({
          type: 'info',
          title: 'No thumbnails found',
          message: 'This package did not expose embedded thumbnails.',
          duration: 2500,
        });
        return;
      }

      const result = await ccDetectService.extractThumbnails(item.path);
      const urls: PreviewImage[] = [];

      for (const filePath of result.files.slice(0, 12)) {
        const bytes = await window.electron.ipcRenderer.invoke('fs:readFile', filePath);
        const url = blobUrlFromBytes(bytes, filePath);
        urls.push({
          name: imageName(filePath),
          url,
        });
      }

      setPreviewImages(urls);
      setPreviewMeta(result);

      if (urls.length === 0) {
        showToast({
          type: 'warning',
          title: 'Thumbnails extracted',
          message: 'No previewable images were found in the extracted output.',
          duration: 3000,
        });
      }
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Preview failed',
        message: error?.message || 'Unable to extract thumbnails.',
        duration: 4000,
      });
    } finally {
      setPreviewLoading(false);
    }
  }

  async function openPreviewFolder() {
    if (!previewMeta) {
      return;
    }

    await ccDetectService.openPath(previewMeta.outputDir);
  }

  async function revealSelectedPackage() {
    if (!selectedItem) {
      return;
    }

    await window.electron.ipcRenderer.invoke('shell:showItemInFolder', selectedItem.path);
  }

  return (
    <section
      className="rounded-[18px] border overflow-hidden"
      style={{
        backgroundColor: 'var(--ui-panel)',
        borderColor: 'var(--border-color)',
      }}
    >
      <div
        className="flex flex-wrap items-start justify-between gap-4 border-b px-5 py-5"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              CC detect
            </h2>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: 'rgba(124, 242, 98, 0.16)', color: '#72efc4' }}
            >
              Ready
            </span>
          </div>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Scan package files, inspect their resource counts, and preview embedded thumbnails.
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <Folder size={15} />
            {modsPath ? modsPath : 'Mods folder not configured'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
              style={{ backgroundColor: 'var(--ui-hover)', color: 'var(--text-primary)' }}
            >
              Close
            </button>
          )}
          <button
            onClick={() => void loadModsPath()}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors"
            style={{ backgroundColor: 'var(--ui-hover)', color: 'var(--text-primary)' }}
          >
            <ArrowClockwise size={18} />
            Refresh path
          </button>
          <button
            onClick={() => void runScan()}
            disabled={loadingScan}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed"
            style={{
              backgroundColor: loadingScan ? 'var(--ui-hover)' : '#7cf262',
              color: loadingScan ? 'var(--text-secondary)' : '#111',
              opacity: loadingScan ? 0.85 : 1,
            }}
          >
            {loadingScan ? <Spinner size={18} className="animate-spin" /> : <MagnifyingGlass size={18} />}
            Scan mods
          </button>
        </div>
      </div>

      <div className="grid gap-5 px-5 py-5 xl:grid-cols-[minmax(0,1.6fr)_360px]">
        <div className="min-w-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[16px] border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
              <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                Package files
              </div>
              <div className="mt-2 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {stats.total}
              </div>
            </div>
            <div className="rounded-[16px] border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
              <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                With thumbnails
              </div>
              <div className="mt-2 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {stats.withThumbs}
              </div>
            </div>
            <div className="rounded-[16px] border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
              <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                Thumbnail resources
              </div>
              <div className="mt-2 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {stats.thumbCount}
              </div>
            </div>
          </div>

          <div className="rounded-[16px] border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
            <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Package list
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Select a package to extract and preview its thumbnails.
                  </div>
                </div>
                {scanResult && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <CheckCircle size={16} color="#72efc4" />
                    {scanResult.failedCount > 0 ? `${scanResult.failedCount} scans failed` : 'All scans completed'}
                  </div>
                )}
              </div>
            </div>

            <div className="max-h-[620px] divide-y overflow-y-auto" style={{ borderColor: 'var(--border-color)' }}>
              {!scanResult && !loadingScan && (
                <div className="px-4 py-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Run a scan to list package files in your Mods folder.
                </div>
              )}

              {scanResult?.items.map((item, index) => {
                const active = selectedItem?.path === item.path;

                return (
                  <button
                    key={`${item.path}-${index}`}
                    onClick={() => void previewPackage(item)}
                    className="w-full border-0 px-4 py-4 text-left transition-colors"
                    style={{
                      backgroundColor: active ? 'rgba(124, 242, 98, 0.08)' : 'transparent',
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <FileMagnifyingGlassIcon size={16} color={item.hasThumbnails ? '#72efc4' : 'var(--text-secondary)'} />
                          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {item.name}
                          </div>
                        </div>
                        <div className="mt-1 text-xs break-all" style={{ color: 'var(--text-secondary)' }}>
                          {item.path}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <div className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: 'var(--ui-hover)', color: 'var(--text-primary)' }}>
                          {item.resourceCount} resources
                        </div>
                        <div className="flex items-center gap-2 text-xs" style={{ color: item.hasThumbnails ? '#72efc4' : 'var(--text-secondary)' }}>
                          {item.hasThumbnails ? <CheckCircle size={14} /> : <WarningCircle size={14} />}
                          {item.thumbnailCount} thumbnails
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {loadingScan && (
                <div className="flex items-center gap-3 px-4 py-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Spinner size={18} className="animate-spin" />
                  Scanning package files...
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[16px] border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
            <div className="flex items-center gap-2">
              <FileMagnifyingGlassIcon size={18} color="var(--text-secondary)" />
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {selectedItem ? selectedItem.name : 'No package selected'}
              </div>
            </div>
            <p className="mt-2 text-sm leading-5" style={{ color: 'var(--text-secondary)' }}>
              {selectedItem
                ? 'Use the preview action to extract thumbnails from this package and inspect the images that were embedded in the file.'
                : 'Pick a package from the list to inspect its contents.'}
            </p>
            {selectedItem && (
              <div className="mt-3 space-y-2">
                <button
                  onClick={() => void previewPackage(selectedItem)}
                  disabled={previewLoading}
                  className="w-full rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: previewLoading ? 'var(--ui-hover)' : '#7cf262',
                    color: previewLoading ? 'var(--text-secondary)' : '#111',
                    opacity: previewLoading ? 0.85 : 1,
                  }}
                >
                  {previewLoading ? 'Extracting...' : 'Preview thumbnails'}
                </button>
                <button
                  onClick={() => void revealSelectedPackage()}
                  className="w-full rounded-full px-4 py-2 text-sm font-semibold transition-colors"
                  style={{ backgroundColor: 'var(--ui-hover)', color: 'var(--text-primary)' }}
                >
                  Reveal in Explorer
                </button>
              </div>
            )}
          </div>

          <div className="rounded-[16px] border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Extracted thumbnails
              </div>
              {previewMeta && (
                <button
                  onClick={() => void openPreviewFolder()}
                  className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
                  style={{ backgroundColor: 'var(--ui-hover)', color: 'var(--text-primary)' }}
                >
                  Open folder
                </button>
              )}
            </div>

            <div className="mt-3">
              {previewLoading && (
                <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Spinner size={18} className="animate-spin" />
                  Extracting images...
                </div>
              )}

              {!previewLoading && previewImages.length === 0 && (
                <div className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                  No preview loaded yet.
                </div>
              )}

              {previewImages.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {previewImages.map((image) => (
                    <figure key={image.url} className="space-y-1">
                      <div className="aspect-square overflow-hidden rounded-[14px] border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.03)' }}>
                        <img src={image.url} alt={image.name} className="h-full w-full object-cover" />
                      </div>
                      <figcaption className="break-all text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        {image.name}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[16px] border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
            <div className="flex items-center gap-2">
              <WarningCircle size={18} color="#f59e0b" />
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                What this does
              </div>
            </div>
            <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              This is a local package inspector built on the same DBPF reader used by the app. It surfaces resource counts, thumbnail counts, and extracted preview images without leaving the app.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
