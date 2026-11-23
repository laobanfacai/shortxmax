import { prisma } from "./prisma";

export async function getSocialProofCounts() {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const day = new Date().toLocaleString("en-CA", {
    timeZone: "Asia/Shanghai",
    hourCycle: "h23",
  }).slice(0, 10);
  const startShanghai = new Date(`${day}T00:00:00+08:00`);

  const [unlocks, paidHour, upgradesToday] = await Promise.all([
    prisma.episodeUnlock.count({ where: { createdAt: { gte: hourAgo } } }),
    prisma.order.count({
      where: { status: "paid", type: { in: ["subscription", "unlock"] }, paidAt: { gte: hourAgo } },
    }),
    prisma.order.count({
      where: { status: "paid", type: "subscription", paidAt: { gte: startShanghai } },
    }),
  ]);
  return {
    unlockedHour: unlocks + paidHour,
    upgradesToday,
  };
}
