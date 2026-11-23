import { PrismaClient } from "@prisma/client";
import { DEFAULT_GENRES } from "../src/lib/genres";

const prisma = new PrismaClient();

async function main() {
  for (let i = 0; i < DEFAULT_GENRES.length; i++) {
    const g = DEFAULT_GENRES[i];
    await prisma.genre.upsert({
      where: { slug: g.slug },
      update: {},
      create: { ...g, sortOrder: i, isEnabled: true },
    });
  }
  console.log("genres upserted:", DEFAULT_GENRES.length);

  const featuredSlugs = [
    "the-last-laugh",
    "velvet-contract",
    "rejected-mate",
    "billion-dollar-vow",
    "never-the-maid",
  ];
  await prisma.series.updateMany({
    where: { slug: { in: featuredSlugs } },
    data: { isFeatured: true },
  });

  const slideCount = await prisma.heroSlide.count();
  if (slideCount === 0) {
    const shows = await prisma.series.findMany({
      where: { slug: { in: featuredSlugs } },
    });
    const bySlug = Object.fromEntries(shows.map((s) => [s.slug, s]));
    const slides = [
      {
        slug: "the-last-laugh",
        cta: "Play Episode 1 free",
        hrefSuffix: "/watch/the-last-laugh/1",
        sortOrder: 0,
      },
      {
        slug: "velvet-contract",
        cta: "See the story",
        hrefSuffix: "/shows/velvet-contract",
        sortOrder: 1,
      },
      {
        slug: "rejected-mate",
        cta: "Play Episode 1 free",
        hrefSuffix: "/watch/rejected-mate/1",
        sortOrder: 2,
      },
      {
        slug: "billion-dollar-vow",
        cta: "Unlock with VIP",
        hrefSuffix: "/go/billionaire",
        sortOrder: 3,
      },
      {
        slug: "never-the-maid",
        cta: "Play Episode 1 free",
        hrefSuffix: "/watch/never-the-maid/1",
        sortOrder: 4,
      },
    ];
    for (const s of slides) {
      const show = bySlug[s.slug];
      if (!show) continue;
      await prisma.heroSlide.create({
        data: {
          title: show.title,
          subtitle: show.hook,
          ctaLabel: s.cta,
          href: s.hrefSuffix,
          imageUrl: show.backdropUrl || show.coverUrl,
          seriesId: show.id,
          sortOrder: s.sortOrder,
          isEnabled: true,
        },
      });
    }
    console.log("hero slides seeded:", slides.length);
  } else {
    console.log("hero slides already present:", slideCount);
  }

  const viewCount = await prisma.pageView.count();
  if (viewCount === 0) {
    const now = Date.now();
    const sources = [
      { source: "Meta / Facebook", utmSource: "meta", country: "美国" },
      { source: "TikTok", utmSource: "tiktok", country: "美国" },
      { source: "Google", utmSource: "google", country: "英国" },
      { source: "直接访问", utmSource: "", country: "新加坡" },
      { source: "Meta / Facebook", utmSource: "meta", country: "加拿大" },
      { source: "TikTok", utmSource: "tiktok", country: "菲律宾" },
      { source: "直接访问", utmSource: "", country: "未知" },
    ];
    const paths = ["/", "/genres", "/genres/ceo-romance", "/go", "/pricing", "/shows/velvet-contract"];
    const rows = [];
    for (let i = 0; i < 48; i++) {
      const s = sources[i % sources.length];
      rows.push({
        path: paths[i % paths.length],
        source: s.source,
        utmSource: s.utmSource,
        utmMedium: s.utmSource ? "cpc" : "",
        utmCampaign: s.utmSource ? "launch" : "",
        referrer: s.utmSource ? "" : "",
        country: s.country,
        createdAt: new Date(now - (i % 6) * 24 * 60 * 60 * 1000 - i * 13 * 60 * 1000),
      });
    }
    await prisma.pageView.createMany({ data: rows });
    console.log("pageviews seeded:", rows.length);
  } else {
    console.log("pageviews already present:", viewCount);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
