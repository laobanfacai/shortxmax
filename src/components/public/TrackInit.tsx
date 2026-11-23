"use client";

import { useEffect } from "react";

export type PixelIds = {
  metaPixelId: string;
  tiktokPixelId: string;
  googleTagId: string;
  googleAdsId: string;
  googleAdsLabel: string;
};

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    ttq?: { track: (...args: unknown[]) => void; page?: () => void };
    gtag?: (...args: unknown[]) => void;
    __lumereelPixels?: PixelIds;
  }
}

export function TrackInit({ ids }: { ids: PixelIds }) {
  useEffect(() => {
    window.__lumereelPixels = ids;
  }, [ids]);
  return null;
}

export function trackEvent(
  name: "ViewContent" | "InitiateCheckout" | "Purchase",
  params?: Record<string, unknown>,
) {
  if (typeof window === "undefined") return;
  const ids = window.__lumereelPixels;
  try {
    if (ids?.metaPixelId && window.fbq) window.fbq("track", name, params || {});
    if (ids?.tiktokPixelId && window.ttq) {
      const tiktokName = name === "Purchase" ? "CompletePayment" : name;
      window.ttq.track(tiktokName, params || {});
    }
    if (window.gtag && (ids?.googleTagId || ids?.googleAdsId)) {
      const gName = name === "Purchase" ? "purchase" : name === "InitiateCheckout" ? "begin_checkout" : "view_item";
      window.gtag("event", gName, params || {});
      if (name === "Purchase" && ids?.googleAdsId && ids?.googleAdsLabel) {
        window.gtag("event", "conversion", {
          send_to: `${ids.googleAdsId}/${ids.googleAdsLabel}`,
          ...(params || {}),
        });
      }
    }
  } catch {
    /* ignore */
  }
}
