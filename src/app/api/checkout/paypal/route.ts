import { safePath } from "@/lib/safe-path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPaymentConfig, paypalAccessToken } from "@/lib/payments";
import { createPendingOrder } from "@/lib/checkout-order";
import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/lib/site";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const pay = await getPaymentConfig();
  if (!pay.paypalReady) {
    return NextResponse.json({ error: "PayPal is not configured." }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  const created = await createPendingOrder({
    userId: user.id,
    planId: body?.planId ? String(body.planId) : null,
    coinPackageId: body?.coinPackageId ? String(body.coinPackageId) : null,
    provider: "paypal",
  });
  if (!created.order || !created.item) {
    return NextResponse.json({ error: created.error }, { status: created.status });
  }

  if (created.order.status === "paid") return NextResponse.json({ url: `/checkout/success?orderId=${created.order.id}&next=${encodeURIComponent(safePath(body?.next))}` });
  if (created.order.status !== "pending") return NextResponse.json({ error: "This order is closed. Start a new checkout." }, { status: 409 });
  const auth = await paypalAccessToken();
  if (!auth?.token) {
    return NextResponse.json({ error: "PayPal authentication failed." }, { status: 502 });
  }

  const value = (created.item.amountCents / 100).toFixed(2);
  const res = await fetch(`${auth.base}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": created.order.id,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: created.order.id,
          description: `${siteConfig.name} ${created.item.name}`,
          amount: { currency_code: created.item.currency.toUpperCase(), value },
        },
      ],
      application_context: {
        brand_name: siteConfig.name,
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: `${siteConfig.url}/checkout/paypal/return?orderId=${created.order.id}&next=${encodeURIComponent(safePath(body?.next))}`,
        cancel_url: `${siteConfig.url}/pricing?canceled=1`,
      },
    }),
  });
  const data = (await res.json()) as {
    id?: string;
    links?: { rel: string; href: string }[];
    message?: string;
  };
  if (!res.ok || !data.id) {
    return NextResponse.json(
      { error: data.message || "PayPal could not start checkout." },
      { status: 502 },
    );
  }
  await prisma.order.update({
    where: { id: created.order.id },
    data: { providerRef: data.id },
  });
  const approve = data.links?.find((l) => l.rel === "approve")?.href;
  if (!approve) {
    return NextResponse.json({ error: "PayPal approval link missing." }, { status: 502 });
  }
  return NextResponse.json({ url: approve });
}
