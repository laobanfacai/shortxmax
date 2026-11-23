import { requireAdmin } from "@/lib/auth";
import { abortMultipart, errorResponse } from "@/lib/r2-studio-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DELETE /api/admin/upload/multipart/{id}: abort, frees the remote parts and reserved space. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "无权操作" }, { status: 403 });
  try {
    const { id } = await ctx.params;
    await abortMultipart(id);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
