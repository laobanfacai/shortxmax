export function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const cls = size === "md" ? "text-sm" : "text-xs";
  return (
    <span className={`inline-flex items-center gap-1 ${cls} text-gold-soft`} aria-label={`${rating.toFixed(1)} out of 5`}>
      <svg viewBox="0 0 20 20" className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} fill="currentColor" aria-hidden>
        <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.52L10 14.13 5.06 16.73 6 11.21l-4-3.9 5.53-.8L10 1.5z" />
      </svg>
      <span className="tabular-nums">{rating.toFixed(1)}</span>
    </span>
  );
}
