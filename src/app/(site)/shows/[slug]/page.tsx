import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MyListButton } from "@/components/public/MyListButton";
import { PosterCard } from "@/components/public/PosterCard";
import { SafeCover } from "@/components/public/SafeCover";
import { Stars } from "@/components/public/Stars";
import { getCurrentUser } from "@/lib/auth";
import { getActiveSubscription } from "@/lib/access";
import { getShowBySlug, UNMAPPED_GENRE } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/lib/site";
import { genreName } from "@/lib/genres";
import {
  breadcrumbJsonLd,
  buildMetadata,
  JsonLd,
  tvSeriesJsonLd,
} from "@/lib/seo";
import { formatCompact, parseJsonArray } from "@/lib/utils";
import { TrackOnView } from "@/components/public/TrackOnView";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const show = await getShowBySlug(slug);
  if (!show) return {};
  return buildMetadata({
    title: show.seoTitle || show.title,
    description: show.seoDescription || `${show.hook} ${show.synopsis}`.slice(0, 160),
    path: `/shows/${slug}`,
    image: show.backdropUrl || show.coverUrl,
  });
}

export default async function ShowPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const show = await getShowBySlug(slug);
  if (!show) notFound();
  const user = await getCurrentUser();
  const vip = user ? await getActiveSubscription(user.id) : null;
  const tags = parseJsonArray(show.tags);
  const catalogOnly = show.isCatalogOnly || show.episodes.length === 0;
  const inList = user
    ? Boolean(
        await prisma.myListItem.findUnique({
          where: { userId_seriesId: { userId: user.id, seriesId: show.id } },
        }),
      )
    : false;
  const unlocks = user
    ? await prisma.episodeUnlock.findMany({
        where: { userId: user.id, episodeId: { in: show.episodes.map((e) => e.id) } },
        select: { episodeId: true },
      })
    : [];
  const unlocked = new Set(unlocks.map((u) => u.episodeId));
  const related = await prisma.series.findMany({
    where: { status: "published", genre: show.genre, id: { not: show.id } },
    orderBy: { viewCount: "desc" },
    take: 8,
  });
  const gName = await genreName(show.genre);
  const genreHref = show.genre === UNMAPPED_GENRE ? "/shows" : `/genres/${show.genre}`;
  const statusLabel = show.updateStatus === "ongoing" ? "Ongoing" : "Complete";

  return (
    <div>
      <TrackOnView
        event="ViewContent"
        params={{ content_name: show.title, content_ids: [show.slug], content_type: "series", value: show.rating }}
      />
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: gName, path: genreHref },
            { name: show.title, path: `/shows/${show.slug}` },
          ]),
          tvSeriesJsonLd({
            title: show.title,
            slug: show.slug,
            synopsis: show.synopsis,
            hook: show.hook,
            coverUrl: show.coverUrl,
            genre: gName,
            tags,
            rating: show.rating,
            ratingCount: show.ratingCount,
            totalEpisodes: show.totalEpisodes,
            releaseYear: show.releaseYear,
            trailerUrl: show.trailerUrl,
          }),
        ]}
      />
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-40 blur-sm scale-110">
          <SafeCover src={show.backdropUrl || show.coverUrl} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-bg/40" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[280px_1fr] md:px-6 md:py-16">
          <div className="mx-auto w-56 md:w-full">
            <div className="overflow-hidden rounded-2xl poster-shadow aspect-[3/4] bg-surface">
              <SafeCover src={show.coverUrl} alt={`${show.title} poster`} className="h-full w-full object-cover" />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-gold">
              {gName} · {show.releaseYear} · {show.language} · {statusLabel}
            </p>
            <h1 className="mt-2 font-display text-4xl md:text-6xl">{show.title}</h1>
            {show.originalTitle && show.originalTitle !== show.title ? (
              <p className="mt-2 text-sm text-muted">Original title: {show.originalTitle}</p>
            ) : null}
            <p className="mt-4 text-lg text-ink/90">{show.hook}</p>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted">
              {show.ratingCount > 0 ? (
                <>
                  <Stars rating={show.rating} size="md" />
                  <span>{show.ratingCount.toLocaleString()} ratings</span>
                </>
              ) : (
                <span>Not yet rated on {siteConfig.name}</span>
              )}
              <span>{formatCompact(show.viewCount)} views</span>
              <span>{show.totalEpisodes} episodes</span>
              {!catalogOnly && show.freeEpisodeCount > 0 ? (
                <span className="text-gold-soft">{show.freeEpisodeCount} free to start</span>
              ) : show.isPaid ? (
                <span className="text-gold-soft">VIP to unlock</span>
              ) : (
                <span className="text-gold-soft">Free series</span>
              )}
            </div>
            {show.synopsis ? (
              <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted">{show.synopsis}</p>
            ) : (
              <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted">
                A synopsis has not been provided for this title yet.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.map((t) => (
                <span key={t} className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted">
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              {catalogOnly ? (
                <>
                  <span className="btn btn-lg cursor-default bg-white/10 text-ink/80">Episodes coming soon</span>
                  <Link href="/pricing" className="btn btn-gold btn-lg">
                    {show.isPaid ? "Go VIP — be ready when it drops" : "Go VIP for the full catalog"}
                  </Link>
                </>
              ) : (
                <>
                  <Link href={`/watch/${show.slug}/1`} className="btn btn-gold btn-lg">
                    Watch Episode 1 free
                  </Link>
                  {!vip ? (
                    <Link href="/pricing" className="btn btn-outline-gold btn-lg">
                      Unlock the full series
                    </Link>
                  ) : (
                    <Link href={`/watch/${show.slug}/1`} className="btn btn-ghost btn-lg">
                      You have VIP — binge it all
                    </Link>
                  )}
                </>
              )}
              <MyListButton seriesId={show.id} initial={inList} signedIn={Boolean(user)} />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <h2 className="font-display text-3xl">Episodes</h2>
        {catalogOnly ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-surface p-6">
            <p className="text-sm font-medium text-ink">
              {show.totalEpisodes} episodes are listed in the catalog — coming soon.
            </p>
            <p className="mt-2 text-sm text-muted">
              Full video is not on {siteConfig.name} yet, so there is no player on this page. The episode
              count below is a placeholder, not a broken link. Save the title to My List and go VIP to be
              ready when episodes are published.
            </p>
            <p className="mt-4 text-xs uppercase tracking-wide text-muted">
              Episodes 01–{String(show.totalEpisodes).padStart(2, "0")} · Coming soon
              {show.isPaid ? " · Unlock with VIP once live" : " · Free series once live"}
            </p>
          </div>
        ) : (
          <ol className="mt-5 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10">
            {show.episodes.map((ep) => {
              const free = ep.isFree;
              const open = free || Boolean(vip) || unlocked.has(ep.id);
              return (
                <li key={ep.id}>
                  <Link
                    href={`/watch/${show.slug}/${ep.number}`}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-white/5"
                  >
                    <span className="w-8 tabular-nums text-sm text-gold">{String(ep.number).padStart(2, "0")}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{ep.title}</p>
                      {ep.synopsis ? (
                        <p className="truncate text-xs text-muted">{ep.synopsis}</p>
                      ) : null}
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        open ? "bg-white/10 text-ink/80" : "bg-gold/15 text-gold-soft"
                      }`}
                    >
                      {open ? (free ? "Free" : "Unlocked") : "VIP"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}

        {show.reviews.length ? (
          <section className="mt-12">
            <h2 className="font-display text-3xl">What viewers say</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {show.reviews.map((r) => (
                <blockquote key={r.id} className="rounded-2xl border border-white/10 bg-surface p-5">
                  <Stars rating={r.rating} />
                  <p className="mt-3 text-sm leading-relaxed text-ink/90">{r.body}</p>
                  <footer className="mt-3 text-xs text-muted">— {r.displayName}</footer>
                </blockquote>
              ))}
            </div>
          </section>
        ) : null}

        {related.length ? (
          <section className="mt-12">
            <h2 className="font-display text-3xl">More {gName.toLowerCase()}</h2>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {related.map((s) => (
                <PosterCard key={s.id} series={s} width="w-full" />
              ))}
            </div>
          </section>
        ) : null}

        <aside className="mt-12 rounded-2xl border border-gold/25 bg-surface p-6 text-center">
          <p className="font-display text-2xl">
            {catalogOnly ? "Be first in line when the episodes go live." : "Don't stop at the free episodes."}
          </p>
          <p className="mt-2 text-sm text-muted">
            {siteConfig.name} VIP unlocks every published episode of {show.title} and the rest of the catalog.
            Cancel anytime.
          </p>
          <Link href="/pricing" className="btn btn-gold btn-lg mt-5">
            Go VIP
          </Link>
        </aside>
      </div>
    </div>
  );
}
