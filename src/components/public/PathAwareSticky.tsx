"use client";

import { usePathname } from "next/navigation";
import type { PublicPromo } from "@/lib/promo";
import { StickyCta } from "./StickyCta";

const HIDE = ["/pricing", "/checkout", "/login", "/signup", "/account", "/legal", "/go"];

export function PathAwareSticky({
  hidden,
  promo,
}: {
  hidden?: boolean;
  promo: PublicPromo | null;
}) {
  const path = usePathname() || "/";
  const hide = hidden || HIDE.some((p) => path === p || path.startsWith(p + "/"));
  return <StickyCta hidden={hide} promo={promo} />;
}
