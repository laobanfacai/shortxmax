"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { d, h, m, s, done: total <= 0 };
}

function Cell({ n, label }: { n: number; label: string }) {
  return (
    <span className="inline-flex min-w-[3rem] flex-col items-center rounded-lg bg-black/40 px-2 py-1 ring-1 ring-gold/30">
      <span className="font-display text-xl tabular-nums leading-none text-gold-soft md:text-2xl">
        {String(n).padStart(2, "0")}
      </span>
      <span className="mt-1 text-[9px] uppercase tracking-[0.14em] text-muted">{label}</span>
    </span>
  );
}

export function Countdown({
  endsAt,
  className = "",
  compact = false,
}: {
  endsAt: string;
  className?: string;
  compact?: boolean;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endsAt]);
  if (now == null) {
    return compact ? (
      <span className={`inline-flex items-center gap-1 tabular-nums text-gold-soft ${className}`}>&nbsp;</span>
    ) : (
      <div className={`flex flex-wrap items-end gap-2 ${className}`} aria-hidden="true" />
    );
  }
  const p = parts(new Date(endsAt).getTime() - now);
  if (p.done) {
    return <span className={`text-sm text-muted ${className}`}>This offer has ended.</span>;
  }
  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 tabular-nums text-gold-soft ${className}`}>
        {p.d > 0 ? `${p.d}d ` : ""}
        {String(p.h).padStart(2, "0")}:{String(p.m).padStart(2, "0")}:{String(p.s).padStart(2, "0")}
      </span>
    );
  }
  return (
    <div className={`flex flex-wrap items-end gap-2 ${className}`} aria-live="polite">
      {p.d > 0 ? <Cell n={p.d} label="Days" /> : null}
      <Cell n={p.h} label="Hours" />
      <Cell n={p.m} label="Min" />
      <Cell n={p.s} label="Sec" />
    </div>
  );
}
