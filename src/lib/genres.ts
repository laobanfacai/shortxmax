import { prisma } from "./prisma";

export type PublicGenre = {
  slug: string;
  name: string;
  blurb: string;
  hook: string;
  offer: string;
  proof: string;
};

/** Seed + fallback copy if the Genre table is empty. */
export const DEFAULT_GENRES: PublicGenre[] = [
  {
    slug: "ceo-romance",
    name: "CEO Romance",
    blurb: "Ice-cold bosses, contract marriages, and the slow-burn look that ruins you.",
    hook: "He hired a wife. She was never supposed to stay.",
    offer: "Binge the contract, the kiss for the cameras, and the clause he hid — starting with free episodes.",
    proof: "The trope that turns a lunch break into a finished season.",
  },
  {
    slug: "revenge",
    name: "Revenge",
    blurb: "They buried her. She came back in silk, with a smile and a plan.",
    hook: "They took everything. She came back for the encore.",
    offer: "Watch the wound in the free episodes. Unlock the turn — the public ruin, the last laugh.",
    proof: "Short, sharp, and built for one-more-episode nights.",
  },
  {
    slug: "werewolf",
    name: "Werewolf",
    blurb: "Rejected mates, moonlit claims, and the bond he swore he didn't want.",
    hook: "He turned his back in the clearing. The moon did not.",
    offer: "Fated bonds, pack politics, and the walk-back you came for. First episodes free.",
    proof: "The rejected-mate hook that does not wait until episode seven.",
  },
  {
    slug: "hidden-identity",
    name: "Hidden Identity",
    blurb: "The maid, the florist, the nobody — until the bloodline papers land.",
    hook: "They rang for tea. She put on the family diamonds.",
    offer: "Start free in the foyer. Unlock the will, the portrait, and the name they erased.",
    proof: "Reveal stories designed to land before the paywall — and finish after it.",
  },
  {
    slug: "billionaire",
    name: "Billionaire",
    blurb: "Penthouses, vows with a price tag, and hearts that don't do discounts.",
    hook: "House rule number one: don't fall for the woman on the sofa.",
    offer: "Glass terraces, Friday weddings, and rules that break after midnight. Watch free, then go VIP.",
    proof: "Wealth, tension, and a finish-tonight catalog.",
  },
];

let cache: PublicGenre[] = DEFAULT_GENRES;

const UNMAPPED_LABELS: Record<string, string> = {
  catalog: "Short drama",
  uncategorized: "Short drama",
};

export function syncGenreName(slug: string) {
  return cache.find((g) => g.slug === slug)?.name ?? UNMAPPED_LABELS[slug] ?? slug;
}

function toPublic(g: {
  slug: string;
  name: string;
  blurb: string;
  hook: string;
  offer: string;
  proof: string;
}): PublicGenre {
  return { slug: g.slug, name: g.name, blurb: g.blurb, hook: g.hook, offer: g.offer, proof: g.proof };
}

export async function getEnabledGenres(): Promise<PublicGenre[]> {
  try {
    const rows = await prisma.genre.findMany({
      where: { isEnabled: true },
      orderBy: { sortOrder: "asc" },
    });
    if (rows.length) {
      cache = rows.map(toPublic);
      return cache;
    }
  } catch {
    // table may not exist during first migrate
  }
  return DEFAULT_GENRES;
}

export async function getAllGenres() {
  const rows = await prisma.genre.findMany({ orderBy: { sortOrder: "asc" } });
  return rows;
}

export async function getGenreBySlug(slug: string): Promise<PublicGenre | undefined> {
  try {
    const row = await prisma.genre.findUnique({ where: { slug } });
    if (row) return row.isEnabled ? toPublic(row) : undefined;
  } catch {
    /* fallback */
  }
  return DEFAULT_GENRES.find((g) => g.slug === slug);
}

export async function genreName(slug: string) {
  const g = await getGenreBySlug(slug);
  if (g) return g.name;
  const hidden = await prisma.genre.findUnique({ where: { slug } }).catch(() => null);
  return hidden?.name ?? UNMAPPED_LABELS[slug] ?? slug;
}
