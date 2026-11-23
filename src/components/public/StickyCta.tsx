import Link from "next/link";
import type { PublicPromo } from "@/lib/promo";
import { Countdown } from "./Countdown";

export function StickyCta({
  hidden,
  promo,
  href = "/pricing",
  label,
}: {
  hidden?: boolean;
  promo?: PublicPromo | null;
  href?: string;
  label?: string;
}) {
  if (hidden) return null;
  const text = label || (promo ? "Unlock the sale price — Go VIP" : "Unlock every episode — Start VIP");
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-30 flex justify-center px-4 md:bottom-6">
      <Link href={href} className="pointer-events-auto btn btn-gold btn-lg shadow-2xl max-md:w-full">
        <span>{text}</span>
        {promo?.showCountdown ? (
          <span className="ml-2 hidden text-xs font-semibold text-[#1a1406]/80 sm:inline">
            <Countdown endsAt={promo.endsAt} compact />
          </span>
        ) : null}
      </Link>
    </div>
  );
}
