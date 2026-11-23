import { getCurrentUser } from "@/lib/auth";
import { getPaymentConfig } from "@/lib/payments";
import { getActivePromo, promoPriceFor } from "@/lib/promo";
import { prisma } from "@/lib/prisma";
import { getSocialProofCounts } from "@/lib/social";
import { siteConfig } from "@/lib/site";

export async function loadOffer(genre?: string) {
  const [plans, promo, user, pay, proof, series] = await Promise.all([
    prisma.plan.findMany({ where: { isEnabled: true }, orderBy: { sortOrder: "asc" } }),
    getActivePromo(),
    getCurrentUser(),
    getPaymentConfig(),
    getSocialProofCounts(),
    prisma.series.findMany({
      where: { status: "published", ...(genre ? { genre } : { isTrending: true }) },
      orderBy: { viewCount: "desc" },
      take: 8,
    }),
  ]);
  const plan = plans.find((p) => p.isPopular) || plans.find((p) => p.slug === "monthly") || plans[0];
  if (!plan) throw new Error("No VIP plan configured");
  const pricing = promoPriceFor(promo, "plan", plan.id, plan.priceCents);
  const offerJson = {
    "@context": "https://schema.org",
    "@type": "Offer",
    name: `${plan.name}${promo?.badge ? ` — ${promo.badge}` : ""}`,
    url: genre ? `${siteConfig.url}/go/${genre}` : `${siteConfig.url}/go`,
    price: (pricing.saleCents / 100).toFixed(2),
    priceCurrency: plan.currency,
    availability: "https://schema.org/InStock",
    seller: { "@type": "Organization", name: siteConfig.name },
    ...(pricing.onSale && promo
      ? { priceValidUntil: promo.endsAt.slice(0, 10) }
      : {}),
  };
  return {
    plans,
    plan,
    promo,
    pricing,
    user,
    pay,
    proof,
    series: series.length ? series : await prisma.series.findMany({ where: { status: "published", isCatalogOnly: false }, orderBy: { viewCount: "desc" }, take: 8 }),
    offerJson,
  };
}
