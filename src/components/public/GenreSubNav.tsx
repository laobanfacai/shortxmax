"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GlassCapsuleNav } from "@/components/ui/GlassCapsuleNav";

export function GenreSubNav({ genres }: { genres: { slug: string; name: string }[] }) {
  const pathname = usePathname() || "/genres";
  const activeKey =
    pathname === "/genres"
      ? "/genres"
      : pathname.startsWith("/genres/")
        ? pathname
        : null;

  const items = [
    { href: "/genres", key: "/genres", label: "All tropes" },
    ...genres.map((g) => ({ href: `/genres/${g.slug}`, key: `/genres/${g.slug}`, label: g.name })),
  ];

  return (
    <div className="border-b border-white/5 bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <GlassCapsuleNav
          activeKey={activeKey}
          axis="x"
          className="no-scrollbar flex items-center gap-1 overflow-x-auto py-2"
          aria-label="Genres"
        >
          {items.map((item) => {
            const active = activeKey === item.key;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="glass-capsule-item inline-flex shrink-0 items-center text-sm text-ink/80 hover:text-gold-soft"
                data-capsule-active={active ? "true" : "false"}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </GlassCapsuleNav>
      </div>
    </div>
  );
}
