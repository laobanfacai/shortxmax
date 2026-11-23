"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type HeroSlideView = {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  href: string;
  imageUrl: string;
};

export function HeroCarousel({
  slides,
  showVip,
}: {
  slides: HeroSlideView[];
  showVip?: boolean;
}) {
  const [i, setI] = useState(0);
  const n = slides.length;
  useEffect(() => {
    if (n <= 1) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 7000);
    return () => clearInterval(t);
  }, [n]);

  if (!n) return null;
  const slide = slides[i];

  return (
    <section className="relative min-h-[86vh] w-full overflow-hidden">
      {slides.map((s, idx) => (
        <div
          key={s.id}
          className={`absolute inset-0 transition-opacity duration-700 ${idx === i ? "opacity-100" : "opacity-0"}`}
          aria-hidden={idx !== i}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={s.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[center_20%] scale-105"
          />
        </div>
      ))}
      <div className="hero-shade absolute inset-0" />
      <div className="relative mx-auto flex min-h-[86vh] max-w-7xl flex-col justify-end px-4 pb-16 pt-28 md:px-6 md:pb-20">
        <p className="text-xs uppercase tracking-[0.28em] text-gold">Now streaming</p>
        <h1 className="mt-3 max-w-3xl font-display text-5xl font-semibold leading-[1.05] sm:text-6xl md:text-7xl">
          {slide.title}
        </h1>
        {slide.subtitle ? <p className="mt-4 max-w-xl text-lg text-ink/90">{slide.subtitle}</p> : null}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={slide.href || "/pricing"} className="btn btn-gold btn-lg">
            {slide.ctaLabel || "Watch now"}
          </Link>
          {showVip ? (
            <Link href="/pricing" className="btn btn-outline-gold btn-lg">
              Unlock all episodes
            </Link>
          ) : null}
        </div>
        {n > 1 ? (
          <div className="mt-10 flex items-center gap-3">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-label="Previous slide"
              onClick={() => setI((x) => (x - 1 + n) % n)}
            >
              ←
            </button>
            <div className="flex gap-2">
              {slides.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Go to ${s.title}`}
                  onClick={() => setI(idx)}
                  className={`h-1.5 rounded-full transition-all ${idx === i ? "w-8 bg-gold" : "w-3 bg-white/35"}`}
                />
              ))}
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-label="Next slide"
              onClick={() => setI((x) => (x + 1) % n)}
            >
              →
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
