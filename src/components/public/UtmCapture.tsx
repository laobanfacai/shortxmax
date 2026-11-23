"use client";

import { useEffect } from "react";
import { UTM_COOKIE, hasUtm, parseUtmSearch } from "@/lib/utm";

export function UtmCapture() {
  useEffect(() => {
    const utm = parseUtmSearch(window.location.search);
    if (!hasUtm(utm)) return;
    const value = encodeURIComponent(JSON.stringify(utm));
    const maxAge = 60 * 60 * 24 * 30;
    document.cookie = `${UTM_COOKIE}=${value}; path=/; max-age=${maxAge}; samesite=lax`;
  }, []);
  return null;
}
