import Link from "next/link";
import { Rail } from "@/components/public/Rail";
import { StickyCta } from "@/components/public/StickyCta";
import { HeroCarousel } from "@/components/public/HeroCarousel";
import { JsonLd, orgJsonLd, websiteJsonLd, buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/auth";
import { getActiveSubscription } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/lib/site";
import { getEnabledGenres } from "@/lib/genres";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: `${siteConfig.name} — ${siteConfig.tagline}`,
  description:
    "Stream addictive English short dramas in minutes. CEO romance, revenge, werewolf, hidden identity, and billionaire stories. Watch free episodes today, then go VIP to unlock every cliffhanger.",
  path: "/",
});

export default async function HomePage() {
  const user = await getCurrentUser();
  const vip = user ? await getActiveSubscription(user.id) : null;

  const now = new Date();
  const [trending, fresh, featured, all, continueWatching, genres, dbSlides] = await Promise.all([
    prisma.series.findMany({
      where: { status: "published", isTrending: true },
      orderBy: { viewCount: "desc" },
      take: 12,
    }),
    prisma.series.findMany({
      where: { status: "published", isNew: true },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.series.findMany({
      where: { status: "published", isFeatured: true },
      orderBy: { sortOrder: "asc" },
      take: 12,
    }),
    prisma.series.findMany({
      where: { status: "published", isCatalogOnly: false },
      orderBy: { sortOrder: "asc" },
      take: 60,
    }),
    user
      ? prisma.watchHistory.findMany({
          where: { userId: user.id },
          include: { episode: { include: { series: true } } },
          orderBy: { updatedAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
    getEnabledGenres(),
    prisma.heroSlide.findMany({
      where: {
        isEnabled: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const fallbackShow = trending[0] || featured[0] || all[0];
  const slides = dbSlides.length
    ? dbSlides.map((s) => ({
        id: s.id,
        title: s.title,
        subtitle: s.subtitle,
        ctaLabel: s.ctaLabel,
        href: s.href,
        imageUrl: s.imageUrl,
      }))
    : fallbackShow
      ? [
          {
            id: fallbackShow.id,
            title: fallbackShow.title,
            subtitle: fallbackShow.hook,
            ctaLabel: "Play Episode 1 free",
            href: `/watch/${fallbackShow.slug}/1`,
            imageUrl: fallbackShow.backdropUrl || fallbackShow.coverUrl,
          },
        ]
      : [];
  const seen = new Set<string>();
  const continueItems = [];
  for (const h of continueWatching) {
    const s = h.episode.series;
    if (s.status !== "published" || seen.has(s.id)) continue;
    seen.add(s.id);
    continueItems.push({
      slug: s.slug,
      title: s.title,
      coverUrl: s.coverUrl,
      hook: `Resume Ep ${h.episode.number} · ${h.episode.title}`,
      genre: s.genre,
      rating: s.rating,
      viewCount: s.viewCount,
      freeEpisodeCount: s.freeEpisodeCount,
      totalEpisodes: s.totalEpisodes,
      resumeHref: `/watch/${s.slug}/${h.episode.number}`,
    });
  }

  const byGenre = genres.map((g) => ({
    ...g,
    items: all.filter((s) => s.genre === g.slug).slice(0, 12),
  }));

  return (
    <>
      <JsonLd data={[orgJsonLd(), websiteJsonLd()]} />
      {slides.length ? (
        <HeroCarousel slides={slides} showVip={!vip} />
      ) : (
        <section className="mx-auto max-w-7xl px-4 py-24 md:px-6">
          <h1 className="font-display text-5xl">Short dramas that hook you in minutes.</h1>
        </section>
      )}

      <div className="border-y border-white/5 bg-surface/60">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 text-center sm:grid-cols-3 md:px-6">
          <p className="text-sm text-muted">
            <span className="block font-display text-2xl text-gold-soft">12M+</span>
            Episode plays this season
          </p>
          <p className="text-sm text-muted">
            <span className="block font-display text-2xl text-gold-soft">4.9 ★</span>
            Average audience score
          </p>
          <p className="text-sm text-muted">
            <span className="block font-display text-2xl text-gold-soft">Cancel anytime</span>
            VIP with no long contracts
          </p>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-14 px-4 py-12 md:px-6">
        {continueItems.length ? (
          <section>
            <div className="mb-3 flex items-end justify-between">
              <h2 className="font-display text-2xl font-semibold md:text-3xl">Continue watching</h2>
              <Link href="/account/history" className="text-sm text-gold">
                History
              </Link>
            </div>
            <div className="rail -mx-4 px-4 md:mx-0 md:px-0">
              {continueItems.map((s) => (
                <article key={s.slug} className="w-[148px] sm:w-[176px]">
                  <Link href={s.resumeHref} className="group block">
                    <div className="relative aspect-[3/4] overflow-hidden rounded-xl poster-shadow">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.coverUrl} alt={`${s.title} poster`} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                      <p className="absolute bottom-2 left-2 right-2 font-display text-sm text-white">{s.title}</p>
                    </div>
                    <p className="mt-2 text-xs text-muted">{s.hook}</p>
                  </Link>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold md:text-3xl">Browse by trope</h2>
              <p className="mt-1 text-sm text-muted">A hook in the first episode. VIP for the rest of the night.</p>
            </div>
            <Link href="/genres" className="text-sm text-gold">Genre hub</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {genres.map((g) => (
              <Link key={g.slug} href={`/genres/${g.slug}`} className="rounded-2xl border border-white/10 bg-surface p-4 hover:border-gold/40">
                <p className="text-[10px] uppercase tracking-[0.16em] text-gold">{g.name}</p>
                <p className="mt-2 font-display text-xl leading-tight">{g.hook}</p>
              </Link>
            ))}
          </div>
        </section>
        {featured.length ? (
          <Rail title="Recommended" href="/shows?sort=featured" subtitle="Editor picks — start with a free episode, then go VIP." series={featured} />
        ) : null}
        <Rail title="Trending now" href="/shows?sort=trending" subtitle="The stories everyone is finishing in one night." series={trending} />
        <Rail title="New releases" href="/shows?sort=new" subtitle="Fresh episodes dropped this week." series={fresh} />

        {byGenre.map((g) => (
          <Rail
            key={g.slug}
            title={g.name}
            href={`/genres/${g.slug}`}
            subtitle={g.blurb}
            series={g.items}
          />
        ))}

        <section className="overflow-hidden rounded-3xl border border-gold/20 bg-[radial-gradient(circle_at_top_left,rgba(224,184,76,0.12),transparent_42%),#131316] px-6 py-10 md:px-12">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-gold">ShortXMax VIP</p>
              <h2 className="mt-2 font-display text-4xl md:text-5xl">Every cliffhanger, unlocked.</h2>
              <p className="mt-4 text-muted">
                Free episodes hook you. VIP lets you keep going — no ads, every episode, every premiere,
                cancel anytime. Most members binge a full series the same night they subscribe.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-ink/90">
                <li>— Unlock the entire catalog instantly</li>
                <li>— Weekly, monthly, or yearly. No hidden fees.</li>
                <li>— Or unlock a single episode with coins if you only want one story.</li>
              </ul>
              <Link href="/pricing" className="btn btn-gold btn-lg mt-7">
                See VIP plans
              </Link>
            </div>
            <div className="grid gap-3 text-sm">
              <blockquote className="rounded-2xl bg-black/30 p-5 ring-1 ring-white/10">
                “I told myself I’d watch one free episode. I finished the season at 2 a.m. and upgraded
                before the lock screen came up.”
                <footer className="mt-2 text-xs text-muted">— Maya, VIP member</footer>
              </blockquote>
              <blockquote className="rounded-2xl bg-black/30 p-5 ring-1 ring-white/10">
                “The werewolf ones slay, but the CEO contract marriage? I was not okay. Worth every
                cent of the monthly plan.”
                <footer className="mt-2 text-xs text-muted">— Jordan, Yearly VIP</footer>
              </blockquote>
            </div>
          </div>
        </section>
      </div>
      <StickyCta hidden={Boolean(vip)} />
    </>
  );
}
