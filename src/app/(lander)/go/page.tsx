import type { Metadata } from "next";
import { OfferLander } from "@/components/public/OfferLander";
import { loadOffer } from "@/lib/offer-page";
import { buildMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "Go VIP — unlock every short drama",
  description: `Unlock every English short drama on ${siteConfig.name}. First episodes are free. VIP removes the paywall — weekly, monthly, or yearly, cancel anytime.`,
  path: "/go",
});

export default async function GoPage() {
  const data = await loadOffer();
  const promo = data.promo;
  return (
    <OfferLander
      eyebrow={promo?.badge || "ShortXMax VIP"}
      title={promo?.headline || "Finish the story tonight."}
      dek={
        promo?.description ||
        "The free episodes hook you. VIP is how you keep going — every cliffhanger, no waiting, cancel anytime."
      }
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
