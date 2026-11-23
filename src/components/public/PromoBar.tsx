"use client";

import Link from "next/link";
import { Countdown } from "./Countdown";
import type { PublicPromo } from "@/lib/promo";

export function PromoBar({ promo }: { promo: PublicPromo | null }) {
  if (!promo) return null;
  return (
    <div className="relative z-50 bg-gradient-to-r from-[#3a2a0a] via-[#1a1408] to-[#3a2a0a] text-center text-sm text-ink">
      <Link href="/pricing" className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-3 py-2">
        {promo.badge ? (
          <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1a1406]">
            {promo.badge}
          </span>
        ) : null}
        <span className="font-medium">{promo.headline || promo.name}</span>
        {promo.showCountdown ? (
          <span className="inline-flex items-center gap-1 text-gold-soft">
            Ends in <Countdown endsAt={promo.endsAt} compact />
          </span>
        ) : null}
        <span className="text-gold-soft underline-offset-2 hover:underline">See VIP offer →</span>
      </Link>
    </div>
  );
}
