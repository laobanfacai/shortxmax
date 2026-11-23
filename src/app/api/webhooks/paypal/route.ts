import { NextResponse } from "next/server";
import { fulfillPaidOrder } from "@/lib/fulfill";
import { getPaymentConfig, paypalAccessToken } from "@/lib/payments";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.text();
  const pay = await getPaymentConfig();
  if (!pay.paypalReady) {
    return NextResponse.json({ error: "PayPal is not configured." }, { status: 400 });
  }

  if (!pay.paypalWebhookId) return NextResponse.json({ error: "Verified webhook ID required." }, { status: 400 });
  if (pay.paypalWebhookId) {
    const auth = await paypalAccessToken();
    if (!auth?.token) return NextResponse.json({ error: "Verification unavailable." }, { status: 503 });
    if (auth?.token) {
      const verify = await fetch(`${auth.base}/v1/notifications/verify-webhook-signature`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auth_algo: req.headers.get("paypal-auth-algo"),
          cert_url: req.headers.get("paypal-cert-url"),
          transmission_id: req.headers.get("paypal-transmission-id"),
          transmission_sig: req.headers.get("paypal-transmission-sig"),
          transmission_time: req.headers.get("paypal-transmission-time"),
          webhook_id: pay.paypalWebhookId,
          webhook_event: JSON.parse(body || "{}"),
        }),
      });
      const result = (await verify.json().catch(() => ({}))) as { verification_status?: string };
      if (result.verification_status !== "SUCCESS") {
        return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
      }
    }
  }

  const event = JSON.parse(body || "{}") as {
    event_type?: string;
    resource?: { amount?: { value?: string; currency_code?: string }; status?: string; custom_id?: string; id?: string; supplementary_data?: { related_ids?: { order_id?: string } } };
  };
  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    const customId = event.resource?.custom_id;
    const paypalOrderId =
      event.resource?.supplementary_data?.related_ids?.order_id || event.resource?.id;
    const order =
      (customId ? await prisma.order.findUnique({ where: { id: customId } }) : null) ||
      (paypalOrderId
        ? await prisma.order.findFirst({ where: { providerRef: paypalOrderId } })
        : null);
    if (order && order.provider === "paypal" && order.providerRef === paypalOrderId && event.resource?.status === "COMPLETED" && Math.round(Number(event.resource?.amount?.value) * 100) === order.amountCents && event.resource?.amount?.currency_code === order.currency) {
      await fulfillPaidOrder(order.id);
    }
  }
  return NextResponse.json({ received: true });
}
