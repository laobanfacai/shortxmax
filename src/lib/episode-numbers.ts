/**
 * Episode-number parsing and gap-compaction for admin batch upload.
 * Public-facing titles stay English ("Episode N"); this module is shared
 * by the admin UI and server actions.
 */

export type ExistingEpisode = {
  id: string;
  number: number;
  title: string;
  videoUrl?: string | null;
  synopsis?: string | null;
  durationSec?: number;
  thumbnailUrl?: string | null;
  isFree?: boolean;
  isPublished?: boolean;
  coinPrice?: number;
};

export type IncomingFile = {
  filename: string;
  videoUrl?: string | null;
  title?: string;
  durationSec?: number;
};

export type EpisodePlanItem = {
  kind: "existing" | "new";
  id?: string;
  filename?: string;
  title: string;
  originalTitle: string;
  videoUrl?: string | null;
  /** Parsed from the filename (new) or the stored number (existing). */
  sourceNumber: number | null;
  /** Number after resolving unparsed/collision, before gap compaction. */
  originalNumber: number;
  /** Final number that will be written. */
  assignedNumber: number;
  /** True when the item moved forward to fill a missing earlier slot. */
  shifted: boolean;
  parseFailed: boolean;
  conflict: boolean;
  durationSec?: number;
  synopsis?: string | null;
  thumbnailUrl?: string | null;
  isPublished?: boolean;
  coinPrice?: number;
};

export type EpisodePlan = {
  items: EpisodePlanItem[];
  hasGaps: boolean;
  /** Original numbers that were missing before compaction (e.g. [5] for 1,2,3,4,6…). */
  missingNumbers: number[];
  willChange: boolean;
};

const MAX_EPISODE = 999;

function basename(filename: string) {
  const trimmed = String(filename || "").trim();
  const noSlash = trimmed.replace(/^.*[/\\]/, "");
  return noSlash.replace(/\.[^.]+$/, "");
}

function asEpisode(n: number): number | null {
  if (!Number.isInteger(n) || n < 1 || n > MAX_EPISODE) return null;
  return n;
}

/**
 * Read an episode number from a video filename.
 * Preference: S01E01 → EP01 / Episode 01 → E01 → 第1集 → leading or trailing digits.
 * Four-digit years (19xx / 20xx) are ignored.
 */
export function parseEpisodeNumber(filename: string): number | null {
  const base = basename(filename);
  if (!base) return null;

  const patterns: RegExp[] = [
    /\bS\d{1,2}[\s._-]*E(\d{1,3})\b/i,
    /\bEP(?:isode)?[\s._-]*(\d{1,3})\b/i,
    /第\s*(\d{1,3})\s*集/,
    /\bE([\s._-]*\d{1,3})\b/i,
    /(?:^|[_\s.-])(\d{1,3})$/,
    /^(\d{1,3})(?:[_\s.-]|$)/,
  ];

  for (const re of patterns) {
    const m = base.match(re);
    if (!m) continue;
    const raw = String(m[1]).replace(/[^\d]/g, "");
    const n = asEpisode(Number(raw));
    if (n) return n;
  }
  return null;
}

