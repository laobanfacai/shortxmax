export const CATALOG_PAGE_SIZE = 40;
export const ADMIN_SHOW_PAGE_SIZE = 20;
export const SITEMAP_PAGE_SIZE = 4000;

export function parsePage(raw: string | undefined, last = 1_000_000): number {
  const n = Number.parseInt(raw || "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, last);
}

export function pageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / perPage));
}

export function clampPage(page: number, pages: number): number {
  return Math.min(Math.max(1, page), Math.max(1, pages));
}

export function queryHref(base: string, params: Record<string, string | undefined | null>, page?: number): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") q.set(k, v);
  }
  if (page && page > 1) q.set("page", String(page));
  else q.delete("page");
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
