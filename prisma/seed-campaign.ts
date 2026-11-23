import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const paypal = await prisma.paymentMethod.findFirst({ where: { provider: "paypal" } });
  if (!paypal) {
    await prisma.paymentMethod.create({
      data: {
        name: "PayPal",
        provider: "paypal",
        description: "PayPal 结账（沙盒或正式）",
        isEnabled: true,
        sortOrder: 3,
      },
    });
    console.log("Added PayPal payment method");
  }

  const existing = await prisma.promoCampaign.findFirst({
    where: { name: "7-Day Launch Sale" },
  });
  const plans = await prisma.plan.findMany();
  const packs = await prisma.coinPackage.findMany();
  const weekly = plans.find((p) => p.slug === "weekly");
  const monthly = plans.find((p) => p.slug === "monthly");
  const yearly = plans.find((p) => p.slug === "yearly");
  const plus = packs.find((p) => p.name === "Plus") || packs[1];

  const planPrices = [
    weekly ? { id: weekly.id, promoCents: 249 } : null,
    monthly ? { id: monthly.id, promoCents: 499 } : null,
    yearly ? { id: yearly.id, promoCents: 2999 } : null,
  ].filter(Boolean);
  const coinPrices = plus ? [{ id: plus.id, promoCents: 699 }] : [];

  const startsAt = new Date(Date.now() - 60 * 60 * 1000);
  const endsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const payload = {
    name: "7-Day Launch Sale",
    badge: "7-DAY LAUNCH SALE",
    headline: "Finish the story at a launch price.",
    description:
      "For seven days, VIP is on a launch rate — weekly, monthly, and yearly. Free episodes still hook you. The sale is how you finish tonight. Cancel anytime.",
    planPrices: JSON.stringify(planPrices),
    coinPrices: JSON.stringify(coinPrices),
    startsAt,
    endsAt,
    showCountdown: true,
    isEnabled: true,
  };

  if (existing) {
    await prisma.promoCampaign.update({ where: { id: existing.id }, data: payload });
    console.log("Updated promo", existing.id, "ends", endsAt.toISOString());
  } else {
    const created = await prisma.promoCampaign.create({ data: payload });
    console.log("Created promo", created.id, "ends", endsAt.toISOString());
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
