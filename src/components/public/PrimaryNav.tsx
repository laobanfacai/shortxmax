"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GlassCapsuleNav } from "@/components/ui/GlassCapsuleNav";

const links = [
  { href: "/shows", label: "Browse", key: "/shows" },
  { href: "/pricing", label: "VIP", key: "/pricing" },
  { href: "/about", label: "About", key: "/about" },
];

function primaryKey(pathname: string): string | null {
  if (pathname === "/shows" || pathname.startsWith("/shows/")) return "/shows";
  if (pathname === "/pricing" || pathname.startsWith("/pricing")) return "/pricing";
  if (pathname === "/about" || pathname.startsWith("/about")) return "/about";
  if (pathname === "/genres" || pathname.startsWith("/genres/")) return "/genres";
  return null;
}

const itemClass =
  "glass-capsule-item inline-flex items-center text-sm text-ink/80 hover:text-gold-soft";

export function PrimaryNav({ genres }: { genres: { slug: string; name: string }[] }) {
  const pathname = usePathname() || "/";
  const activeKey = primaryKey(pathname);
  const genresActive = activeKey === "/genres";

  return (
    <GlassCapsuleNav
      activeKey={activeKey}
      axis="x"
      className="hidden items-center gap-1 md:flex"
      aria-label="Primary"
    >
      {links.map((l) => {
        const active = activeKey === l.key;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={itemClass}
            data-capsule-active={active ? "true" : "false"}
            aria-current={active ? "page" : undefined}
          >
            {l.label}
          </Link>
        );
      })}
      <div className="group relative">
        <button
          className={itemClass}
          type="button"
          data-capsule-active={genresActive ? "true" : "false"}
          aria-current={genresActive ? "page" : undefined}
          aria-haspopup="true"
        >
          Genres
        </button>
        <div className="invisible absolute left-0 top-full z-30 min-w-56 pt-3 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
          <div className="rounded-xl border border-white/10 bg-surface p-2 shadow-2xl">
            <Link href="/genres" className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/5">
              All tropes
            </Link>
            {genres.map((g) => (
              <Link
                key={g.slug}
                href={`/genres/${g.slug}`}
                className="block rounded-lg px-3 py-2 text-sm hover:bg-white/5"
              >
                {g.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </GlassCapsuleNav>
  );
}