export function seriesHasGaps(numbers: number[]): boolean {
  const uniq = [...new Set(numbers.filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
  if (uniq.length === 0) return false;
  return uniq[0] !== 1 || uniq[uniq.length - 1] !== uniq.length || uniq.some((n, i) => n !== i + 1);
}

export function missingEpisodeNumbers(numbers: number[]): number[] {
  const uniq = [...new Set(numbers.filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
  if (uniq.length === 0) return [];
  const max = Math.max(uniq[uniq.length - 1], uniq.length);
  const have = new Set(uniq);
  const missing: number[] = [];
  for (let i = 1; i <= max; i++) {
    if (!have.has(i)) missing.push(i);
  }
  return missing;
}

function nextUnused(used: Set<number>) {
  let n = 1;
  while (used.has(n)) n += 1;
  return n;
}

function defaultTitle(n: number) {
  return `Episode ${n}`;
}

function retitleIfGeneric(title: string, from: number, to: number) {
  const t = (title || "").trim();
  if (!t || t === defaultTitle(from) || t === `第${from}集` || t === `第 ${from} 集`) {
    return defaultTitle(to);
  }
  return title;
}

export function buildEpisodePlan(opts: {
  existing: ExistingEpisode[];
  incoming?: IncomingFile[];
  compactGaps: boolean;
}): EpisodePlan {
  const existing = [...(opts.existing || [])];
  const incoming = [...(opts.incoming || [])];
  const used = new Set<number>();

  const draft: Omit<EpisodePlanItem, "assignedNumber" | "shifted" | "title">[] = [];

  for (const ep of existing) {
    const num = asEpisode(ep.number);
    if (num) used.add(num);
    draft.push({
      kind: "existing",
      id: ep.id,
      title: ep.title,
      videoUrl: ep.videoUrl,
      sourceNumber: ep.number,
      originalNumber: num || ep.number,
      parseFailed: false,
      conflict: false,
      durationSec: ep.durationSec,
      synopsis: ep.synopsis,
      thumbnailUrl: ep.thumbnailUrl,
      isPublished: ep.isPublished,
      coinPrice: ep.coinPrice,
    } as Omit<EpisodePlanItem, "assignedNumber" | "shifted" | "title"> & { title: string });
  }

  // First pass: claim uniquely parsed incoming numbers.
  const incomingParsed = incoming.map((file, index) => ({
    file,
    index,
    parsed: parseEpisodeNumber(file.filename),
  }));

  for (const row of incomingParsed) {
    let original: number;
    let conflict = false;
    const parseFailed = row.parsed == null;
    if (row.parsed && !used.has(row.parsed)) {
      original = row.parsed;
      used.add(original);
    } else {
      original = nextUnused(used);
      used.add(original);
      conflict = row.parsed != null;
    }
    draft.push({
      kind: "new",
      filename: row.file.filename,
      videoUrl: row.file.videoUrl,
      sourceNumber: row.parsed,
      originalNumber: original,
      parseFailed,
      conflict,
      durationSec: row.file.durationSec,
      // stash preferred title on a side field via any — applied later
      preferredTitle: row.file.title,
      incomingIndex: row.index,
    } as unknown as Omit<EpisodePlanItem, "assignedNumber" | "shifted" | "title">);
  }

  const preNumbers = draft.map((d) => d.originalNumber);
  const missingNumbers = missingEpisodeNumbers(preNumbers);
  const hasGaps = missingNumbers.length > 0;

  const ordered = draft.map((d, i) => ({ d, i }));
  ordered.sort((a, b) => {
    if (a.d.originalNumber !== b.d.originalNumber) return a.d.originalNumber - b.d.originalNumber;
    if (a.d.kind !== b.d.kind) return a.d.kind === "existing" ? -1 : 1;
    return a.i - b.i;
  });

  const items: EpisodePlanItem[] = ordered.map((entry, idx) => {
    const d = entry.d as EpisodePlanItem & { preferredTitle?: string };
    const assignedNumber = opts.compactGaps ? idx + 1 : d.originalNumber;
    const shifted = assignedNumber !== d.originalNumber;
    const preferred = (d.preferredTitle || "").trim();
    const originalTitle = d.kind === "existing" ? d.title : preferred || d.filename || defaultTitle(d.originalNumber);
    let title: string;
    if (d.kind === "existing") {
      title = retitleIfGeneric(d.title, d.originalNumber, assignedNumber);
    } else if (preferred) {
      title = preferred;
    } else {
      title = defaultTitle(assignedNumber);
    }
    return {
      kind: d.kind,
      id: d.id,
      filename: d.filename,
      title,
      originalTitle,
      videoUrl: d.videoUrl,
      sourceNumber: d.sourceNumber,
      originalNumber: d.originalNumber,
      assignedNumber,
      shifted,
      parseFailed: d.parseFailed,
      conflict: d.conflict,
      durationSec: d.durationSec,
      synopsis: d.synopsis,
      thumbnailUrl: d.thumbnailUrl,
      isPublished: d.isPublished,
      coinPrice: d.coinPrice,
    };
  });

  // Keep a stable display order: final number, then original.
  items.sort((a, b) => a.assignedNumber - b.assignedNumber || a.originalNumber - b.originalNumber);

  return {
    items,
    hasGaps,
    missingNumbers,
    willChange: items.some((it) => it.shifted || it.kind === "new"),
  };
}
