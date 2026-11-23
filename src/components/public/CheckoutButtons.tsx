"use client";

import { useState, useRef } from "react";
import { safePath } from "@/lib/safe-path";
import { useRouter } from "next/navigation";
import { trackEvent } from "./TrackInit";

export function CheckoutButtons({
  kind,
  id,
  stripeReady,
  paypalReady,
  demoEnabled,
  signedIn,
  nextLogin,
  amountCents,
  currency = "USD",
}: {
  kind: "plan" | "coins";
  id: string;
  stripeReady: boolean;
  paypalReady?: boolean;
  demoEnabled: boolean;
  signedIn: boolean;
  nextLogin: string;
  amountCents?: number;
  currency?: string;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();
  const requestKey = useRef("");

  async function pay(mode: "demo" | "stripe" | "paypal") {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(nextLogin)}`);
      return;
    }
    setPending(mode);
    setError("");
    if (mode !== "demo") trackEvent("InitiateCheckout", {
      value: amountCents ? amountCents / 100 : undefined,
      currency,
      content_type: kind,
      content_ids: [id],
    });
    const url =
      mode === "demo"
        ? "/api/checkout/demo"
        : mode === "paypal"
          ? "/api/checkout/paypal"
          : "/api/checkout/stripe";
    if (!requestKey.current) requestKey.current = crypto.randomUUID();
    const resume = new URLSearchParams(window.location.search).get("next") || sessionStorage.getItem("lumereel_resume") || "/account";
    let res: Response;
    try { res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey.current },
      body: JSON.stringify({ ...(kind === "plan" ? { planId: id } : { coinPackageId: id }), next: safePath(resume) }),
    });
    } catch { setPending(null); setError("Network error. Try again; this request will not be charged twice."); return; }
    const data = await res.json().catch(() => ({}));
    setPending(null);
    if (!res.ok) {
      setError(data.error || "Payment could not start.");
      return;
    }
    if (data.url) {
      window.location.href = data.url;
      return;
    }
    router.push(safePath(data.redirect, "/account"));
  }

  const any = demoEnabled || stripeReady || paypalReady;

  return (
    <div className="mt-5 space-y-2">
      <button
        type="button"
        className="btn btn-gold btn-lg w-full disabled:opacity-50"
        onClick={() => pay("paypal")}
        disabled={Boolean(pending) || !paypalReady}
        title={paypalReady ? "Pay with PayPal" : "Add PayPal keys in Admin → Payments to enable"}
      >
        {pending === "paypal" ? "Redirecting to PayPal…" : "Pay with PayPal"}
      </button>
      <button
        type="button"
        className="btn btn-outline-gold btn-lg w-full disabled:opacity-50"
        onClick={() => pay("stripe")}
        disabled={Boolean(pending) || !stripeReady}
        title={stripeReady ? "Pay with card (Stripe)" : "Add Stripe keys in Admin → Payments to enable"}
      >
        {pending === "stripe" ? "Redirecting…" : "Pay with card (Stripe)"}
      </button>
      {demoEnabled ? (
        <button
          type="button"
          className="btn btn-ghost btn-lg w-full"
          onClick={() => pay("demo")}
          disabled={Boolean(pending)}
        >
          {pending === "demo" ? "Processing…" : "Demo Pay — preview, no real charge"}
        </button>
      ) : null}
      {!paypalReady || !stripeReady ? (
        <p className="text-xs text-muted">
          {!paypalReady && !stripeReady
            ? "PayPal and Stripe unlock after you add keys in Admin → Payments. Demo Pay is available for preview."
            : !paypalReady
              ? "PayPal unlocks after you add keys in Admin → Payments."
              : "Stripe unlocks after you add keys in Admin → Payments."}
        </p>
      ) : null}
      {!any ? <p className="text-sm text-muted">Payments are temporarily unavailable.</p> : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
