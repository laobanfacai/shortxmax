import { requireAdmin } from "@/lib/auth";
import { openStudioEventStream, sseProxyHeaders, sanitizeStudioText } from "@/lib/r2-studio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return new Response(JSON.stringify({ error: "无权操作" }), { status: 403, headers: { "Content-Type": "application/json" } });
  const { id } = await ctx.params;
  if (!id) return new Response(JSON.stringify({ error: "缺少上传任务 ID" }), { status: 400, headers: { "Content-Type": "application/json" } });
  const upstream = await openStudioEventStream(`/api/v1/uploads/${encodeURIComponent(id)}/events`, req.signal);
  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: sanitizeStudioText(upstream.message) }), {
      status: upstream.status === 499 ? 400 : upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(upstream.response.body, { headers: sseProxyHeaders() });
}
