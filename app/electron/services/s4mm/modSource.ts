/**
 * Best-effort download source for a mod that is not in the CurseForge catalog.
 * A package has no "came from Patreon" field. The only usable clues are a site
 * name in the folder path, the file name, or a plaintext link inside the file.
 */

export interface ModSourceHit {
  label: string;
  evidence: 'link' | 'filename' | 'folder';
}

interface SiteClue {
  label: string;
  tokens: string[];
  hosts: string[];
}

const SITES: SiteClue[] = [
  { label: 'Patreon', tokens: ['patreon'], hosts: ['patreon.com'] },
  { label: 'Tumblr', tokens: ['tumblr'], hosts: ['tumblr.com'] },
  { label: 'The Sims Resource', tokens: ['thesimsresource', 'tsr'], hosts: ['thesimsresource.com'] },
  { label: 'CurseForge', tokens: ['curseforge'], hosts: ['curseforge.com'] },
  { label: 'SimFileShare', tokens: ['simfileshare', 'sfs'], hosts: ['simfileshare.net'] },
  { label: 'Ko-fi', tokens: ['kofi', 'ko-fi'], hosts: ['ko-fi.com'] },
  { label: 'Boosty', tokens: ['boosty'], hosts: ['boosty.to'] },
  { label: 'itch.io', tokens: ['itchio', 'itch'], hosts: ['itch.io'] },
  { label: 'Mod The Sims', tokens: ['modthesims'], hosts: ['modthesims.info'] },
  { label: 'Nexus Mods', tokens: ['nexusmods', 'nexus'], hosts: ['nexusmods.com'] },
  { label: 'Gumroad', tokens: ['gumroad'], hosts: ['gumroad.com'] },
  { label: 'SubscribeStar', tokens: ['subscribestar'], hosts: ['subscribestar.com'] },
  { label: 'Discord', tokens: ['discord'], hosts: ['discord.com', 'discord.gg'] },
  { label: 'Blogspot', tokens: ['blogspot'], hosts: ['blogspot.com'] },
  { label: 'WordPress', tokens: ['wordpress'], hosts: ['wordpress.com'] },
  { label: 'SimsDom', tokens: ['simsdom'], hosts: ['simsdom.com'] },
  { label: 'DeviantArt', tokens: ['deviantart'], hosts: ['deviantart.com'] },
  { label: 'Pinterest', tokens: ['pinterest'], hosts: ['pinterest.com'] },
  { label: 'Instagram', tokens: ['instagram'], hosts: ['instagram.com'] },
  { label: 'TikTok', tokens: ['tiktok'], hosts: ['tiktok.com'] },
  { label: 'Twitter', tokens: ['twitter'], hosts: ['twitter.com', 'x.com'] },
];

const MAX_LINK_SCAN_BYTES = 12 * 1024 * 1024;

function tokensOf(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
}

function matchTokens(value: string): string | null {
  if (!value) return null;
  const tokens = new Set(tokensOf(value));
  const raw = value.toLowerCase();
  for (const site of SITES) {
    if (site.tokens.some((token) => tokens.has(token) || (token.includes('-') && raw.includes(token)))) {
      return site.label;
    }
  }
  return null;
}

function sampleForLinks(bytes: Uint8Array): string {
  const head = bytes.subarray(0, MAX_LINK_SCAN_BYTES);
  const chunks: string[] = [];
  const step = 0x8000;
  for (let offset = 0; offset < head.length; offset += step) {
    const slice = head.subarray(offset, offset + step);
    chunks.push(String.fromCharCode(...slice));
  }
  return chunks.join('').toLowerCase();
}

function matchLink(bytes: Uint8Array): string | null {
  const sample = sampleForLinks(bytes);
  for (const site of SITES) {
    if (site.hosts.some((host) => sample.includes(host))) {
      return site.label;
    }
  }
  return null;
}

export function sourceEvidenceText(hit: ModSourceHit): string {
  if (hit.evidence === 'link') return `Link inside the file points to ${hit.label}`;
  if (hit.evidence === 'filename') return `File name mentions ${hit.label}`;
  return `Folder name mentions ${hit.label}`;
}

export function detectModSource(input: {
  relativePath: string;
  bytes?: Uint8Array | null;
}): ModSourceHit | null {
  const relative = input.relativePath.replace(/\\/g, '/');
  const parts = relative.split('/').filter(Boolean);
  const fileName = parts.length > 0 ? parts[parts.length - 1] : relative;
  const folders = parts.slice(0, -1).join('/');

  if (input.bytes && input.bytes.length > 0) {
    const label = matchLink(input.bytes);
    if (label) return { label, evidence: 'link' };
  }

  const fromFile = matchTokens(fileName);
  if (fromFile) return { label: fromFile, evidence: 'filename' };

  const fromFolder = matchTokens(folders);
  if (fromFolder) return { label: fromFolder, evidence: 'folder' };

  return null;
}
