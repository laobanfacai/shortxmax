import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PosterCard } from "@/components/public/PosterCard";
import { editorials, getEditorial } from "@/lib/editorial";
import { prisma } from "@/lib/prisma";
import { buildMetadata, JsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return editorials.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getEditorial(slug);
  if (!article) return {};
  return buildMetadata({
    title: article.title,
    description: article.description,
    path: `/editorial/${slug}`,
    type: "article",
  });
}

export default async function EditorialPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getEditorial(slug);
  if (!article) notFound();
  const series = await prisma.series.findMany({
    where: { status: "published", genre: article.genre },
    orderBy: { viewCount: "desc" },
    take: 8,
  });
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Guides", path: "/about" },
            { name: article.title, path: `/editorial/${article.slug}` },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: article.title,
            description: article.description,
            author: { "@type": "Organization", name: siteConfig.name },
            publisher: { "@type": "Organization", name: siteConfig.name },
            mainEntityOfPage: `${siteConfig.url}/editorial/${article.slug}`,
          },
        ]}
      />
      <p className="text-xs uppercase tracking-[0.22em] text-gold">Guide</p>
      <h1 className="mt-2 font-display text-4xl md:text-5xl">{article.title}</h1>
      <p className="mt-4 text-lg text-ink/90">{article.dek}</p>
      {article.body.map((b) => (
        <section key={b.heading} className="mt-8">
          <h2 className="font-display text-2xl">{b.heading}</h2>
          <p className="mt-3 leading-relaxed text-muted">{b.text}</p>
        </section>
      ))}
      {series.length ? (
        <section className="mt-12">
          <h2 className="font-display text-2xl">Watch these next</h2>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {series.map((s) => (
              <PosterCard key={s.id} series={s} width="w-full" />
            ))}
          </div>
        </section>
      ) : null}
      <p className="mt-10 text-sm">
        <Link href={`/genres/${article.genre}`} className="text-gold">
          Browse the full genre →
        </Link>
      </p>
    </article>
  );
}
