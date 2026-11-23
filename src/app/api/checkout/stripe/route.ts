import { safePath } from "@/lib/safe-path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkoutUrls, getPaymentConfig, getStripe } from "@/lib/payments";
import { createPendingOrder, readUtm } from "@/lib/checkout-order";
import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/lib/site";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const pay = await getPaymentConfig();
  const stripe = await getStripe();
  if (!pay.stripeReady || !stripe) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  const created = await createPendingOrder({
    userId: user.id,
    planId: body?.planId ? String(body.planId) : null,
    coinPackageId: body?.coinPackageId ? String(body.coinPackageId) : null,
    provider: "stripe",
  });
  if (!created.order || !created.item) {
    return NextResponse.json({ error: created.error }, { status: created.status });
  }
  if (created.order.status === "paid") return NextResponse.json({ url: `/checkout/success?orderId=${created.order.id}&next=${encodeURIComponent(safePath(body?.next))}` });
  if (created.order.status !== "pending") return NextResponse.json({ error: "This order is closed. Start a new checkout." }, { status: 409 });
  const utm = await readUtm();
  const urls = checkoutUrls(utm);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email,
    success_url: urls.success + "&next=" + encodeURIComponent(safePath(body?.next)),
    cancel_url: urls.cancel,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: created.item.currency.toLowerCase(),
          unit_amount: created.item.amountCents,
          product_data: {
            name: `${siteConfig.name} ${created.item.name}`,
            description: created.item.description,
          },
        },
      },
    ],
    metadata: {
      orderId: created.order.id,
      userId: user.id,
      type: created.item.kind === "plan" ? "subscription" : "coins",
    },
  }, { idempotencyKey: created.order.id });
  await prisma.order.update({
    where: { id: created.order.id },
    data: { providerRef: session.id },
  });
  return NextResponse.json({ url: session.url });
}
