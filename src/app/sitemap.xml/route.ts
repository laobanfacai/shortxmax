import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/lib/site";
import { SITEMAP_PAGE_SIZE } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export async function GET() {
  const count = await prisma.series.count({ where: { status: "published" } });
  const pages = Math.max(1, Math.ceil(count / SITEMAP_PAGE_SIZE));
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    Array.from({ length: pages }, (_, i) => {
      return `  <sitemap><loc>${siteConfig.url}/sitemap/${i}.xml</loc></sitemap>`;
    }).join("\n") +
    `\n</sitemapindex>\n`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
