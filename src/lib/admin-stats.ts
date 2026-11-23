import { prisma } from "./prisma";
import { sourceFromUtmAndReferrer, displayCountry } from "./geo";

export async function dashboardStats(start: Date, end: Date) {
  const now = new Date();
  const inRange = { gte: start, lte: end };
  const [
    visits,
    newUsers,
    newOrders,
    paidAgg,
    refundAgg,
    newVip,
    activeVip,
    views,
    users,
    paidOrders,
    refundOrders,
    popular,
    recentOrders,
  ] = await Promise.all([
    prisma.pageView.count({ where: { createdAt: inRange } }),
    prisma.user.count({ where: { createdAt: inRange } }),
    prisma.order.count({ where: { createdAt: inRange } }),
    prisma.order.aggregate({
      where: { status: "paid", paidAt: inRange },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.order.aggregate({
      where: { status: "refunded", createdAt: inRange },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.subscription.count({ where: { createdAt: inRange } }),
    prisma.subscription.count({ where: { status: { in: ["active", "canceled"] }, endsAt: { gt: now } } }),
    prisma.pageView.findMany({
      where: { createdAt: inRange },
      select: { source: true, country: true, utmSource: true },
    }),
    prisma.user.findMany({
      where: { createdAt: inRange },
      select: { utmSource: true, country: true },
    }),
    prisma.order.findMany({
      where: { status: "paid", paidAt: inRange },
      select: { utmSource: true, country: true, amountCents: true },
    }),
    prisma.order.findMany({
      where: { status: "refunded", createdAt: inRange },
      select: { utmSource: true, country: true, amountCents: true },
    }),
    prisma.series.findMany({
      where: { status: "published", isCatalogOnly: false },
      orderBy: { viewCount: "desc" },
      take: 6,
      select: { id: true, title: true, viewCount: true },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { email: true } } },
    }),
  ]);

  type Row = { visits: number; signups: number; payments: number; gmv: number };
  const empty = (): Row => ({ visits: 0, signups: 0, payments: 0, gmv: 0 });

  const bySource = new Map<string, Row>();
  const byCountry = new Map<string, Row>();
  const bump = (map: Map<string, Row>, key: string, field: keyof Row, n: number) => {
    const k = key || "未知";
    const row = map.get(k) || empty();
    row[field] += n;
    map.set(k, row);
  };

  for (const v of views) bump(bySource, v.source || "直接访问", "visits", 1);
  for (const v of views) bump(byCountry, displayCountry(v.country), "visits", 1);
  for (const u of users) {
    const src = sourceFromUtmAndReferrer({ utmSource: u.utmSource });
    bump(bySource, src, "signups", 1);
    bump(byCountry, displayCountry(u.country), "signups", 1);
  }
  for (const o of paidOrders) {
    const src = sourceFromUtmAndReferrer({ utmSource: o.utmSource });
    bump(bySource, src, "payments", 1);
    bump(bySource, src, "gmv", o.amountCents);
    bump(byCountry, displayCountry(o.country), "payments", 1);
    bump(byCountry, displayCountry(o.country), "gmv", o.amountCents);
  }
  // refunds already in refundAgg; no need in source table unless wanted

  const sortRows = (map: Map<string, Row>) =>
    [...map.entries()]
      .map(([name, r]) => ({ name, ...r }))
      .sort((a, b) => b.visits - a.visits || b.gmv - a.gmv)
      .slice(0, 8);

  return {
    visits,
    newUsers,
    newOrders,
    paidCount: paidAgg._count,
    gmvCents: paidAgg._sum.amountCents || 0,
    refundCount: refundAgg._count,
    refundCents: refundAgg._sum.amountCents || 0,
    newVip,
    activeVip,
    sources: sortRows(bySource),
    countries: sortRows(byCountry),
    popular,
    recentOrders,
  };
}
