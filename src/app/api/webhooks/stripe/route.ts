import { NextResponse } from "next/server";
import { fulfillPaidOrder } from "@/lib/fulfill";
import { getPaymentConfig, getStripe } from "@/lib/payments";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const pay = await getPaymentConfig();
  const stripe = await getStripe();
  if (!stripe || !pay.webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 400 });
  }
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, pay.webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;
    const order =
      (orderId ? await prisma.order.findUnique({ where: { id: orderId } }) : null) ||
      (session.id
        ? await prisma.order.findFirst({ where: { providerRef: session.id } })
        : null);
    if (order && order.provider === "stripe" && order.providerRef === session.id && session.payment_status === "paid" && session.amount_total === order.amountCents && session.currency?.toUpperCase() === order.currency.toUpperCase()) {
      await fulfillPaidOrder(order.id);
    }
  }
  return NextResponse.json({ received: true });
}
