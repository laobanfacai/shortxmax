import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { cancelR2StudioUpload, getStudioUpload, sanitizeStudioText } from "@/lib/r2-studio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "无权操作" }, { status: 403 });
  const { id } = await ctx.params;
  const result = await cancelR2StudioUpload(id);
  return NextResponse.json(
    { ok: result.ok, message: sanitizeStudioText(result.message) },
    { status: result.ok ? 200 : 400 },
  );
}


export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "无权操作" }, { status: 403 });
  const { id } = await ctx.params;
  const result = await getStudioUpload(id);
  if (!result.ok) {
    return NextResponse.json({ error: sanitizeStudioText(result.message) }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    state: result.state || null,
    phase: result.phase || null,
    percent: result.percent ?? null,
    speed: result.speed ?? null,
    eta: result.eta ?? null,
    publicUrl: result.publicUrl || null,
    error: result.error ? sanitizeStudioText(result.error) : null,
  });
}
