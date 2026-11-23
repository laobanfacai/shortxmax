/** Only same-site relative navigation; never accept protocol-relative URLs. */
export function safePath(value: unknown, fallback = "/account"): string {
 if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return fallback;
 try { const parsed = new URL(value, "https://internal.invalid"); if (parsed.origin !== "https://internal.invalid") return fallback;
 if (/^\/(api|login|signup)(\/|\?|$)/.test(value)) return fallback; return parsed.pathname + parsed.search + parsed.hash; } catch { return fallback; }
}
