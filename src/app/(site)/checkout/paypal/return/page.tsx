import { safePath } from "@/lib/safe-path";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { fulfillPaidOrder } from "@/lib/fulfill";
import { paypalAccessToken } from "@/lib/payments";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PayPalReturn({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; orderId?: string; next?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/pricing");
  const sp = await searchParams;
  const paypalId = sp.token;
  const ourId = sp.orderId;
  const order = ourId
    ? await prisma.order.findFirst({ where: { id: ourId, userId: user.id } })
    : paypalId
      ? await prisma.order.findFirst({ where: { providerRef: paypalId, userId: user.id } })
      : null;
  if (!order || order.provider !== "paypal" || !order.providerRef || (paypalId && paypalId !== order.providerRef)) redirect("/pricing?canceled=1");
  if (order.status === "paid") redirect(`/checkout/success?orderId=${encodeURIComponent(order.id)}&next=${encodeURIComponent(safePath(sp.next))}`);

  const auth = await paypalAccessToken();
  if (!auth?.token) redirect("/pricing?canceled=1");
  const captureId = order.providerRef;
  const res = await fetch(`${auth.base}/v2/checkout/orders/${captureId}/capture`, {
    method: "POST", headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json", "PayPal-Request-Id": order.id },
  });
  // Always read authoritative order state, even for ORDER_ALREADY_CAPTURED.
  const verify = await fetch(`${auth.base}/v2/checkout/orders/${captureId}`, { headers: { Authorization: `Bearer ${auth.token}` }, cache: "no-store" });
  if (!verify.ok) redirect("/pricing?canceled=1");
  const remote = await verify.json();
  const captures = remote.purchase_units?.flatMap((u: { payments?: { captures?: unknown[] } }) => u.payments?.captures || []) || [];
  if (remote.status !== "COMPLETED" || !captures.some((c: {status?:string;amount?:{value?:string;currency_code?:string}}) => c.status === "COMPLETED" && Math.round(Number(c.amount?.value)*100) === order.amountCents && c.amount?.currency_code === order.currency)) redirect("/pricing?canceled=1");
  await fulfillPaidOrder(order.id);
  redirect(`/checkout/success?orderId=${encodeURIComponent(order.id)}&next=${encodeURIComponent(safePath(sp.next))}`);
}
