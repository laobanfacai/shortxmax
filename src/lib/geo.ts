const COUNTRY_ZH: Record<string, string> = {
  US: "美国",
  CN: "中国",
  HK: "中国香港",
  TW: "中国台湾",
  MO: "中国澳门",
  GB: "英国",
  UK: "英国",
  CA: "加拿大",
  AU: "澳大利亚",
  SG: "新加坡",
  MY: "马来西亚",
  PH: "菲律宾",
  ID: "印度尼西亚",
  IN: "印度",
  JP: "日本",
  KR: "韩国",
  DE: "德国",
  FR: "法国",
  BR: "巴西",
  MX: "墨西哥",
  NG: "尼日利亚",
  ZA: "南非",
  AE: "阿联酋",
  SA: "沙特阿拉伯",
  TH: "泰国",
  VN: "越南",
  T1: "未知",
};

export function countryFromHeaders(headers: Headers | { get(name: string): string | null }) {
  const raw = (
    headers.get("cf-ipcountry") ||
    headers.get("x-vercel-ip-country") ||
    headers.get("x-country-code") ||
    ""
  )
    .trim()
    .toUpperCase();
  if (!raw || raw === "XX" || raw === "T1") return "未知";
  return COUNTRY_ZH[raw] || raw;
}

export function displayCountry(codeOrName: string) {
  const v = (codeOrName || "").trim();
  if (!v) return "未知";
  const up = v.toUpperCase();
  return COUNTRY_ZH[up] || v;
}

export function sourceFromUtmAndReferrer(opts: {
  utmSource?: string | null;
  referrer?: string | null;
}) {
  const utm = (opts.utmSource || "").trim();
  if (utm) {
    const key = utm.toLowerCase();
    if (key.includes("facebook") || key === "fb" || key === "meta" || key === "ig" || key === "instagram") return "Meta / Facebook";
    if (key.includes("tiktok") || key === "tt") return "TikTok";
    if (key.includes("google") || key === "gads" || key === "adwords" || key === "youtube") return "Google";
    if (key === "twitter" || key === "x") return "X / Twitter";
    return utm;
  }
  const ref = (opts.referrer || "").trim();
  if (!ref) return "直接访问";
  try {
    const host = new URL(ref).hostname.replace(/^www\./, "");
    if (!host || host === "localhost" || host.endsWith("127.0.0.1")) return "直接访问";
    return host;
  } catch {
    return "直接访问";
  }
}
