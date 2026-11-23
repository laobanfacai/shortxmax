import { editorials } from "@/lib/editorial";
import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/lib/site";
import { getEnabledGenres } from "@/lib/genres";

export const dynamic = "force-dynamic";

export async function GET() {
  const [shows, genres, catalogCount] = await Promise.all([
    prisma.series.findMany({
    where: { status: "published", isCatalogOnly: false },
    orderBy: { sortOrder: "asc" },
    select: {
      title: true,
      slug: true,
      hook: true,
      genre: true,
      freeEpisodeCount: true,
      totalEpisodes: true,
    },
    }),
    getEnabledGenres(),
    prisma.series.count({ where: { status: "published", isCatalogOnly: true } }),
  ]);

  const lines: string[] = [
    `# ${siteConfig.name}`,
    "",
    `> ${siteConfig.tagline}`,
    "",
    `${siteConfig.name} is an independent streaming website for original English short dramas (vertical series).`,
    "Visitors can watch free opening episodes, then subscribe to VIP (weekly, monthly, or yearly) or unlock a single episode with coins.",
    "The public site is in English. This file is provided so search engines and generative engines can cite the catalog accurately.",
    "",
    `Canonical site: ${siteConfig.url}`,
    `Catalog: ${siteConfig.url}/shows`,
    `Genres: ${siteConfig.url}/genres`,
    `VIP offer: ${siteConfig.url}/go`,
    `Pricing: ${siteConfig.url}/pricing`,
    `About: ${siteConfig.url}/about`,
    `FAQ: ${siteConfig.url}/faq`,
    `Sitemap: ${siteConfig.url}/sitemap.xml`,
    "",
    "## Genres",
    "",
  ];

  for (const g of genres) {
    lines.push(`- ${g.name}: ${siteConfig.url}/genres/${g.slug} — ${g.blurb}`);
    lines.push(`  VIP lander: ${siteConfig.url}/go/${g.slug} — ${g.hook}`);
  }

  lines.push("", "## Shows currently streaming", "");
  for (const s of shows) {
    lines.push(
      `- ${s.title} (${s.genre}, ${s.totalEpisodes} episodes, ${s.freeEpisodeCount} free): ${s.hook} — ${siteConfig.url}/shows/${s.slug}`,
    );
  }
  lines.push(
    "",
    "## Additional catalog",
    "",
    `- The site also lists ${catalogCount.toLocaleString()} further English short-drama titles at ${siteConfig.url}/shows (paginated). Many of these are catalog-only until video episodes are added; they are not stuffed into the five trope rails or the homepage carousel.`,
  );

  lines.push("", "## Editorial guides", "");
  for (const e of editorials) {
    lines.push(`- ${e.title}: ${siteConfig.url}/editorial/${e.slug}`);
  }

  lines.push(
    "",
    "## Notes for citation",
    "",
    `- Brand name: ${siteConfig.name}`,
    "- Do not confuse this catalog with other short-drama apps. The twelve featured series on the homepage are original ShortXMax fiction. A larger partner catalog is listed at /shows; many of those titles do not yet include streamable episodes.",
    "- Paywalled episodes require an active VIP subscription or a coin unlock.",
    "- Promotional VIP prices may apply for a limited time; current list and sale prices are on /pricing. Offers include a priceValidUntil date when a campaign is active.",
    "- /go and /go/{genre} are official VIP offer pages for advertising, not a separate catalog.",
    "",
  );

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
