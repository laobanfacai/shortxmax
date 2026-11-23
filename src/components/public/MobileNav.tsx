"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/session-token";
import { GlassCapsuleNav } from "@/components/ui/GlassCapsuleNav";

function mobileKey(pathname: string, authed: boolean): string | null {
  if (pathname === "/") return "/";
  if (pathname === "/shows" || pathname.startsWith("/shows/")) return "/shows";
  if (pathname === "/pricing" || pathname.startsWith("/pricing")) return "/pricing";
  if (authed && (pathname === "/account" || pathname.startsWith("/account/"))) return "/account";
  if (!authed && (pathname === "/login" || pathname.startsWith("/login") || pathname === "/signup" || pathname.startsWith("/signup"))) {
    return "/login";
  }
  return null;
}

export function MobileNav({ user }: { user: SessionUser | null }) {
  const pathname = usePathname() || "/";
  const items = [
    { href: "/", key: "/", label: "Home" },
    { href: "/shows", key: "/shows", label: "Browse" },
    { href: "/pricing", key: "/pricing", label: "VIP" },
    { href: user ? "/account" : "/login", key: user ? "/account" : "/login", label: user ? "Me" : "Sign in" },
  ];
  const activeKey = mobileKey(pathname, Boolean(user));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-bg/95 backdrop-blur-xl md:hidden"
      aria-label="Mobile"
    >
      <GlassCapsuleNav
        activeKey={activeKey}
        axis="x"
        className="block"
        as="div"
      >
        <ul className="grid grid-cols-4 px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          {items.map((item) => {
            const active = activeKey === item.key;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="glass-capsule-item flex w-full flex-col items-center gap-0.5 py-1 text-[11px] text-muted hover:text-gold-soft"
                  data-capsule-active={active ? "true" : "false"}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </GlassCapsuleNav>
    </nav>
  );
}
