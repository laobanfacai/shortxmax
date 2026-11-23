import Link from "next/link";
import { formatCompact } from "@/lib/utils";
import { syncGenreName } from "@/lib/genres";
import { Stars } from "./Stars";
import { SafeCover } from "./SafeCover";

export type PosterSeries = {
  slug: string;
  title: string;
  coverUrl: string;
  hook?: string;
  genre: string;
  rating: number;
  ratingCount?: number;
  viewCount?: number | bigint;
  freeEpisodeCount?: number;
  totalEpisodes?: number;
  isNew?: boolean;
  isTrending?: boolean;
  isCatalogOnly?: boolean;
};

export function PosterCard({
  series,
  width = "w-[148px] sm:w-[176px] md:w-[196px]",
}: {
  series: PosterSeries;
  width?: string;
}) {
  return (
    <article className={width}>
      <Link href={`/shows/${series.slug}`} className="group block">
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl poster-shadow bg-surface">
          <SafeCover
            src={series.coverUrl}
            alt={`${series.title} poster`}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10 opacity-90" />
          {series.isNew ? (
            <span className="absolute left-2 top-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1a1406]">
              New
            </span>
          ) : series.isTrending ? (
            <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-soft ring-1 ring-gold/40">
              Trending
            </span>
          ) : series.isCatalogOnly ? (
            <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/85 ring-1 ring-white/20">
              Coming soon
            </span>
          ) : null}
          {typeof series.freeEpisodeCount === "number" && series.freeEpisodeCount > 0 && !series.isCatalogOnly && (
            <span className="absolute right-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-medium text-ink/90">
              {series.freeEpisodeCount} free
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 p-2.5">
            <p className="font-display text-[15px] font-semibold leading-tight text-white drop-shadow line-clamp-2">
              {series.title}
            </p>
            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-white/80">
              {typeof series.ratingCount === "number" && series.ratingCount <= 0 ? (
                <span className="text-white/60">Not yet rated</span>
              ) : (
                <Stars rating={series.rating} />
              )}
              {series.viewCount != null ? (
                <span>{formatCompact(series.viewCount)} views</span>
              ) : null}
            </div>
          </div>
        </div>
        <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-muted">
          {syncGenreName(series.genre)}
          {series.totalEpisodes ? ` · ${series.totalEpisodes} EP` : ""}
        </p>
        {series.hook ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted/90">{series.hook}</p>
        ) : null}
      </Link>
    </article>
  );
}
