import type { Metadata } from "next";
import { PosterCard } from "@/components/public/PosterCard";
import { Pager } from "@/components/public/Pager";
import { buildMetadata, JsonLd, websiteJsonLd } from "@/lib/seo";
import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/lib/site";
import { CATALOG_PAGE_SIZE, parsePage, pageCount, clampPage, queryHref } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { q } = await searchParams;
  const term = (q || "").trim();
  return buildMetadata({
    title: term ? `Search results for “${term}”` : "Search short dramas",
    description: `Search English short dramas on ${siteConfig.name} by title, hook, or trope.`,
    path: term ? `/search?q=${encodeURIComponent(term)}` : "/search",
  });
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: rawPage } = await searchParams;
  const term = (q || "").trim();
  const where = term
    ? {
        status: "published" as const,
        OR: [
          { title: { contains: term } },
          { originalTitle: { contains: term } },
          { hook: { contains: term } },
          { synopsis: { contains: term } },
          { tags: { contains: term.toLowerCase() } },
          { genre: { contains: term.toLowerCase().replace(/\s+/g, "-") } },
          { externalId: { contains: term } },
        ],
      }
    : null;

  const total = where ? await prisma.series.count({ where }) : 0;
  const pages = pageCount(total, CATALOG_PAGE_SIZE);
  const page = clampPage(parsePage(rawPage), pages);
  const series = where
    ? await prisma.series.findMany({
        where,
        orderBy: { viewCount: "desc" },
        skip: (page - 1) * CATALOG_PAGE_SIZE,
        take: CATALOG_PAGE_SIZE,
      })
    : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <JsonLd data={websiteJsonLd()} />
      <h1 className="font-display text-4xl">Search</h1>
      <form action="/search" className="mt-6 max-w-lg" role="search">
        <label htmlFor="search-q" className="label">
          Find a short drama
        </label>
        <input
          id="search-q"
          name="q"
          defaultValue={term}
          placeholder="Try billionaire, werewolf, revenge..."
          className="input"
        />
      </form>
      {term ? (
        <>
          <p className="mt-6 text-sm text-muted">
            {total.toLocaleString()} result{total === 1 ? "" : "s"} for “{term}”
          </p>
          {series.length === 0 ? (
            <p className="mt-10 text-muted">No matches. Try a trope name or part of a title.</p>
          ) : (
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {series.map((s) => (
                <PosterCard key={s.id} series={s} width="w-full" />
              ))}
            </div>
          )}
          <Pager
            page={page}
            pages={pages}
            total={total}
            hrefFor={(p) => queryHref("/search", { q: term }, p)}
            noun="results"
          />
        </>
      ) : (
        <p className="mt-10 text-muted">Search titles, tropes, and synopses across the catalog.</p>
      )}
    </div>
  );
}
