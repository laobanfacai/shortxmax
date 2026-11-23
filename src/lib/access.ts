import { prisma } from "./prisma";

export async function getActiveSubscription(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
  if (!user || user.status !== "active") return null;
  const now = new Date();
  const sub = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ["active", "canceled"] },
      endsAt: { gt: now },
    },
    include: { plan: true },
    orderBy: { endsAt: "desc" },
  });
  if (!sub) return null;
  if (sub.status === "canceled" && sub.endsAt <= now) return null;
  return sub;
}

export async function canWatchEpisode(opts: {
  userId?: string | null;
  episodeId: string;
  isFree: boolean;
}) {
  if (opts.userId) { const user = await prisma.user.findUnique({ where: { id: opts.userId }, select: { status: true } }); if (!user || user.status !== "active") return { allowed: false, reason: "auth" as const }; }
  if (opts.isFree) return { allowed: true, reason: "free" as const };
  if (!opts.userId) return { allowed: false, reason: "auth" as const };

  const sub = await getActiveSubscription(opts.userId);
  if (sub) return { allowed: true, reason: "vip" as const };

  const unlock = await prisma.episodeUnlock.findUnique({
    where: {
      userId_episodeId: { userId: opts.userId, episodeId: opts.episodeId },
    },
  });
  if (unlock) return { allowed: true, reason: "unlock" as const };

  return { allowed: false, reason: "paywall" as const };
}

export function periodToMs(period: string) {
  if (period === "weekly") return 7 * 24 * 60 * 60 * 1000;
  if (period === "yearly") return 365 * 24 * 60 * 60 * 1000;
  return 30 * 24 * 60 * 60 * 1000;
}
