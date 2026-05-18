'use client';

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import Layout from '@/components/layouts/Layout';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import {
  filesystemToolsService,
  type D1RenameResult,
  type EmptyFolderEntry,
  type FilesystemDuplicateGroup,
  type FilesystemToolFile,
} from '@/lib/services/FilesystemToolsService';
import {
  advancedToolsService,
  type IdConflictItem,
  type PolycountItem,
} from '@/lib/services/AdvancedToolsService';
import DisablePacksPanel from '@/components/tools/DisablePacksPanel';
import CcDetectPanel from '@/components/tools/CcDetectPanel';
import { useToast } from '@/context/ToastContext';
import {
  ArrowClockwise,
  CheckCircle,
  Files,
  Folder,
  GridFour,
  Hash,
  MagnifyingGlass,
  Spinner,
  Star,
  Toolbox,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react';

type ToolId =
  | 'exact-same-file'
  | 'same-filename'
  | 'revert-d1'
  | 'cc-detect'
  | 'id-conflicts'
  | 'mesh-polycount'
  | 'disable-packs'
  | 'empty-folders';

type ToolStatus = 'ready';

interface ToolDefinition {
  id: ToolId;
  title: string;
  description: string;
  status: ToolStatus;
}

interface DuplicateResult {
  toolId: 'exact-same-file' | 'same-filename';
  groups: FilesystemDuplicateGroup[];
}

interface EmptyFolderResult {
  toolId: 'empty-folders';
  folders: EmptyFolderEntry[];
}

interface D1Result {
  toolId: 'revert-d1';
  files: FilesystemToolFile[];
  renameResult?: D1RenameResult | null;
}

interface IdConflictResult {
  toolId: 'id-conflicts';
  items: IdConflictItem[];
  fileCount: number;
}

interface PolycountResult {
  toolId: 'mesh-polycount';
  items: PolycountItem[];
  fileCount: number;
}

type ScanResult = DuplicateResult | EmptyFolderResult | D1Result | IdConflictResult | PolycountResult | null;

const duplicateTools: ToolDefinition[] = [
  {
    id: 'exact-same-file',
    title: 'Exact same file',
    description: 'Duplicate files with identical content are grouped together for review.',
    status: 'ready',
  },
  {
    id: 'same-filename',
    title: 'Same filename',
    description: 'Files that share the same filename are listed side by side.',
    status: 'ready',
  },
  {
    id: 'revert-d1',
    title: 'Revert [D1] file names',
    description: 'Reverses the [D1] rename pattern from older CC Café builds.',
    status: 'ready',
  },
];

const advancedTools: ToolDefinition[] = [
  {
    id: 'cc-detect',
    title: 'CC detect',
    description: 'Scans package files and previews embedded thumbnails.',
    status: 'ready',
  },
  {
    id: 'id-conflicts',
    title: 'ID conflicts',
    description: 'Lists all ID conflicts between multiple package files.',
    status: 'ready',
  },
  {
    id: 'mesh-polycount',
    title: 'Mesh/geometry polygon count',
    description: 'Searches for files that contain a large or small amount of polygons.',
    status: 'ready',
  },
  {
    id: 'disable-packs',
    title: 'Disable packs',
    description: 'Disable Sims 4 packs and kits.',
    status: 'ready',
  },
];

const utilityTools: ToolDefinition[] = [
  {
    id: 'empty-folders',
    title: 'Empty folders',
    description: 'Find empty folders and delete them.',
    status: 'ready',
  },
];

function ToolStatusBadge({ status }: { status: ToolStatus }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{
        backgroundColor: 'rgba(70, 200, 155, 0.18)',
        color: '#72efc4',
      }}
    >
      Ready
    </span>
  );
}

