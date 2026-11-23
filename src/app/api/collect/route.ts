import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UTM_COOKIE, parseUtmSearch, utmFromCookieHeader } from "@/lib/utm";
import { countryFromHeaders, sourceFromUtmAndReferrer } from "@/lib/geo";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  let path = String(body?.path || "").split("?")[0] || "/";
  if (!path.startsWith("/")) path = "/";
  if (path.startsWith("/admin") || path.startsWith("/api") || path.startsWith("/uploads") || path.startsWith("/_next")) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  path = path.slice(0, 240);
  const referrer = String(body?.referrer || req.headers.get("referer") || "").slice(0, 500);
  const cookie = req.headers.get("cookie");
  const urlUtm = parseUtmSearch(new URL(req.url).searchParams);
  // path may include query in body
  let utm = utmFromCookieHeader(cookie);
  const rawPath = String(body?.path || "");
  if (rawPath.includes("?")) {
    try {
      const q = new URLSearchParams(rawPath.split("?")[1] || "");
      const fromPath = parseUtmSearch(q);
      if (fromPath.utmSource) utm = fromPath;
    } catch { /* ignore */ }
  }
  if (!utm.utmSource && urlUtm.utmSource) utm = urlUtm;
  const source = sourceFromUtmAndReferrer({ utmSource: utm.utmSource, referrer });
  const country = countryFromHeaders(req.headers);
  await prisma.pageView.create({
    data: {
      path,
      source,
      utmSource: utm.utmSource || "",
      utmMedium: utm.utmMedium || "",
      utmCampaign: utm.utmCampaign || "",
      referrer,
      country,
    },
  });
  return NextResponse.json({ ok: true });
}
