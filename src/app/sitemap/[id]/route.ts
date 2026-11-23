import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/lib/site";
import { getEnabledGenres } from "@/lib/genres";
import { editorials } from "@/lib/editorial";
import { SITEMAP_PAGE_SIZE } from "@/lib/pagination";

export const dynamic = "force-dynamic";

function xmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const raw = (await ctx.params).id.replace(/\.xml$/i, "");
  const shard = Number(raw);
  if (!Number.isInteger(shard) || shard < 0) {
    return new Response("Not found", { status: 404 });
  }
  const count = await prisma.series.count({ where: { status: "published" } });
  const pages = Math.max(1, Math.ceil(count / SITEMAP_PAGE_SIZE));
  if (shard >= pages) return new Response("Not found", { status: 404 });

  const [shows, genres] = await Promise.all([
    prisma.series.findMany({
      where: { status: "published" },
      select: { slug: true, updatedAt: true },
      orderBy: { slug: "asc" },
      skip: shard * SITEMAP_PAGE_SIZE,
      take: SITEMAP_PAGE_SIZE,
    }),
    shard === 0 ? getEnabledGenres() : Promise.resolve([]),
  ]);

  const urls: { loc: string; lastmod?: string; changefreq?: string; priority?: string }[] = [];
  if (shard === 0) {
    const now = new Date().toISOString();
    const staticPaths = [
      "/",
      "/shows",
      "/genres",
      "/pricing",
      "/go",
      "/about",
      "/faq",
      "/search",
      "/signup",
      "/legal/terms",
      "/legal/privacy",
      "/legal/refund",
    ];
    for (const path of staticPaths) {
      urls.push({
        loc: `${siteConfig.url}${path}`,
        lastmod: now,
        changefreq: "daily",
        priority: path === "/" ? "1.0" : "0.7",
      });
    }
    for (const g of genres) {
      urls.push({ loc: `${siteConfig.url}/genres/${g.slug}`, lastmod: now, changefreq: "daily", priority: "0.8" });
      urls.push({ loc: `${siteConfig.url}/go/${g.slug}`, lastmod: now, changefreq: "weekly", priority: "0.7" });
    }
    for (const e of editorials) {
      urls.push({ loc: `${siteConfig.url}/editorial/${e.slug}`, lastmod: now, changefreq: "weekly", priority: "0.75" });
    }
  }
  for (const s of shows) {
    urls.push({
      loc: `${siteConfig.url}/shows/${s.slug}`,
      lastmod: s.updatedAt.toISOString(),
      changefreq: "weekly",
      priority: "0.8",
    });
  }

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map((u) => {
        return (
          `  <url><loc>${xmlEscape(u.loc)}</loc>` +
          (u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : "") +
          (u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : "") +
          (u.priority ? `<priority>${u.priority}</priority>` : "") +
          `</url>`
        );
      })
      .join("\n") +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