function ToolRow({
  tool,
  onOpen,
  compact = false,
}: {
  tool: ToolDefinition;
  onOpen: (toolId: ToolId) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`grid items-center gap-4 border-t ${compact ? 'grid-cols-[28px_1fr_auto]' : 'grid-cols-[32px_1fr_auto]'}`}
      style={{ borderColor: 'var(--border-color)' }}
    >
      <div className="flex items-center justify-center py-4 pl-5">
        <Star size={compact ? 18 : 22} color="var(--text-secondary)" />
      </div>
      <div className={compact ? 'py-4' : 'py-5'}>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            {tool.title}
          </h3>
          <ToolStatusBadge status={tool.status} />
        </div>
        <p className="mt-1 text-sm leading-5" style={{ color: 'var(--text-secondary)' }}>
          {tool.description}
        </p>
      </div>
      <div className={compact ? 'py-4 pr-5' : 'py-5 pr-5'}>
        <button
          onClick={() => onOpen(tool.id)}
          className="min-w-24 rounded-full px-5 py-2 text-sm font-semibold transition-colors"
          style={{
            backgroundColor: '#7cf262',
            color: '#111',
            cursor: 'pointer',
            opacity: 1,
          }}
        >
          Open
        </button>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: ComponentType<any>;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-[18px] border overflow-hidden"
      style={{
        backgroundColor: 'var(--ui-panel)',
        borderColor: 'var(--border-color)',
      }}
    >
      <div className="flex items-start gap-4 px-5 py-5">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            color: 'white',
          }}
        >
          <Icon size={28} weight="bold" />
        </div>
        <div className="min-w-0">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {description}
          </p>
        </div>
      </div>
      <div>{children}</div>
    </section>
  );
}

