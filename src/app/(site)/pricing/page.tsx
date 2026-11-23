import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutButtons } from "@/components/public/CheckoutButtons";
import { Countdown } from "@/components/public/Countdown";
import { PriceTag } from "@/components/public/PriceTag";
import { SocialProof } from "@/components/public/SocialProof";
import { TrackOnView } from "@/components/public/TrackOnView";
import { getCurrentUser } from "@/lib/auth";
import { getActiveSubscription } from "@/lib/access";
import { getPaymentConfig } from "@/lib/payments";
import { getActivePromo, promoPriceFor } from "@/lib/promo";
import { getSocialProofCounts } from "@/lib/social";
import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/lib/site";
import { buildMetadata, JsonLd } from "@/lib/seo";
import { formatMoney, parseJsonArray, periodLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "VIP plans",
  description: `Unlock every English short drama on ${siteConfig.name}. Weekly, monthly, or yearly VIP — cancel anytime. Or buy coins to unlock a single episode.`,
  path: "/pricing",
});

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string; plan?: string }>;
}) {
  const sp = await searchParams;
  const [plans, packs, user, pay, promo, proof] = await Promise.all([
    prisma.plan.findMany({ where: { isEnabled: true }, orderBy: { sortOrder: "asc" } }),
    prisma.coinPackage.findMany({ where: { isEnabled: true }, orderBy: { sortOrder: "asc" } }),
    getCurrentUser(),
    getPaymentConfig(),
    getActivePromo(),
    getSocialProofCounts(),
  ]);
  const vip = user ? await getActiveSubscription(user.id) : null;
  const offerLd = plans.map((plan) => {
    const pricing = promoPriceFor(promo, "plan", plan.id, plan.priceCents);
    return {
      "@type": "Offer",
      name: plan.name,
      price: (pricing.saleCents / 100).toFixed(2),
      priceCurrency: plan.currency,
      availability: "https://schema.org/InStock",
      url: `${siteConfig.url}/pricing`,
      ...(pricing.onSale && promo ? { priceValidUntil: promo.endsAt.slice(0, 10) } : {}),
    };
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
      <TrackOnView event="InitiateCheckout" />
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "Can I cancel my ShortXMax VIP plan anytime?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Yes. You can cancel anytime from your account. You keep VIP access until the end of the period you already paid for.",
                },
              },
              {
                "@type": "Question",
                name: "What do I get with VIP?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "VIP unlocks every published episode in the catalog, removes paywalls, and includes early access to new drops. You can also buy coins to unlock a single episode without a plan.",
                },
              },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "AggregateOffer",
            url: `${siteConfig.url}/pricing`,
            offerCount: plans.length,
            priceCurrency: "USD",
            offers: offerLd,
          },
        ]}
      />
      <p className="text-center text-xs uppercase tracking-[0.28em] text-gold">Membership</p>
      <h1 className="mt-2 text-center font-display text-5xl md:text-6xl">
        {promo?.headline || "Choose your VIP."}
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-center text-muted">
        {promo?.description ||
          "The first episodes are free because we want you hooked. VIP is how you finish the story tonight — every show, no waiting, cancel anytime."}
      </p>
      {promo ? (
        <div className="mx-auto mt-6 flex max-w-xl flex-col items-center gap-3 rounded-2xl border border-gold/30 bg-gold/10 px-5 py-5 text-center">
          {promo.badge ? (
            <span className="rounded-full bg-gold px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#1a1406]">
              {promo.badge}
            </span>
          ) : null}
          {promo.showCountdown ? <Countdown endsAt={promo.endsAt} /> : null}
        </div>
      ) : null}
      <div className="mt-5 text-center">
        <SocialProof unlockedHour={proof.unlockedHour} upgradesToday={proof.upgradesToday} />
      </div>
      {sp.canceled ? (
        <p className="mx-auto mt-4 max-w-xl rounded-xl border border-white/10 bg-surface px-4 py-3 text-center text-sm text-muted">
          Checkout was canceled. Your plan was not charged.
        </p>
      ) : null}
      {vip ? (
        <p className="mx-auto mt-4 max-w-xl rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-center text-sm">
          You already have VIP through {vip.endsAt.toLocaleDateString("en-US")}. You can still extend or add coins.
        </p>
      ) : null}

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {plans.map((plan) => {
          const perks = parseJsonArray(plan.perks);
          const pricing = promoPriceFor(promo, "plan", plan.id, plan.priceCents);
          return (
            <article
              key={plan.id}
              className={`relative rounded-3xl border bg-surface p-6 ${
                plan.isPopular ? "border-gold shadow-[0_0_40px_rgba(224,184,76,0.12)]" : "border-white/10"
              }`}
            >
              {plan.badge || (pricing.onSale && promo?.badge) ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#1a1406]">
                  {pricing.onSale && promo?.badge ? promo.badge : plan.badge}
                </span>
              ) : null}
              <h2 className="font-display text-3xl">{plan.name}</h2>
              <div className="mt-3">
                <PriceTag
                  listCents={pricing.listCents}
                  saleCents={pricing.saleCents}
                  currency={plan.currency}
                  suffix={`/ ${periodLabel(plan.period)}`}
                />
              </div>
              {pricing.onSale ? (
                <p className="mt-1 text-xs text-gold-soft">
                  You save {formatMoney(pricing.listCents - pricing.saleCents, plan.currency)}
                </p>
              ) : null}
              <ul className="mt-5 space-y-2 text-sm text-muted">
                {perks.map((p) => (
                  <li key={p}>— {p}</li>
                ))}
              </ul>
              <CheckoutButtons
                kind="plan"
                id={plan.id}
                stripeReady={pay.stripeReady}
                paypalReady={pay.paypalReady}
                demoEnabled={pay.demoPayEnabled}
                signedIn={Boolean(user)}
                nextLogin={`/pricing?plan=${plan.slug}`}
                amountCents={pricing.saleCents}
                currency={plan.currency}
              />
            </article>
          );
        })}
      </div>

      <div className="mt-8 grid gap-3 text-center text-sm text-muted md:grid-cols-3">
        <p>Cancel anytime. Access stays until the period ends.</p>
        <p>PayPal, Stripe, or Demo Pay when enabled.</p>
        <p>Need just one episode? Use coins below.</p>
      </div>

      <section className="mt-16" id="coins">
        <h2 className="text-center font-display text-4xl">Coin packs</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-muted">
          Not ready for VIP? Unlock a single cliffhanger with coins. Unused coins stay on your account.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {packs.map((pack) => {
            const pricing = promoPriceFor(promo, "coins", pack.id, pack.priceCents);
            return (
              <article key={pack.id} className="rounded-2xl border border-white/10 bg-surface p-5">
                <h3 className="font-display text-2xl">{pack.name}</h3>
                <p className="mt-2 text-gold-soft">
                  {pack.coins.toLocaleString()} coins
                  {pack.bonusCoins ? ` + ${pack.bonusCoins} bonus` : ""}
                </p>
                <div className="mt-1">
                  <PriceTag
                    listCents={pricing.listCents}
                    saleCents={pricing.saleCents}
                    currency={pack.currency}
                    size="md"
                  />
                </div>
                <CheckoutButtons
                  kind="coins"
                  id={pack.id}
                  stripeReady={pay.stripeReady}
                  paypalReady={pay.paypalReady}
                  demoEnabled={pay.demoPayEnabled}
                  signedIn={Boolean(user)}
                  nextLogin="/pricing#coins"
                  amountCents={pricing.saleCents}
                  currency={pack.currency}
                />
              </article>
            );
          })}
        </div>
      </section>

      <p className="mt-12 text-center text-xs text-muted">
        By subscribing you agree to our{" "}
        <Link href="/legal/terms" className="text-gold">
          Terms
        </Link>
        ,{" "}
        <Link href="/legal/privacy" className="text-gold">
          Privacy Policy
        </Link>
        , and{" "}
        <Link href="/legal/refund" className="text-gold">
          Refund Policy
        </Link>
        .
      </p>
    </div>
  );
}
