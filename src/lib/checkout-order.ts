import { cookies, headers } from "next/headers";
import { prisma } from "./prisma";
import { pricedItem } from "./payments";
import { UTM_COOKIE, type UtmSet } from "./utm";
import { countryFromHeaders } from "./geo";

export async function readUtm(): Promise<UtmSet> {
  const raw = (await cookies()).get(UTM_COOKIE)?.value;
  if (!raw) return {};
  try {
    return JSON.parse(decodeURIComponent(raw)) as UtmSet;
  } catch {
    try {
      return JSON.parse(raw) as UtmSet;
    } catch {
      return {};
    }
  }
}

export async function createPendingOrder(opts: {
  userId: string;
  planId?: string | null;
  coinPackageId?: string | null;
  provider: string;
  providerRef?: string;
}) {
  const item = await pricedItem({ planId: opts.planId, coinPackageId: opts.coinPackageId });
  if (!item) return { error: "Choose a plan or coin pack.", status: 400 as const, item: null, order: null };
  const utm = await readUtm();
  const h = await headers();
  const key = h.get("idempotency-key") || "";
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(key)) return { error: "A valid idempotency key is required.", status: 400 as const, item: null, order: null };
  const rid = `${opts.provider}:${opts.userId}:${key}`;
  const country = countryFromHeaders(h);
  const order = await prisma.$transaction(async tx => {
    const prior = await tx.checkoutRequest.findUnique({ where: { id: rid } });
    if (prior) {
      const previous = await tx.order.findUniqueOrThrow({ where: { id: prior.orderId } });
      if (previous.planId !== (item.plan?.id || null) || previous.coinPackageId !== (item.pack?.id || null)) throw new Error("Idempotency key mismatch");
      return previous;
    }
  const created = await tx.order.create({
    data: {
      userId: opts.userId,
      type: item.kind === "plan" ? "subscription" : "coins",
      amountCents: item.amountCents,
      listAmountCents: item.listCents,
      currency: item.currency,
      status: "pending",
      provider: opts.provider,
      providerRef: opts.providerRef,
      planId: item.plan?.id,
      coinPackageId: item.pack?.id,
      promoId: item.promoId,
      utmSource: utm.utmSource,
      utmMedium: utm.utmMedium,
      utmCampaign: utm.utmCampaign,
      utmContent: utm.utmContent,
      utmTerm: utm.utmTerm,
      country: country,
    },
  });

    await tx.checkoutRequest.create({ data: { id: rid, userId: opts.userId, orderId: created.id } });
    return created;
  });
  return { error: null, status: 200 as const, item, order };
}
