import { requireAdmin } from "@/lib/auth";
import { completeMultipart, errorResponse } from "@/lib/r2-studio-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** POST /api/admin/upload/multipart/{id}/complete → { url } */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "无权操作" }, { status: 403 });
  try {
    const { id } = await ctx.params;
    const out = await completeMultipart(id);
    return Response.json({ ok: true, url: out.url, key: out.key });
  } catch (err) {
    return errorResponse(err);
  }
}
