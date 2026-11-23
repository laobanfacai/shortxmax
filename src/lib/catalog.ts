import { prisma } from "./prisma";
import { parseJsonArray } from "./utils";

export function serializeSeries<
  T extends {
    tags: string;
    hook: string;
    coverUrl: string;
    slug: string;
    title: string;
    genre: string;
    rating: number;
    viewCount: number | bigint;
    freeEpisodeCount: number;
    totalEpisodes: number;
    isNew: boolean;
    isTrending: boolean;
  },
>(s: T) {
  return {
    ...s,
    tags: parseJsonArray(s.tags),
  };
}

export const UNMAPPED_GENRE = "catalog";

export async function publishedSeries(
  where: Record<string, unknown> = {},
  opts: { take?: number; skip?: number } = {},
) {
  return prisma.series.findMany({
    where: { status: "published", ...where },
    orderBy: [{ sortOrder: "asc" }, { viewCount: "desc" }],
    ...(opts.take ? { take: opts.take } : {}),
    ...(opts.skip ? { skip: opts.skip } : {}),
  });
}

/** Homepage rails and VIP landers stay on playable (demo) titles. */
export const playableWhere = { status: "published" as const, isCatalogOnly: false };

export async function getShowBySlug(slug: string) {
  const series = await prisma.series.findFirst({
    where: { slug, status: "published" },
    include: {
      episodes: {
        where: { isPublished: true },
        orderBy: { number: "asc" },
      },
      reviews: { where: { isHidden: false }, orderBy: { createdAt: "desc" }, take: 8 },
    },
  });
  return series;
}
