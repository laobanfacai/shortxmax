import type { Metadata } from "next";
import { PosterCard } from "@/components/public/PosterCard";
import { Pager } from "@/components/public/Pager";
import { CatalogFilters } from "@/components/public/CatalogFilters";
import { buildMetadata, JsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/lib/site";
import { getEnabledGenres, genreName } from "@/lib/genres";
import { CATALOG_PAGE_SIZE, parsePage, pageCount, clampPage, queryHref } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "Browse English short dramas",
  description: `Explore the full ${siteConfig.name} catalog — CEO romance, revenge, werewolf, hidden identity, and billionaire short dramas. Watch free episodes, then unlock the rest with VIP.`,
  path: "/shows",
});

export default async function ShowsPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; sort?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const genre = sp.genre;
  const sort = sp.sort || "trending";
  const orderBy =
    sort === "new"
      ? { createdAt: "desc" as const }
      : sort === "rating"
        ? { rating: "desc" as const }
        : { viewCount: "desc" as const };

  const where = {
    status: "published" as const,
    ...(genre ? { genre } : {}),
    ...(sort === "featured" ? { isFeatured: true } : {}),
  };

  const requested = parsePage(sp.page);
  const total = await prisma.series.count({ where });
  const pages = pageCount(total, CATALOG_PAGE_SIZE);
  const page = clampPage(requested, pages);

  const [series, genres, label] = await Promise.all([
    prisma.series.findMany({
      where,
      orderBy,
      skip: (page - 1) * CATALOG_PAGE_SIZE,
      take: CATALOG_PAGE_SIZE,
    }),
    getEnabledGenres(),
    genre ? genreName(genre) : Promise.resolve(""),
  ]);

  const hrefFor = (p: number) => queryHref("/shows", { genre, sort }, p);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Browse", path: "/shows" }])} />
      <p className="text-xs uppercase tracking-[0.25em] text-gold">Catalog</p>
      <h1 className="mt-2 font-display text-4xl md:text-5xl">All short dramas</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Original English vertical series you can start in a lunch break and finish in a night, plus a larger
        catalog of titles we&apos;re adding video for. Filter by genre, start with free episodes when they
        are live, go VIP when you can&apos;t stop.
      </p>
      <CatalogFilters genres={genres} genre={genre} sort={sort} />
      {series.length === 0 ? (
        <p className="mt-16 text-center text-muted">No shows in this collection yet.</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {series.map((s) => (
            <PosterCard key={s.id} series={s} width="w-full" />
          ))}
        </div>
      )}
      <Pager page={page} pages={pages} total={total} hrefFor={hrefFor} />
      {genre ? (
        <p className="sr-only">
          Showing {label} short dramas, sorted by {sort}, page {page} of {pages}.
        </p>
      ) : null}
    </div>
  );
}
