export type UtmSet = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
};

export const UTM_COOKIE = "lumereel_utm";

export function parseUtmSearch(search: string | URLSearchParams): UtmSet {
  const sp = typeof search === "string" ? new URLSearchParams(search) : search;
  const pick = (k: string) => sp.get(k)?.trim() || undefined;
  return {
    utmSource: pick("utm_source"),
    utmMedium: pick("utm_medium"),
    utmCampaign: pick("utm_campaign"),
    utmContent: pick("utm_content"),
    utmTerm: pick("utm_term"),
  };
}

export function hasUtm(u: UtmSet) {
  return Boolean(u.utmSource || u.utmMedium || u.utmCampaign || u.utmContent || u.utmTerm);
}

export function appendUtm(path: string, utm?: UtmSet | null) {
  if (!utm || !hasUtm(utm)) return path;
  const url = new URL(path, "http://local.invalid");
  if (utm.utmSource) url.searchParams.set("utm_source", utm.utmSource);
  if (utm.utmMedium) url.searchParams.set("utm_medium", utm.utmMedium);
  if (utm.utmCampaign) url.searchParams.set("utm_campaign", utm.utmCampaign);
  if (utm.utmContent) url.searchParams.set("utm_content", utm.utmContent);
  if (utm.utmTerm) url.searchParams.set("utm_term", utm.utmTerm);
  return url.pathname + url.search + url.hash;
}

export function utmFromCookieHeader(cookieHeader: string | null): UtmSet {
  if (!cookieHeader) return {};
  const match = cookieHeader.split(/;\s*/).find((c) => c.startsWith(`${UTM_COOKIE}=`));
  if (!match) return {};
  try {
    return JSON.parse(decodeURIComponent(match.slice(UTM_COOKIE.length + 1))) as UtmSet;
  } catch {
    return {};
  }
}
