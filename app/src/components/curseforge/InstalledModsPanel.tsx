'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  BookmarkSimple,
  Camera,
  Coffee,
  Crown,
  Folder,
  Gift,
  Heart,
  LinkSimple,
  MagnifyingGlass,
  Package,
  Palette,
  Spinner,
  Star,
  Storefront,
  Tag,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { useToast } from '@/context/ToastContext';
import { getCurseForgeApiKey } from '@/lib/curseforgeApi';
import {
  groupInstalledFolderFiles,
  type InstalledFolderGroup,
} from '@/lib/installedModsFolder';
import { detectModSource, sourceEvidenceText } from '@/lib/modSource';
import {
  chosenSlot,
  loadSourceAssignments,
  loadSourceLabels,
  saveSourceAssignments,
  saveSourceLabels,
  SOURCE_ICON_IDS,
  SOURCE_SLOTS,
  type SourceAssignment,
  type SourceIconId,
  type SourceLabelStyles,
  type SourceSlot,
} from '@/lib/sourceLabels';
import { filesystemToolsService } from '@/lib/services/FilesystemToolsService';
import { s4mmToolsService } from '@/lib/services/S4mmToolsService';
import type { ModProfile } from '@/types/profile';

interface InstalledModsPanelProps {
  activeProfile: ModProfile | null;
}

const SOURCE_ICON_COMPONENTS: Record<Exclude<SourceIconId, 'patreon' | 'tumblr'>, Icon> = {
  heart: Heart,
  star: Star,
  gift: Gift,
  coffee: Coffee,
  crown: Crown,
  camera: Camera,
  link: LinkSimple,
  tag: Tag,
  bookmark: BookmarkSimple,
  storefront: Storefront,
  folder: Folder,
  palette: Palette,
};

function PatreonMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8" cy="12" r="5" fill="#FF424D" />
      <rect x="12.5" y="7" width="5" height="14" rx="2.5" fill="#FF424D" />
    </svg>
  );
}

function TumblrMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#001935" />
      <path
        fill="#fff"
        d="M14.6 17.4c-1.6.2-2.1-.8-2.3-1.5V10h2.5V8.1h-2.5V5.4h-2c-.1.8-.4 1.5-1 2-.6.5-1.1.7-1.7.8v1.8h1.6v4.8c0 1.7 1.2 4 4.4 3.9 1.1 0 2.3-.4 2.6-1.2l-1.6-.1z"
      />
    </svg>
  );
}

function SourceGlyph({ icon, size = 16 }: { icon: SourceIconId; size?: number }) {
  if (icon === 'patreon') return <PatreonMark size={size} />;
  if (icon === 'tumblr') return <TumblrMark size={size} />;
  const Glyph = SOURCE_ICON_COMPONENTS[icon];
  return <Glyph size={size} weight="fill" />;
}

function LocalModMark() {
  return (
    <span title="Local mod" className="group/local relative inline-flex shrink-0 text-neutral-400">
      <Folder size={16} />
      <span className="pointer-events-none absolute top-full left-1/2 z-10 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-neutral-800 px-2 py-1 text-xs text-white shadow group-hover/local:block">
        Local mod
      </span>
    </span>
  );
}

function SourceLine({ label, evidence }: { label: string; evidence?: 'link' | 'filename' | 'folder' | null }) {
  const title = evidence ? sourceEvidenceText({ label, evidence }) : label;
  return (
    <div className="truncate text-xs text-neutral-400" title={title}>
      {label}
    </div>
  );
}

function SourceChoice({
  itemKey,
  detectedLabel,
  evidence,
  local,
  styles,
  assignments,
  onAssign,
}: {
  itemKey: string;
  detectedLabel?: string | null;
  evidence?: 'link' | 'filename' | 'folder' | null;
  local: boolean;
  styles: SourceLabelStyles;
  assignments: Record<string, SourceAssignment>;
  onAssign: (key: string, value: SourceAssignment | '') => void;
}) {
  const slot = chosenSlot(assignments, itemKey, detectedLabel);
  const style = slot ? styles[slot] : null;
  const manual = assignments[itemKey];

  return (
    <div className="mt-1 space-y-1">
      {style ? (
        <div className="flex items-center gap-1.5 text-xs text-brand-green">
          <SourceGlyph icon={style.icon} size={14} />
          <span className="truncate">{style.label}</span>
        </div>
      ) : detectedLabel ? (
        <SourceLine label={detectedLabel} evidence={evidence} />
      ) : null}
      {local ? (
        <select
          aria-label={`Label for ${itemKey}`}
          value={manual ?? ''}
          onChange={(event) => onAssign(itemKey, event.target.value as SourceAssignment | '')}
          className="w-full rounded border border-white/10 bg-neutral-950 px-1 py-1 text-xs text-neutral-300"
        >
          <option value="">Auto</option>
          {SOURCE_SLOTS.map((option) => (
            <option key={option} value={option}>{styles[option].label}</option>
          ))}
          <option value="none">No label</option>
        </select>
      ) : null}
    </div>
  );
}

