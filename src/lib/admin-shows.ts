import { prisma } from "./prisma";
import { ADMIN_SHOW_PAGE_SIZE, clampPage, pageCount, parsePage } from "./pagination";
import type { Prisma } from "@prisma/client";

export type AdminShowQuery = {
  q?: string;
  source?: string;
  video?: string;
  paid?: string;
  status?: string;
  update?: string;
  page?: string;
};

export async function adminShowSearch(sp: AdminShowQuery) {
  const where: Prisma.SeriesWhereInput = {};
  const q = (sp.q || "").trim();
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { originalTitle: { contains: q } },
      { slug: { contains: q } },
      { externalId: { contains: q } },
      { externalTradeId: { contains: q } },
      { externalPk: { contains: q } },
      { source: { contains: q } },
    ];
  }
  if (sp.source) where.source = sp.source;
  if (sp.video === "catalog") where.isCatalogOnly = true;
  if (sp.video === "playable") where.isCatalogOnly = false;
  if (sp.paid === "paid") where.isPaid = true;
  if (sp.paid === "free") where.isPaid = false;
  if (sp.status === "published" || sp.status === "archived" || sp.status === "draft") {
    where.status = sp.status;
  }
  if (sp.update === "ongoing" || sp.update === "ended") where.updateStatus = sp.update;

  const total = await prisma.series.count({ where });
  const pages = pageCount(total, ADMIN_SHOW_PAGE_SIZE);
  const page = clampPage(parsePage(sp.page), pages);
  const shows = await prisma.series.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * ADMIN_SHOW_PAGE_SIZE,
    take: ADMIN_SHOW_PAGE_SIZE,
    include: { _count: { select: { episodes: true } } },
  });
  return { shows, total, page, pages, perPage: ADMIN_SHOW_PAGE_SIZE };
}

export async function catalogImportStats() {
  const [total, imported, playable, catalogOnly, paid, free, ongoing, ended, sources] = await Promise.all([
    prisma.series.count(),
    prisma.series.count({ where: { externalId: { not: null } } }),
    prisma.series.count({ where: { isCatalogOnly: false } }),
    prisma.series.count({ where: { isCatalogOnly: true } }),
    prisma.series.count({ where: { externalId: { not: null }, isPaid: true } }),
    prisma.series.count({ where: { externalId: { not: null }, isPaid: false } }),
    prisma.series.count({ where: { externalId: { not: null }, updateStatus: "ongoing" } }),
    prisma.series.count({ where: { externalId: { not: null }, updateStatus: "ended" } }),
    prisma.series.groupBy({
      by: ["source"],
      where: { externalId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { source: "desc" } },
    }),
  ]);
  return { total, imported, playable, catalogOnly, paid, free, ongoing, ended, sources };
}

export async function distinctSources() {
  const rows = await prisma.series.findMany({
    where: { source: { not: null } },
    distinct: ["source"],
    select: { source: true },
    orderBy: { source: "asc" },
    take: 50,
  });
  return rows.map((r) => r.source!).filter(Boolean);
}
