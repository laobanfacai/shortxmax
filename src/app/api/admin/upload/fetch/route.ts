import { requireAdmin } from "@/lib/auth";
import { cleanFetchHeaders, errorResponse, startFetch } from "@/lib/r2-studio-upload";
import { filenameFromUrl } from "@/lib/public-http-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/upload/fetch  { url, name?, headers? }
 * R2 Studio downloads the URL server-side; returns at once with a job id (progress over SSE).
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "无权操作" }, { status: 403 });
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const url = String(b.url || "");
    const headers = cleanFetchHeaders(b.headers);
    const out = await startFetch({ url, name: String(b.name || filenameFromUrl(url) || ""), headers });
    return Response.json({ ok: true, ...out });
  } catch (err) {
    return errorResponse(err);
  }
}
