import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OfferLander } from "@/components/public/OfferLander";
import { loadOffer } from "@/lib/offer-page";
import { buildMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";
import { getGenreBySlug } from "@/lib/genres";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ genre: string }>;
}): Promise<Metadata> {
  const { genre } = await params;
  const g = await getGenreBySlug(genre);
  if (!g) return {};
  return buildMetadata({
    title: `${g.name} short dramas — VIP offer`,
    description: `${g.hook} ${g.offer} Unlock every ${g.name.toLowerCase()} series on ${siteConfig.name} with VIP. Free episodes first, cancel anytime.`,
    path: `/go/${genre}`,
  });
}

export default async function GenreOfferPage({ params }: { params: Promise<{ genre: string }> }) {
  const { genre } = await params;
  const g = await getGenreBySlug(genre);
  if (!g) notFound();
  const data = await loadOffer(genre);
  const promo = data.promo;
  return (
    <OfferLander
      eyebrow={`${g.name} · ${promo?.badge || "VIP offer"}`}
      title={g.hook}
      dek={`${g.offer}${promo?.headline ? ` ${promo.headline}` : ""}`}
      plan={data.plan}
      listCents={data.pricing.listCents}
      saleCents={data.pricing.saleCents}
      promo={promo}
      series={data.series}
      signedIn={Boolean(data.user)}
      pay={data.pay}
      proof={data.proof}
      offerJson={data.offerJson}
    />
  );
}
