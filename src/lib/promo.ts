import { prisma } from "./prisma";
import { parseJsonArray } from "./utils";

export type PromoPriceRow = { id: string; promoCents: number };

export type PublicPromo = {
  id: string;
  name: string;
  badge: string;
  headline: string;
  description: string;
  endsAt: string;
  startsAt: string;
  showCountdown: boolean;
  planPrices: PromoPriceRow[];
  coinPrices: PromoPriceRow[];
};

function parsePrices(raw: string): PromoPriceRow[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => ({
        id: String(row.id || ""),
        promoCents: Number(row.promoCents),
      }))
      .filter((row) => row.id && Number.isFinite(row.promoCents) && row.promoCents >= 0);
  } catch {
    return [];
  }
}

export function toPublicPromo(row: {
  id: string;
  name: string;
  badge: string;
  headline: string;
  description: string;
  endsAt: Date;
  startsAt: Date;
  showCountdown: boolean;
  planPrices: string;
  coinPrices: string;
}): PublicPromo {
  return {
    id: row.id,
    name: row.name,
    badge: row.badge,
    headline: row.headline,
    description: row.description,
    endsAt: row.endsAt.toISOString(),
    startsAt: row.startsAt.toISOString(),
    showCountdown: row.showCountdown,
    planPrices: parsePrices(row.planPrices),
    coinPrices: parsePrices(row.coinPrices),
  };
}

export async function getActivePromo(): Promise<PublicPromo | null> {
  const now = new Date();
  const row = await prisma.promoCampaign.findFirst({
    where: { isEnabled: true, startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: { endsAt: "asc" },
  });
  return row ? toPublicPromo(row) : null;
}

export function promoPriceFor(
  promo: PublicPromo | null | undefined,
  kind: "plan" | "coins",
  id: string,
  listCents: number,
) {
  if (!promo) return { listCents, saleCents: listCents, onSale: false };
  const rows = kind === "plan" ? promo.planPrices : promo.coinPrices;
  const hit = rows.find((r) => r.id === id);
  if (!hit) return { listCents, saleCents: listCents, onSale: false };
  const saleCents = Math.min(hit.promoCents, listCents);
  return { listCents, saleCents, onSale: saleCents < listCents || hit.promoCents !== listCents };
}

export function planIdsOf(promo: PublicPromo) {
  return promo.planPrices.map((p) => p.id);
}
