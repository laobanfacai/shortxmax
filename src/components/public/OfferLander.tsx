import Link from "next/link";
import { CheckoutButtons } from "@/components/public/CheckoutButtons";
import { Countdown } from "@/components/public/Countdown";
import { PosterCard } from "@/components/public/PosterCard";
import { PriceTag } from "@/components/public/PriceTag";
import { SocialProof } from "@/components/public/SocialProof";
import { TrackOnView } from "@/components/public/TrackOnView";
import { JsonLd } from "@/lib/seo";
import { siteConfig } from "@/lib/site";
import { formatMoney, parseJsonArray, periodLabel } from "@/lib/utils";
import type { PublicPromo } from "@/lib/promo";
import type { Plan, Series } from "@prisma/client";

export function OfferLander({
  eyebrow,
  title,
  dek,
  plan,
  listCents,
  saleCents,
  promo,
  series,
  signedIn,
  pay,
  proof,
  offerJson,
}: {
  eyebrow: string;
  title: string;
  dek: string;
  plan: Plan;
  listCents: number;
  saleCents: number;
  promo: PublicPromo | null;
  series: Series[];
  signedIn: boolean;
  pay: { stripeReady: boolean; paypalReady: boolean; demoPayEnabled: boolean };
  proof: { unlockedHour: number; upgradesToday: number };
  offerJson: Record<string, unknown>;
}) {
  const perks = parseJsonArray(plan.perks);
  const onSale = saleCents < listCents;
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <TrackOnView event="InitiateCheckout" params={{ content_name: plan.name, value: saleCents / 100, currency: plan.currency }} />
      <JsonLd data={offerJson} />
      <div className="grid items-start gap-10 md:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-gold">{eyebrow}</p>
          <h1 className="mt-3 font-display text-4xl leading-[1.05] md:text-6xl">{title}</h1>
          <p className="mt-4 text-lg text-ink/90">{dek}</p>
          <div className="mt-4">
            <SocialProof unlockedHour={proof.unlockedHour} upgradesToday={proof.upgradesToday} />
          </div>
          {promo?.showCountdown ? (
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold">
                {promo.badge || "Offer ends soon"}
              </p>
              <Countdown endsAt={promo.endsAt} />
            </div>
          ) : null}
          <ul className="mt-6 space-y-2 text-sm text-muted">
            {perks.map((p) => (
              <li key={p}>— {p}</li>
            ))}
            <li>— First episodes of every series are free. VIP is how you finish tonight.</li>
          </ul>
        </div>
        <aside className="rounded-3xl border border-gold/30 bg-surface p-6 shadow-[0_0_40px_rgba(224,184,76,0.12)]">
          {promo?.badge ? (
            <span className="rounded-full bg-gold px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#1a1406]">
              {promo.badge}
            </span>
          ) : null}
          <h2 className="mt-3 font-display text-3xl">{plan.name}</h2>
          <div className="mt-3">
            <PriceTag listCents={listCents} saleCents={saleCents} currency={plan.currency} suffix={`/ ${periodLabel(plan.period)}`} />
          </div>
          {onSale ? (
            <p className="mt-2 text-xs text-gold-soft">
              Save {formatMoney(listCents - saleCents, plan.currency)} if you start before the timer ends.
            </p>
          ) : null}
          <CheckoutButtons
            kind="plan"
            id={plan.id}
            stripeReady={pay.stripeReady}
            paypalReady={pay.paypalReady}
            demoEnabled={pay.demoPayEnabled}
            signedIn={signedIn}
            nextLogin="/pricing"
            amountCents={saleCents}
            currency={plan.currency}
          />
          <p className="mt-3 text-center text-xs text-muted">
            Or <Link href="/pricing" className="text-gold">compare all plans</Link>. Cancel anytime.
          </p>
        </aside>
      </div>
      {series.length ? (
        <section className="mt-12">
          <h2 className="font-display text-3xl">Start with a free episode</h2>
          <p className="mt-2 text-sm text-muted">A short strip of what you can finish tonight on {siteConfig.name}.</p>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {series.slice(0, 4).map((s) => (
              <PosterCard key={s.id} series={s} width="w-full" />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
