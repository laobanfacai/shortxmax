import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/public/LogoutButton";
import { getCurrentUser } from "@/lib/auth";
import { getActiveSubscription } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { buildMetadata } from "@/lib/seo";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = buildMetadata({
  title: "Account",
  description: "Manage your ShortXMax profile, VIP plan, coins, and watch history.",
  path: "/account",
  noIndex: true,
});

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const [vip, orders] = await Promise.all([
    getActiveSubscription(user.id),
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <p className="text-xs uppercase tracking-[0.22em] text-gold">Account</p>
      <h1 className="mt-2 font-display text-4xl">{user.name || "Your account"}</h1>
      <p className="mt-2 text-muted">{user.email}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">VIP</p>
          <p className="mt-2 font-display text-2xl">
            {vip ? vip.plan.name : "Not subscribed"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {vip ? `Active until ${vip.endsAt.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }) + " Asia/Shanghai"}` : "Unlock every episode today."}
          </p>
          <Link href="/pricing" className="btn btn-gold btn-sm mt-4">
            {vip ? "Manage plan" : "Go VIP"}
          </Link>
        </div>
        <div className="rounded-2xl border border-white/10 bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Coins</p>
          <p className="mt-2 font-display text-2xl">{user.coins}</p>
          <Link href="/pricing" className="btn btn-ghost btn-sm mt-4">
            Buy coins
          </Link>
        </div>
        <div className="rounded-2xl border border-white/10 bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Library</p>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <Link href="/account/list" className="text-gold hover:text-gold-soft">
              My list
            </Link>
            <Link href="/account/history" className="text-gold hover:text-gold-soft">
              Watch history
            </Link>
          </div>
        </div>
      </div>

      <Link href="/account/settings" className="btn btn-outline-gold btn-md mt-6">Edit profile & change password</Link><h2 className="mt-12 font-display text-2xl">Order history (latest 100)</h2>
      {orders.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No orders yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-white/5 rounded-2xl border border-white/10">
          {orders.map((o) => (
            <li key={o.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="capitalize text-muted">
                {o.type} · {o.provider === "demo" ? "DEMO — no real charge" : o.provider} · {o.status} · {o.createdAt.toLocaleDateString("en-US")}
              </span>
              <span>{formatMoney(o.amountCents, o.currency)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10 flex items-center gap-3">
        {user.role === "admin" ? (
          <Link href="/admin" className="btn btn-outline-gold btn-md">
            Admin panel
          </Link>
        ) : null}
        <LogoutButton />
      </div>
    </div>
  );
}
