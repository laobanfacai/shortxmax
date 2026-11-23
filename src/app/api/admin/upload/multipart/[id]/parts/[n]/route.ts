import { requireAdmin } from "@/lib/auth";
import { MAX_REQUEST_BYTES, UploadError, errorResponse, putPart } from "@/lib/r2-studio-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** PUT /api/admin/upload/multipart/{id}/parts/{n}  body: raw bytes of part n, streamed to R2 Studio. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string; n: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "无权操作" }, { status: 403 });
  try {
    const { id, n: nRaw } = await ctx.params;
    const n = Number(nRaw);
    if (!Number.isInteger(n) || n < 1 || n > 10000) throw new UploadError("分片编号无效", 400);
    const length = Number(req.headers.get("content-length") || -1);
    if (length < 0) throw new UploadError("需要 Content-Length", 411);
    if (length > MAX_REQUEST_BYTES) throw new UploadError("分片过大", 413);
    if (!req.body) throw new UploadError("请求里没有分片内容", 400);
    const out = await putPart({ id, n, body: req.body, length, signal: req.signal });
    return Response.json({ ok: true, n, ...out });
  } catch (err) {
    return errorResponse(err);
  }
}
