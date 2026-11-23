import { requireAdmin } from "@/lib/auth";
import { openStudioEventStream, sseProxyHeaders, sanitizeStudioText } from "@/lib/r2-studio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return new Response(JSON.stringify({ error: "无权操作" }), { status: 403, headers: { "Content-Type": "application/json" } });
  const upstream = await openStudioEventStream("/api/v1/events", req.signal);
  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: sanitizeStudioText(upstream.message) }), {
      status: upstream.status === 499 ? 400 : upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(upstream.response.body, { headers: sseProxyHeaders() });
}
