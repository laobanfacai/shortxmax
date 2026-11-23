"use client";

import Link from "next/link";
import { GlassCapsuleNav } from "@/components/ui/GlassCapsuleNav";
import { queryHref } from "@/lib/pagination";

const sorts = [
  ["trending", "Trending"],
  ["featured", "Recommended"],
  ["new", "New"],
  ["rating", "Top rated"],
] as const;

export function CatalogFilters({
  genres,
  genre,
  sort,
}: {
  genres: { slug: string; name: string }[];
  genre?: string;
  sort: string;
}) {
  const genreKey = genre || "all";
  const sortKey = sort || "trending";

  return (
    <>
      <GlassCapsuleNav
        activeKey={genreKey}
        axis="x"
        className="mt-6 flex flex-wrap items-center gap-1"
        aria-label="Catalog genres"
        as="div"
      >
        <Link
          href={queryHref("/shows", { sort }, 1)}
          className="glass-capsule-item inline-flex items-center text-sm text-ink/80 hover:text-gold-soft"
          data-capsule-active={!genre ? "true" : "false"}
          aria-current={!genre ? "page" : undefined}
        >
          All
        </Link>
        {genres.map((g) => {
          const active = genre === g.slug;
          return (
            <Link
              key={g.slug}
              href={queryHref("/shows", { genre: g.slug, sort }, 1)}
              className="glass-capsule-item inline-flex items-center text-sm text-ink/80 hover:text-gold-soft"
              data-capsule-active={active ? "true" : "false"}
              aria-current={active ? "page" : undefined}
            >
              {g.name}
            </Link>
          );
        })}
      </GlassCapsuleNav>
      <GlassCapsuleNav
        activeKey={sortKey}
        axis="x"
        className="mt-3 flex flex-wrap items-center gap-1"
        aria-label="Catalog sort"
        as="div"
      >
        {sorts.map(([key, labelText]) => {
          const active = sortKey === key;
          return (
            <Link
              key={key}
              href={queryHref("/shows", { genre, sort: key }, 1)}
              className="glass-capsule-item inline-flex items-center text-sm text-ink/80 hover:text-gold-soft"
              data-capsule-active={active ? "true" : "false"}
              aria-current={active ? "page" : undefined}
            >
              {labelText}
            </Link>
          );
        })}
      </GlassCapsuleNav>
    </>
  );
}
