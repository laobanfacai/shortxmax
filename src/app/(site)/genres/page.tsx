import type { Metadata } from "next";
import Link from "next/link";
import { PosterCard } from "@/components/public/PosterCard";
import { buildMetadata, JsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/lib/site";
import { getEnabledGenres } from "@/lib/genres";
import { getActivePromo } from "@/lib/promo";
import { Countdown } from "@/components/public/Countdown";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "Short drama genres",
  description: `Browse ${siteConfig.name} by trope — CEO romance, revenge, werewolf, hidden identity, and billionaire short dramas. Free episodes first, then unlock the rest with VIP.`,
  path: "/genres",
});

export default async function GenreHubPage() {
  const [promo, genres] = await Promise.all([
    getActivePromo(),
    getEnabledGenres(),
  ]);
  const rails = await Promise.all(
    genres.map((g) =>
      prisma.series.findMany({
        where: { status: "published", genre: g.slug },
        orderBy: { viewCount: "desc" },
        take: 6,
      }),
    ),
  );
  const groups = genres.map((g, i) => ({ ...g, items: rails[i] }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Genres", path: "/genres" },
        ])}
      />
      <p className="text-xs uppercase tracking-[0.25em] text-gold">Genre hub</p>
      <h1 className="mt-2 font-display text-4xl md:text-6xl">Pick a trope. Start in minutes.</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        Every category opens with free episodes so you can feel the hook — then VIP unlocks the rest of the night.
        No app store. No drip. Just the story.
      </p>
      {promo ? (
        <p className="mt-4 text-sm text-gold-soft">
          {promo.badge || promo.name}
          {promo.showCountdown ? (
            <>
              {" "}
              · ends in <Countdown endsAt={promo.endsAt} compact />
            </>
          ) : null}
        </p>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <Link
            key={g.slug}
            href={`/genres/${g.slug}`}
            className="group overflow-hidden rounded-3xl border border-white/10 bg-surface p-5 transition hover:border-gold/40"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-gold">{g.name}</p>
            <h2 className="mt-2 font-display text-3xl leading-tight group-hover:text-gold-soft">{g.hook}</h2>
            <p className="mt-3 text-sm text-muted">{g.blurb}</p>
            <p className="mt-4 text-sm text-gold">Browse {g.name} →</p>
          </Link>
        ))}
      </div>

      {groups.map((g) => (
        <section key={g.slug} className="mt-14">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-3xl">{g.name}</h2>
              <p className="mt-1 text-sm text-muted">{g.offer}</p>
            </div>
            <Link href={`/genres/${g.slug}`} className="text-sm text-gold">
              See all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {g.items.map((s) => (
              <PosterCard key={s.id} series={s} width="w-full" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
