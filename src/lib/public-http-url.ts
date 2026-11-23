/** Reject private/loopback/non-http URLs before asking R2 Studio to fetch them. */

const PRIVATE_V4 = [
  [0, 0], // 0.0.0.0/8
  [10, 8],
  [127, 8],
  [169, 254, 16],
  [172, 16, 12], // 172.16.0.0/12
  [192, 168, 16],
  [100, 64, 10], // CGNAT
];

function ipv4ToInt(parts: number[]) {
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function isPrivateIPv4(host: string) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const parts = m.slice(1).map((n) => Number(n));
  if (parts.some((n) => n > 255)) return false;
  const ip = ipv4ToInt(parts);
  const rules: Array<[number, number]> = [
    [ipv4ToInt([0, 0, 0, 0]), 8],
    [ipv4ToInt([10, 0, 0, 0]), 8],
    [ipv4ToInt([127, 0, 0, 0]), 8],
    [ipv4ToInt([169, 254, 0, 0]), 16],
    [ipv4ToInt([172, 16, 0, 0]), 12],
    [ipv4ToInt([192, 168, 0, 0]), 16],
    [ipv4ToInt([100, 64, 0, 0]), 10],
  ];
  return rules.some(([net, bits]) => {
    const mask = bits === 0 ? 0 : (~((1 << (32 - bits)) - 1)) >>> 0;
    return (ip & mask) === (net & mask);
  });
}

function isPrivateHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".lan") ||
    host === "metadata.google.internal"
  ) {
    return true;
  }
  if (host === "::1" || host === "0:0:0:0:0:0:0:1") return true;
  if (host.includes(":")) {
    const h = host.toLowerCase();
    if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  }
  return isPrivateIPv4(host);
}

export function assertPublicHttpUrl(raw: string): { ok: true; url: string } | { ok: false; message: string } {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return { ok: false, message: "请填写要下载的视频链接。" };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, message: "链接格式不正确。" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, message: "只支持公开的 http(s) 链接。" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, message: "链接不能包含用户名或密码。" };
  }
  if (isPrivateHost(parsed.hostname)) {
    return { ok: false, message: "不能使用内网、本机或回环地址。请提供可公开访问的 http(s) 链接。" };
  }
  return { ok: true, url: parsed.toString() };
}

export function filenameFromUrl(raw: string) {
  try {
    const u = new URL(raw);
    const base = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() || "");
    if (base && /\.(mp4|webm|mov|m3u8)$/i.test(base)) return base;
    if (base) return base.endsWith(".mp4") ? base : `${base}.mp4`;
  } catch {
    /* ignore */
  }
  return "remote-video.mp4";
}
