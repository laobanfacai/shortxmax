"use client";

import { useState } from "react";

export function SafeCover({
  src,
  alt,
  className = "h-full w-full object-cover",
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#2a2438] to-[#16121f] text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <span className="px-2 text-[11px] font-medium uppercase tracking-wider text-white/55">Cover unavailable</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />
  );
}
