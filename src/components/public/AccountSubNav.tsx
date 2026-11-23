"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GlassCapsuleNav } from "@/components/ui/GlassCapsuleNav";

const items = [
  { href: "/account", key: "/account", label: "Overview" },
  { href: "/account/list", key: "/account/list", label: "My list" },
  { href: "/account/history", key: "/account/history", label: "History" },
  { href: "/account/settings", key: "/account/settings", label: "Settings" },
];

function accountKey(pathname: string): string | null {
  if (pathname === "/account") return "/account";
  if (pathname === "/account/list" || pathname.startsWith("/account/list/")) return "/account/list";
  if (pathname === "/account/history" || pathname.startsWith("/account/history/")) return "/account/history";
  if (pathname === "/account/settings" || pathname.startsWith("/account/settings/")) return "/account/settings";
  return null;
}

export function AccountSubNav() {
  const pathname = usePathname() || "/account";
  const activeKey = accountKey(pathname);

  return (
    <GlassCapsuleNav
      activeKey={activeKey}
      axis="x"
      className="flex flex-wrap items-center gap-1 py-2"
      aria-label="Account"
    >
      {items.map((item) => {
        const active = activeKey === item.key;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="glass-capsule-item inline-flex items-center text-sm text-ink/80 hover:text-gold-soft"
            data-capsule-active={active ? "true" : "false"}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </GlassCapsuleNav>
  );
}
