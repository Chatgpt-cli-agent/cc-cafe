/**
 * The two download labels the player can name and icon themselves.
 * Patreon and Tumblr stay the slots; the words and icons shown are theirs.
 */

import { getCompatStorageItem, setCompatStorageItem } from '@/lib/utils/storageCompat';

export const SOURCE_SLOTS = ['patreon', 'tumblr'] as const;
export type SourceSlot = (typeof SOURCE_SLOTS)[number];

export const SOURCE_ICON_IDS = [
  'patreon',
  'tumblr',
  'heart',
  'star',
  'gift',
  'coffee',
  'crown',
  'camera',
  'link',
  'tag',
  'bookmark',
  'storefront',
  'folder',
  'palette',
] as const;
export type SourceIconId = (typeof SOURCE_ICON_IDS)[number];

export interface SourceLabelStyle {
  label: string;
  icon: SourceIconId;
}

export type SourceLabelStyles = Record<SourceSlot, SourceLabelStyle>;
export type SourceAssignment = SourceSlot | 'none';

export const DEFAULT_SOURCE_LABELS: SourceLabelStyles = {
  patreon: { label: 'Patreon', icon: 'patreon' },
  tumblr: { label: 'Tumblr', icon: 'tumblr' },
};

const STYLES_KEY = 'cccafe_source_label_styles';
const ASSIGNMENTS_KEY = 'cccafe_source_label_assignments';

export function slotForDetectedSource(label: string | null | undefined): SourceSlot | null {
  const normalized = label?.trim().toLowerCase();
  if (normalized === 'patreon') return 'patreon';
  if (normalized === 'tumblr') return 'tumblr';
  return null;
}

export function isSourceIconId(value: string): value is SourceIconId {
  return (SOURCE_ICON_IDS as readonly string[]).includes(value);
}

export function sanitizeSourceLabels(value: unknown): SourceLabelStyles {
  const incoming = value && typeof value === 'object' ? (value as Partial<Record<SourceSlot, Partial<SourceLabelStyle>>>) : {};
  const styles = { ...DEFAULT_SOURCE_LABELS };
  for (const slot of SOURCE_SLOTS) {
    const raw = incoming[slot];
    const label = typeof raw?.label === 'string' ? raw.label.trim() : '';
    const icon = typeof raw?.icon === 'string' && isSourceIconId(raw.icon) ? raw.icon : styles[slot].icon;
    styles[slot] = {
      label: label || DEFAULT_SOURCE_LABELS[slot].label,
      icon,
    };
  }
  return styles;
}

export function chosenSlot(
  assignments: Record<string, SourceAssignment>,
  key: string,
  detectedLabel?: string | null
): SourceSlot | null {
  const chosen = assignments[key];
  if (chosen === 'none') return null;
  if (chosen === 'patreon' || chosen === 'tumblr') return chosen;
  return slotForDetectedSource(detectedLabel);
}

export function loadSourceLabels(): SourceLabelStyles {
  try {
    const stored = getCompatStorageItem(STYLES_KEY);
    return sanitizeSourceLabels(stored ? JSON.parse(stored) : null);
  } catch {
    return { ...DEFAULT_SOURCE_LABELS };
  }
}

export function saveSourceLabels(styles: SourceLabelStyles): void {
  const stored: SourceLabelStyles = { ...DEFAULT_SOURCE_LABELS };
  for (const slot of SOURCE_SLOTS) {
    stored[slot] = {
      label: styles[slot]?.label ?? '',
      icon: isSourceIconId(styles[slot]?.icon) ? styles[slot].icon : DEFAULT_SOURCE_LABELS[slot].icon,
    };
  }
  setCompatStorageItem(STYLES_KEY, JSON.stringify(stored));
}

export function loadSourceAssignments(): Record<string, SourceAssignment> {
  try {
    const stored = getCompatStorageItem(ASSIGNMENTS_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    if (!parsed || typeof parsed !== 'object') return {};
    const assignments: Record<string, SourceAssignment> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value === 'patreon' || value === 'tumblr' || value === 'none') {
        assignments[key] = value;
      }
    }
    return assignments;
  } catch {
    return {};
  }
}

export function saveSourceAssignments(assignments: Record<string, SourceAssignment>): void {
  setCompatStorageItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));
}
