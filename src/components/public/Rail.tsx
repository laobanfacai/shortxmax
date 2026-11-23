import Link from "next/link";
import { PosterCard, type PosterSeries } from "./PosterCard";

export function Rail({
  title,
  href,
  subtitle,
  series,
}: {
  title: string;
  href?: string;
  subtitle?: string;
  series: PosterSeries[];
}) {
  if (!series.length) return null;
  return (
    <section className="relative">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold md:text-3xl">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
        </div>
        {href ? (
          <Link href={href} className="text-sm text-gold hover:text-gold-soft">
            See all
          </Link>
        ) : null}
      </div>
      <div className="rail -mx-4 px-4 md:-mx-0 md:px-0">
        {series.map((s) => (
          <PosterCard key={s.slug} series={s} />
        ))}
      </div>
    </section>
  );
}