export default function ToolsPage() {
  const { showToast, dismissToast } = useToast();
  const [compactView, setCompactView] = useState(true);
  const [modsPath, setModsPath] = useState<string | null>(null);
  const [loadingTool, setLoadingTool] = useState<ToolId | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult>(null);
  const [showCcDetect, setShowCcDetect] = useState(false);
  const [showDisablePacks, setShowDisablePacks] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const ccDetectRef = useRef<HTMLDivElement>(null);
  const disablePacksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadModsPath();
  }, []);

  useEffect(() => {
    if (showDisablePacks) {
      requestAnimationFrame(() => {
        disablePacksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [showDisablePacks]);

  useEffect(() => {
    if (showCcDetect) {
      requestAnimationFrame(() => {
        ccDetectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [showCcDetect]);

  async function loadModsPath() {
    const path = await filesystemToolsService.getModsPath();
    setModsPath(path);
  }

  function showMissingPathToast() {
    showToast({
      type: 'error',
      title: 'Mods folder not configured',
      message: 'Open Settings and configure your Sims 4 Mods folder first.',
      duration: 3000,
    });
  }

  async function handleOpen(toolId: ToolId) {
    if (toolId === 'cc-detect') {
      setShowCcDetect(true);
      return;
    }

    if (toolId === 'disable-packs') {
      setShowDisablePacks(true);
      return;
    }

    if (!modsPath) {
      showMissingPathToast();
      return;
    }

    setLoadingTool(toolId);
    setScanResult(null);

    try {
      if (toolId === 'exact-same-file') {
        const groups = await filesystemToolsService.scanExactDuplicates(modsPath);
        setScanResult({ toolId, groups });
      } else if (toolId === 'same-filename') {
        const groups = await filesystemToolsService.scanDuplicateFilenames(modsPath);
        setScanResult({ toolId, groups });
      } else if (toolId === 'revert-d1') {
        const files = await filesystemToolsService.scanD1Candidates(modsPath);
        setScanResult({ toolId, files, renameResult: null });
      } else if (toolId === 'id-conflicts') {
        const result = await advancedToolsService.scanIdConflicts(modsPath);
        setScanResult({ toolId, ...result });
      } else if (toolId === 'mesh-polycount') {
        const result = await advancedToolsService.scanPolycount(modsPath);
        setScanResult({ toolId, ...result });
      } else if (toolId === 'empty-folders') {
        const folders = await filesystemToolsService.scanEmptyFolders(modsPath);
        setScanResult({ toolId, folders });
      } else {
        throw new Error(`Unhandled tool: ${toolId}`);
      }
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Tool failed',
        message: error?.message || 'Unable to run this tool.',
        duration: 3500,
      });
    } finally {
      setLoadingTool(null);
    }
  }

  async function handleDeleteEmptyFolders() {
    if (!scanResult || scanResult.toolId !== 'empty-folders') return;

    setShowDeleteConfirm(false);
    const toastId = showToast({
      type: 'download',
      title: 'Deleting empty folders',
      message: 'Removing empty folders from your Mods directory.',
      progress: 0,
      duration: 0,
    });

    let deleted = 0;
    const errors: string[] = [];

    for (const folder of scanResult.folders) {
      try {
        await window.electron.ipcRenderer.invoke('fs:remove', folder.path, { recursive: true });
        deleted++;
      } catch (error: any) {
        errors.push(error?.message || folder.path);
      }
    }

    dismissToast(toastId);
    showToast({
      type: errors.length > 0 ? 'warning' : 'success',
      title: errors.length > 0 ? 'Partial cleanup complete' : 'Empty folders removed',
      message:
        errors.length > 0
          ? `${deleted} folders deleted, ${errors.length} failed.`
          : `${deleted} folders deleted.`,
      duration: 3500,
    });

    setScanResult(null);
  }

  async function handleRevertD1() {
    if (!scanResult || scanResult.toolId !== 'revert-d1') return;

    setShowRevertConfirm(false);
    const toastId = showToast({
      type: 'download',
      title: 'Reverting [D1] names',
      message: 'Restoring older CC Café file names.',
      progress: 0,
      duration: 0,
    });

    try {
      const result = await filesystemToolsService.revertD1FileNames(modsPath!);
      setScanResult({
        toolId: 'revert-d1',
        files: scanResult.files,
        renameResult: result,
      });
      dismissToast(toastId);
      showToast({
        type: result.errors.length > 0 ? 'warning' : 'success',
        title: result.errors.length > 0 ? 'Revert completed with warnings' : 'Revert complete',
        message:
          result.errors.length > 0
            ? `${result.renamed} files renamed, ${result.errors.length} failed.`
            : `${result.renamed} files renamed.`,
        duration: 3500,
      });
    } catch (error: any) {
      dismissToast(toastId);
      showToast({
        type: 'error',
        title: 'Revert failed',
        message: error?.message || 'Unable to rename files.',
        duration: 3500,
      });
    }
  }

  return (
    <Layout>
      <main
        className="flex-1 min-w-0 overflow-hidden"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="h-full overflow-y-auto px-8 py-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Tools
              </h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                CC Café file maintenance tools for the Sims 4 Mods folder.
              </p>
            </div>

            <button
              onClick={() => setCompactView((value) => !value)}
              className="inline-flex items-center gap-3 rounded-full px-4 py-2 text-sm transition-colors"
              style={{
                backgroundColor: 'var(--ui-panel)',
                color: 'var(--text-secondary)',
              }}
            >
              <span>Group view</span>
              <GridFour size={18} />
            </button>
          </div>

          <div className="space-y-5">
            <SectionCard
              title="Duplicate files"
              description="The mod manager offers several tools that can help you find and sort out duplicate files."
              icon={Files}
            >
              {duplicateTools.map((tool) => (
                <ToolRow key={tool.id} tool={tool} onOpen={handleOpen} compact={compactView} />
              ))}
            </SectionCard>

            <SectionCard
              title="Package analysis"
              description="Inspect package files and preview embedded thumbnails."
              icon={MagnifyingGlass}
            >
              {advancedTools
                .filter((tool) => tool.id === 'cc-detect')
                .map((tool) => (
                  <ToolRow key={tool.id} tool={tool} onOpen={handleOpen} compact={compactView} />
                ))}
            </SectionCard>

            <SectionCard
              title="Advanced tools"
              description="These tools should only be used by people who know mods and CC well."
              icon={Toolbox}
            >
              {advancedTools
                .filter((tool) => tool.id !== 'cc-detect')
                .map((tool) => (
                  <ToolRow key={tool.id} tool={tool} onOpen={handleOpen} compact={compactView} />
                ))}
            </SectionCard>

            {showCcDetect && (
              <div ref={ccDetectRef}>
                <CcDetectPanel onClose={() => setShowCcDetect(false)} />
              </div>
            )}

            {showDisablePacks && (
              <div ref={disablePacksRef}>
                <DisablePacksPanel onClose={() => setShowDisablePacks(false)} />
              </div>
            )}

            <SectionCard
              title="Empty folders"
              description="Find empty folders and delete them."
              icon={Folder}
            >
              {utilityTools.map((tool) => (
                <ToolRow key={tool.id} tool={tool} onOpen={handleOpen} compact={compactView} />
              ))}
            </SectionCard>

            {scanResult && scanResult.toolId === 'exact-same-file' && (
              <section
                className="rounded-[18px] border"
                style={{
                  backgroundColor: 'var(--ui-panel)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--border-color)' }}>
                  <div>
                    <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Exact same file
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {scanResult.groups.length} duplicate groups found.
                    </p>
                  </div>
                  <div className="rounded-full px-3 py-1 text-sm font-semibold" style={{ backgroundColor: 'rgba(70, 200, 155, 0.14)', color: '#72efc4' }}>
                    {scanResult.groups.reduce((total, group) => total + group.items.length, 0)} files
                  </div>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                  {scanResult.groups.map((group, index) => (
                    <div key={`${group.key}-${index}`} className="px-5 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Hash size={16} color="var(--text-secondary)" />
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                              Group {index + 1}
                            </p>
                          </div>
                          <p className="mt-1 text-xs break-all" style={{ color: 'var(--text-secondary)' }}>
                            {group.key}
                          </p>
                        </div>
                        <div className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: 'var(--ui-hover)', color: 'var(--text-primary)' }}>
                          {group.items.length} files
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        {group.items.map((file) => (
                          <div
                            key={file.path}
                            className="rounded-xl px-3 py-2 text-sm"
                            style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', color: 'var(--text-secondary)' }}
                          >
                            {file.path}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {scanResult && scanResult.toolId === 'same-filename' && (
              <section
                className="rounded-[18px] border"
                style={{
                  backgroundColor: 'var(--ui-panel)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--border-color)' }}>
                  <div>
                    <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Same filename
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {scanResult.groups.length} filename groups found.
                    </p>
                  </div>
                  <div className="rounded-full px-3 py-1 text-sm font-semibold" style={{ backgroundColor: 'rgba(70, 200, 155, 0.14)', color: '#72efc4' }}>
                    {scanResult.groups.reduce((total, group) => total + group.items.length, 0)} files
                  </div>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                  {scanResult.groups.map((group, index) => (
                    <div key={`${group.key}-${index}`} className="px-5 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {group.items[0]?.name || group.key}
                          </p>
                          <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {group.items.length} files share this filename.
                          </p>
                        </div>
                        <div className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: 'var(--ui-hover)', color: 'var(--text-primary)' }}>
                          {group.items.length} files
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        {group.items.map((file) => (
                          <div
                            key={file.path}
                            className="rounded-xl px-3 py-2 text-sm"
                            style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', color: 'var(--text-secondary)' }}
                          >
                            {file.path}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {scanResult && scanResult.toolId === 'revert-d1' && (
              <section
                className="rounded-[18px] border"
                style={{
                  backgroundColor: 'var(--ui-panel)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="flex items-center justify-between gap-4 border-b px-5 py-4" style={{ borderColor: 'var(--border-color)' }}>
                  <div>
                    <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Revert [D1] file names
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {scanResult.files.length} files can be restored.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowRevertConfirm(true)}
                      className="rounded-full px-4 py-2 text-sm font-semibold text-white transition-colors"
                      style={{ backgroundColor: '#46C89B' }}
                    >
                      Revert all
                    </button>
                  </div>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                  {scanResult.files.map((file) => (
                    <div key={file.path} className="px-5 py-4">
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {file.name}
                      </div>
                      <div className="mt-1 text-xs break-all" style={{ color: 'var(--text-secondary)' }}>
                        {file.path}
                      </div>
                    </div>
                  ))}
                </div>
                {scanResult.renameResult && (
                  <div className="border-t px-5 py-4" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <span className="inline-flex items-center gap-2">
                        <CheckCircle size={16} color="#72efc4" />
                        {scanResult.renameResult.renamed} renamed
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <WarningCircle size={16} color="#f59e0b" />
                        {scanResult.renameResult.skipped} skipped
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Trash size={16} color="#ef4444" />
                        {scanResult.renameResult.errors.length} errors
                      </span>
                    </div>
                  </div>
                )}
              </section>
            )}

            {scanResult && scanResult.toolId === 'empty-folders' && (
              <section
                className="rounded-[18px] border"
                style={{
                  backgroundColor: 'var(--ui-panel)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="flex items-center justify-between gap-4 border-b px-5 py-4" style={{ borderColor: 'var(--border-color)' }}>
                  <div>
                    <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Empty folders
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {scanResult.folders.length} empty folders found.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={scanResult.folders.length === 0}
                    className="rounded-full px-4 py-2 text-sm font-semibold text-white transition-colors"
                    style={{
                      backgroundColor: scanResult.folders.length > 0 ? '#ef4444' : 'var(--ui-hover)',
                      opacity: scanResult.folders.length > 0 ? 1 : 0.65,
                      cursor: scanResult.folders.length > 0 ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Delete all
                  </button>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                  {scanResult.folders.map((folder) => (
                    <div key={folder.path} className="flex items-center gap-3 px-5 py-4">
                      <Folder size={18} color="var(--text-secondary)" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {folder.path.split(/[/\\]/).pop()}
                        </div>
                        <div className="text-xs break-all" style={{ color: 'var(--text-secondary)' }}>
                          {folder.path}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {scanResult && scanResult.toolId === 'id-conflicts' && (
              <section
                className="rounded-[18px] border"
                style={{
                  backgroundColor: 'var(--ui-panel)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="flex items-center justify-between gap-4 border-b px-5 py-4" style={{ borderColor: 'var(--border-color)' }}>
                  <div>
                    <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                      ID conflicts
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {scanResult.items.length} conflicting IDs found across {scanResult.fileCount} package files.
                    </p>
                  </div>
                  <div className="rounded-full px-3 py-1 text-sm font-semibold" style={{ backgroundColor: 'rgba(70, 200, 155, 0.14)', color: '#72efc4' }}>
                    {scanResult.items.length} conflicts
                  </div>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                  {scanResult.items.slice(0, 25).map((item, index) => (
                    <div key={`${item.key}-${index}`} className="px-5 py-4">
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {item.key}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {item.files.length} files share this ID
                      </p>
                      <div className="mt-3 space-y-2">
                        {item.files.map((file) => (
                          <div
                            key={`${item.key}-${file.path}-${file.name}`}
                            className="rounded-xl px-3 py-2 text-sm"
                            style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', color: 'var(--text-secondary)' }}
                          >
                            {file.name} - {file.path}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {scanResult && scanResult.toolId === 'mesh-polycount' && (
              <section
                className="rounded-[18px] border"
                style={{
                  backgroundColor: 'var(--ui-panel)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="flex items-center justify-between gap-4 border-b px-5 py-4" style={{ borderColor: 'var(--border-color)' }}>
                  <div>
                    <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Mesh/geometry polygon count
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {scanResult.items.length} package files with geometry found across {scanResult.fileCount} scanned packages.
                    </p>
                  </div>
                  <div className="rounded-full px-3 py-1 text-sm font-semibold" style={{ backgroundColor: 'rgba(70, 200, 155, 0.14)', color: '#72efc4' }}>
                    {scanResult.items.length} files
                  </div>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                  {scanResult.items.slice(0, 25).map((item) => (
                    <div key={item.path + item.name} className="px-5 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {item.name}
                          </p>
                          <p className="mt-1 text-xs break-all" style={{ color: 'var(--text-secondary)' }}>
                            {item.path}
                          </p>
                        </div>
                        <div className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: 'var(--ui-hover)', color: 'var(--text-primary)' }}>
                          {item.geometryCount} geometries
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <span>Faces total: {item.totalFaces}</span>
                        <span>Min: {item.minFaces}</span>
                        <span>Max: {item.maxFaces}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {loadingTool && (
              <section
                className="rounded-[18px] border px-5 py-4"
                style={{
                  backgroundColor: 'var(--ui-panel)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Spinner size={18} className="animate-spin" />
                  Running {loadingTool.replace(/-/g, ' ')}...
                </div>
              </section>
            )}

            {!scanResult && !loadingTool && (
              <section
                className="rounded-[18px] border px-5 py-4"
                style={{
                  backgroundColor: 'var(--ui-panel)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <ArrowClockwise size={18} />
                  Select a tool to scan your Mods folder.
                </div>
              </section>
            )}
          </div>
        </div>

        <ConfirmationModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteEmptyFolders}
          title="Delete empty folders"
          message={`Delete ${scanResult && scanResult.toolId === 'empty-folders' ? scanResult.folders.length : 0} empty folders from your Mods directory?`}
          confirmText="Delete"
          isDangerous
        />

        <ConfirmationModal
          isOpen={showRevertConfirm}
          onClose={() => setShowRevertConfirm(false)}
          onConfirm={handleRevertD1}
          title="Revert [D1] file names"
          message="Restore the original file names for every file that still uses the old [D1] prefix?"
          confirmText="Revert"
          isDangerous
        />
      </main>
    </Layout>
  );
}
