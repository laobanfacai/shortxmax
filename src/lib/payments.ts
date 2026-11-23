import Stripe from "stripe";
import { getSettings, resolvePayments } from "./settings";
import { siteConfig } from "./site";
import type { UtmSet } from "./utm";
import { getActivePromo, promoPriceFor, type PublicPromo } from "./promo";
import { prisma } from "./prisma";

export async function getPaymentConfig() {
  const settings = await getSettings();
  const cfg = resolvePayments(settings);
  const methods = await prisma.paymentMethod.findMany();
  const on = (provider: string) => methods.find((m) => m.provider === provider)?.isEnabled !== false;
  return {
    ...cfg,
    stripeReady: cfg.stripeReady && on("stripe"),
    paypalReady: cfg.paypalReady && on("paypal"),
    demoPayEnabled: cfg.demoPayEnabled && on("demo"),
  };
}

export async function getStripe() {
  const cfg = await getPaymentConfig();
  if (!cfg.secretKey) return null;
  return new Stripe(cfg.secretKey);
}

export function checkoutUrls(utm?: UtmSet) {
  const q = new URLSearchParams();
  if (utm?.utmSource) q.set("utm_source", utm.utmSource);
  if (utm?.utmMedium) q.set("utm_medium", utm.utmMedium);
  if (utm?.utmCampaign) q.set("utm_campaign", utm.utmCampaign);
  const extra = q.toString();
  const join = extra ? `&${extra}` : "";
  return {
    success: `${siteConfig.url}/checkout/success?session_id={CHECKOUT_SESSION_ID}${join}`,
    cancel: `${siteConfig.url}/pricing?canceled=1${extra ? `&${extra}` : ""}`,
  };
}

export async function pricedItem(opts: {
  planId?: string | null;
  coinPackageId?: string | null;
  promo?: PublicPromo | null;
}) {
  const promo = opts.promo === undefined ? await getActivePromo() : opts.promo;
  if (opts.planId) {
    const plan = await prisma.plan.findFirst({ where: { id: opts.planId, isEnabled: true } });
    if (!plan) return null;
    const pricing = promoPriceFor(promo, "plan", plan.id, plan.priceCents);
    return {
      kind: "plan" as const,
      plan,
      pack: null,
      listCents: pricing.listCents,
      amountCents: pricing.saleCents,
      currency: plan.currency,
      name: plan.name,
      description: `${plan.period} VIP access`,
      promoId: pricing.onSale && promo ? promo.id : null,
    };
  }
  if (opts.coinPackageId) {
    const pack = await prisma.coinPackage.findFirst({
      where: { id: opts.coinPackageId, isEnabled: true },
    });
    if (!pack) return null;
    const pricing = promoPriceFor(promo, "coins", pack.id, pack.priceCents);
    return {
      kind: "coins" as const,
      plan: null,
      pack,
      listCents: pricing.listCents,
      amountCents: pricing.saleCents,
      currency: pack.currency,
      name: pack.name,
      description: `${pack.coins + pack.bonusCoins} coins`,
      promoId: pricing.onSale && promo ? promo.id : null,
    };
  }
  return null;
}

export async function paypalAccessToken() {
  const cfg = await getPaymentConfig();
  if (!cfg.paypalReady) return null;
  const auth = Buffer.from(`${cfg.paypalClientId}:${cfg.paypalSecret}`).toString("base64");
  const res = await fetch(`${cfg.paypalBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string };
  return { token: data.access_token || "", base: cfg.paypalBase, cfg };
}
