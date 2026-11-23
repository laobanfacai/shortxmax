import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PosterCard } from "@/components/public/PosterCard";
import { Countdown } from "@/components/public/Countdown";
import { SocialProof } from "@/components/public/SocialProof";
import { buildMetadata, JsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/lib/site";
import { getGenreBySlug } from "@/lib/genres";
import { getActivePromo } from "@/lib/promo";
import { getSocialProofCounts } from "@/lib/social";
import { Pager } from "@/components/public/Pager";
import { CATALOG_PAGE_SIZE, parsePage, pageCount, clampPage, queryHref } from "@/lib/pagination";
import { SafeCover } from "@/components/public/SafeCover";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const g = await getGenreBySlug(slug);
  if (!g) return {};
  return buildMetadata({
    title: `Best ${g.name} short dramas`,
    description: `${g.hook} ${g.offer} Watch ${g.name.toLowerCase()} English short dramas on ${siteConfig.name}. Free episodes first, then unlock the rest with VIP.`,
    path: `/genres/${slug}`,
  });
}

export default async function GenrePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const g = await getGenreBySlug(slug);
  if (!g) notFound();
  const where = { status: "published" as const, genre: slug };
  const total = await prisma.series.count({ where });
  const pages = pageCount(total, CATALOG_PAGE_SIZE);
  const page = clampPage(parsePage(sp.page), pages);
  const [series, promo, proof] = await Promise.all([
    prisma.series.findMany({
      where,
      orderBy: { viewCount: "desc" },
      skip: (page - 1) * CATALOG_PAGE_SIZE,
      take: CATALOG_PAGE_SIZE,
    }),
    getActivePromo(),
    getSocialProofCounts(),
  ]);
  const hero = series[0];
  return (
    <div>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Genres", path: "/genres" },
          { name: g.name, path: `/genres/${slug}` },
        ])}
      />
      <section className="relative overflow-hidden">
        {hero ? (
          <div className="absolute inset-0 opacity-35 blur-sm scale-110">
            <SafeCover src={hero.backdropUrl || hero.coverUrl} alt="" className="h-full w-full object-cover" />
          </div>
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/85 to-bg/40" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 md:px-6 md:py-20">
          <p className="text-xs uppercase tracking-[0.25em] text-gold">{g.name}</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl md:text-6xl">{g.hook}</h1>
          <p className="mt-4 max-w-2xl text-lg text-ink/90">{g.offer}</p>
          <p className="mt-3 max-w-2xl text-muted">{g.proof}</p>
          <div className="mt-5">
            <SocialProof unlockedHour={proof.unlockedHour} upgradesToday={proof.upgradesToday} />
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            {hero && !hero.isCatalogOnly ? (
              <Link href={`/watch/${hero.slug}/1`} className="btn btn-gold btn-lg">
                Play a free episode
              </Link>
            ) : hero ? (
              <Link href={`/shows/${hero.slug}`} className="btn btn-gold btn-lg">
                View the title
              </Link>
            ) : null}
            <Link href="/pricing" className="btn btn-outline-gold btn-lg">
              {promo ? "Unlock the sale — Go VIP" : "Unlock this genre — Go VIP"}
            </Link>
            <Link href={`/go/${g.slug}`} className="btn btn-ghost btn-lg">
              VIP offer
            </Link>
          </div>
          {promo?.showCountdown ? (
            <div className="mt-6">
              <p className="mb-2 text-xs uppercase tracking-wide text-gold">{promo.badge || promo.name}</p>
              <Countdown endsAt={promo.endsAt} />
            </div>
          ) : null}
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        {series.length === 0 ? (
          <p className="text-muted">Nothing published in this genre yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {series.map((s) => (
                <PosterCard key={s.id} series={s} width="w-full" />
              ))}
            </div>
            <Pager page={page} pages={pages} total={total} hrefFor={(p) => queryHref(`/genres/${slug}`, {}, p)} />
          </>
        )}
        <aside className="mt-12 rounded-2xl border border-gold/25 bg-surface p-6 text-center">
          <p className="font-display text-2xl">Hooked on the free episodes?</p>
          <p className="mt-2 text-sm text-muted">VIP unlocks every {g.name.toLowerCase()} title in the catalog. Cancel anytime.</p>
          <Link href="/pricing" className="btn btn-gold btn-lg mt-5">
            See VIP plans
          </Link>
        </aside>
      </div>
    </div>
  );
}
