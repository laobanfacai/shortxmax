import { prisma } from "./prisma";
import { siteConfig } from "./site";
import { parseJsonObject } from "./utils";

export async function getSettings() {
  const row =
    (await prisma.siteSettings.findUnique({ where: { id: "default" } })) ??
    (await prisma.siteSettings.create({
      data: {
        id: "default",
        siteName: siteConfig.name,
        tagline: siteConfig.tagline,
      },
    }));
  return row;
}

type PaySettings = Awaited<ReturnType<typeof getSettings>>;

function envOr(a: string | undefined, b: string) {
  return (a && a.trim()) || b || "";
}

export function resolvePayments(settings: PaySettings) {
  const envDemo = process.env.DEMO_PAY_ENABLED;
  const demoPayEnabled =
    envDemo === "false" ? false : envDemo === "true" ? true : settings.demoPayEnabled;

  const envMode = (process.env.STRIPE_MODE || settings.stripeMode || "test").toLowerCase();
  const stripeMode = envMode === "live" ? "live" : "test";

  const testPub = envOr(process.env.STRIPE_PUBLISHABLE_KEY, settings.stripePublicKey);
  const testSec = envOr(process.env.STRIPE_SECRET_KEY, settings.stripeSecretKey);
  const testWh = envOr(process.env.STRIPE_WEBHOOK_SECRET, settings.stripeWebhookSec);

  const livePub = envOr(process.env.STRIPE_LIVE_PUBLISHABLE_KEY, settings.stripeLivePublicKey);
  const liveSec = envOr(process.env.STRIPE_LIVE_SECRET_KEY, settings.stripeLiveSecretKey);
  const liveWh = envOr(process.env.STRIPE_LIVE_WEBHOOK_SECRET, settings.stripeLiveWebhookSec);

  const publicKey = stripeMode === "live" ? livePub || testPub : testPub;
  const secretKey = stripeMode === "live" ? liveSec || testSec : testSec;
  const webhookSecret = stripeMode === "live" ? liveWh || testWh : testWh;

  const stripeEnabled = process.env.STRIPE_ENABLED === "false" ? false : settings.stripeEnabled;
  const stripeReady = Boolean(stripeEnabled && secretKey && publicKey);

  const paypalMode = (process.env.PAYPAL_MODE || settings.paypalMode || "sandbox").toLowerCase() === "live" ? "live" : "sandbox";
  const paypalClientId = envOr(process.env.PAYPAL_CLIENT_ID, settings.paypalClientId);
  const paypalSecret = envOr(process.env.PAYPAL_SECRET, settings.paypalSecret);
  const paypalWebhookId = envOr(process.env.PAYPAL_WEBHOOK_ID, settings.paypalWebhookId);
  const paypalEnabled = process.env.PAYPAL_ENABLED === "false" ? false : settings.paypalEnabled;
  const paypalReady = Boolean(paypalEnabled && paypalClientId && paypalSecret);

  return {
    demoPayEnabled,
    stripeMode,
    publicKey,
    secretKey,
    webhookSecret,
    stripeEnabled,
    stripeReady,
    testConfigured: Boolean(testPub && testSec),
    liveConfigured: Boolean(livePub && liveSec),
    paypalMode,
    paypalClientId,
    paypalSecret,
    paypalWebhookId,
    paypalEnabled,
    paypalReady,
    paypalBase:
      paypalMode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com",
  };
}

/** @deprecated use resolvePayments */
export function resolveStripe(settings: PaySettings) {
  return resolvePayments(settings);
}

export function socialLinksOf(settings: { socialLinks: string }) {
  return parseJsonObject(settings.socialLinks, {
    twitter: "",
    instagram: "",
    youtube: "",
    tiktok: "",
  });
}

export function pixelIds(settings: PaySettings) {
  return {
    metaPixelId: (process.env.META_PIXEL_ID || settings.metaPixelId || "").trim(),
    tiktokPixelId: (process.env.TIKTOK_PIXEL_ID || settings.tiktokPixelId || "").trim(),
    googleTagId: (process.env.GOOGLE_TAG_ID || settings.googleTagId || "").trim(),
    googleAdsId: (process.env.GOOGLE_ADS_ID || settings.googleAdsId || "").trim(),
    googleAdsLabel: (process.env.GOOGLE_ADS_LABEL || settings.googleAdsLabel || "").trim(),
  };
}
