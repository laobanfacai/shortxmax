"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function PageViewBeacon() {
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    if (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/api") ||
      pathname.startsWith("/uploads") ||
      pathname.startsWith("/_next")
    ) {
      return;
    }
    const payload = JSON.stringify({
      path: pathname + (search.toString() ? `?${search.toString()}` : ""),
      referrer: document.referrer || "",
    });
    const blob = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/collect", blob);
    } else {
      fetch("/api/collect", { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    }
  }, [pathname, search]);

  return null;
}