function ModThumb({ logo, name, local }: { logo?: string; name: string; local: boolean }) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg bg-neutral-800">
      {logo ? (
        <Image src={logo} alt={name} fill unoptimized className="object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-neutral-500">
          <Package size={56} weight="duotone" />
        </div>
      )}
      {local ? <span className="sr-only">Local mod</span> : null}
    </div>
  );
}

export default function InstalledModsPanel({ activeProfile }: InstalledModsPanelProps) {
  const { showToast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState('');
  const [modsPath, setModsPath] = useState<string | null>(null);
  const [groups, setGroups] = useState<InstalledFolderGroup[] | null>(null);
  const [labelStyles, setLabelStyles] = useState<SourceLabelStyles>(() => loadSourceLabels());
  const [assignments, setAssignments] = useState<Record<string, SourceAssignment>>(() => loadSourceAssignments());

  useEffect(() => {
    setLabelStyles(loadSourceLabels());
    setAssignments(loadSourceAssignments());
  }, []);

  function updateStyle(slot: SourceSlot, patch: Partial<SourceLabelStyles[SourceSlot]>) {
    const next = {
      ...labelStyles,
      [slot]: { ...labelStyles[slot], ...patch },
    };
    setLabelStyles(next);
    saveSourceLabels(next);
  }

  function assignSource(key: string, value: SourceAssignment | '') {
    const next = { ...assignments };
    if (!value) {
      delete next[key];
    } else {
      next[key] = value;
    }
    setAssignments(next);
    saveSourceAssignments(next);
  }

  const profileMods = activeProfile?.mods ?? [];
  const curseForgeCount = groups?.filter((group) => group.kind === 'curseforge').length ?? 0;
  const localCount = groups?.filter((group) => group.local).length ?? 0;

  async function scanModsFolder() {
    const root = await filesystemToolsService.getModsPath();
    if (!root) {
      showToast({
        type: 'error',
        title: 'Mods folder not configured',
        message: 'Set your Sims 4 Mods folder in Settings first.',
        duration: 3000,
      });
      return;
    }

    setScanning(true);
    setModsPath(root);
    setGroups(null);
    try {
      setProgress('Reading files in the Mods folder…');
      const scan = await s4mmToolsService.scanFingerprints(root);
      let matches: Awaited<ReturnType<typeof s4mmToolsService.matchFingerprints>>['matches'] = [];

      const apiKey = await getCurseForgeApiKey();
      if (apiKey && scan.files.length > 0) {
        setProgress(`Matching ${scan.files.length} files to CurseForge…`);
        const matched = await s4mmToolsService.matchFingerprints(
          apiKey,
          scan.files.map((file) => file.fingerprint)
        );
        matches = matched.matches;
      }

      setGroups(
        groupInstalledFolderFiles({
          modsPath: root,
          files: scan.files,
          matches,
          profileMods,
        })
      );
      showToast({
        type: 'success',
        title: 'Mods folder scanned',
        message: `${scan.files.length} files found in the Mods folder.`,
        duration: 2500,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to scan the Mods folder.';
      showToast({
        type: 'error',
        title: 'Scan failed',
        message,
        duration: 4000,
      });
    } finally {
      setScanning(false);
      setProgress('');
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 pb-12">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="rounded-lg border border-white/10 bg-neutral-900 p-8">
          <div className="text-sm font-bold uppercase tracking-wide text-brand-green">My Mods</div>
          <h2 className="mt-2 text-4xl font-bold text-white">What is in the Mods folder</h2>
          <p className="mt-3 max-w-2xl text-neutral-400">
            Mods that are not in the CurseForge catalog are still detected and marked with a folder icon. Patreon and Tumblr use the label and icon you set below, and you can put either one on a local mod.
            {activeProfile
              ? ` ${activeProfile.name} currently tracks ${profileMods.length}.`
              : ' Select a profile, then scan the Mods folder.'}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void scanModsFolder()}
              disabled={scanning}
              className="inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-2.5 font-bold text-black hover:bg-brand-dark disabled:opacity-50 cursor-pointer"
            >
              {scanning ? <Spinner size={18} className="animate-spin" /> : <MagnifyingGlass size={18} />}
              {scanning ? 'Scanning' : 'Scan mods folder'}
            </button>
            {progress ? <span className="text-sm text-neutral-500">{progress}</span> : null}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-neutral-900 p-5">
          <div className="font-bold text-white">Your labels</div>
          <p className="mt-1 text-sm text-neutral-400">These two are yours. Change the name and the icon, then apply one to a local mod.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {SOURCE_SLOTS.map((slot) => (
              <div key={slot} className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                  <span className="text-brand-green"><SourceGlyph icon={labelStyles[slot].icon} /></span>
                  {labelStyles[slot].label}
                </div>
                <label className="block text-xs text-neutral-400">
                  Label
                  <input
                    value={labelStyles[slot].label}
                    onChange={(event) => updateStyle(slot, { label: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white"
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SOURCE_ICON_IDS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      title={icon}
                      onClick={() => updateStyle(slot, { icon })}
                      className={`rounded-lg p-2 cursor-pointer ${
                        labelStyles[slot].icon === icon
                          ? 'bg-brand-green text-black'
                          : 'bg-white/10 text-neutral-300 hover:bg-white/20'
                      }`}
                    >
                      <SourceGlyph icon={icon} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-white/10 bg-neutral-900">
          <div className="border-b border-white/10 px-5 py-4 font-bold text-white">
            Tracked in {activeProfile?.name || 'this profile'}
            <span className="ml-2 text-sm font-normal text-neutral-400">{profileMods.length}</span>
          </div>
          {profileMods.length === 0 ? (
            <div className="px-5 py-8 text-neutral-400">This profile does not have any tracked mods yet.</div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4 p-5">
              {profileMods.map((mod) => {
                const local = Boolean(mod.isLocal);
                const source = detectModSource({
                  relativePath: mod.libraryPaths?.[0] || mod.fileName,
                });
                return (
                  <div key={`${mod.fileName}-${mod.modId ?? mod.localModId ?? mod.modName}`} className="min-w-0">
                    <ModThumb logo={mod.logo} name={mod.modName} local={local} />
                    <div className="mt-2 flex items-center gap-1.5 text-sm text-neutral-200">
                      {local ? <LocalModMark /> : null}
                      <span className="truncate">{mod.modName}</span>
                    </div>
                    <SourceChoice
                      itemKey={mod.fileName}
                      detectedLabel={source?.label}
                      evidence={source?.evidence}
                      local={local}
                      styles={labelStyles}
                      assignments={assignments}
                      onAssign={assignSource}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-white/10 bg-neutral-900">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="font-bold text-white">Mods folder</div>
            {groups ? (
              <div className="text-sm text-neutral-400">
                {groups.length} mods · {curseForgeCount} on CurseForge · {localCount} local
              </div>
            ) : null}
          </div>
          {!groups && !scanning ? (
            <div className="px-5 py-12 text-center">
              <div className="text-lg font-bold text-white">Scan mods folder</div>
              <p className="mx-auto mt-2 max-w-md text-sm text-neutral-400">
                This lists the packages in your Sims 4 Mods folder. The count above only covers mods this profile already tracks.
              </p>
            </div>
          ) : null}
          {scanning && !groups ? (
            <div className="px-5 py-8 text-neutral-400">Scanning the Mods folder…</div>
          ) : null}
          {groups && groups.length === 0 ? (
            <div className="px-5 py-8 text-neutral-400">
              No package or script files were found{modsPath ? ` in ${modsPath}` : ''}.
            </div>
          ) : null}
          {groups && groups.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4 p-5">
              {groups.map((group) => (
                <div key={group.key} className="min-w-0" title={group.files.join(', ')}>
                  <ModThumb logo={group.logo} name={group.title} local={group.local} />
                  <div className="mt-2 flex items-center gap-1.5 text-sm text-neutral-200">
                    {group.local ? <LocalModMark /> : null}
                    <span className="truncate">{group.title}</span>
                  </div>
                  <SourceChoice
                    itemKey={group.files[0] ?? group.key}
                    detectedLabel={group.source}
                    evidence={group.sourceEvidence}
                    local={group.local}
                    styles={labelStyles}
                    assignments={assignments}
                    onAssign={assignSource}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
