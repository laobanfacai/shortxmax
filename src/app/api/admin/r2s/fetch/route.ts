import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { sanitizeStudioText, startStudioFetch } from "@/lib/r2-studio";
import { filenameFromUrl } from "@/lib/public-http-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "无权操作" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as {
    url?: string;
    name?: string;
    prefix?: string;
    uploadId?: string;
  };
  const result = await startStudioFetch({
    url: String(body.url || ""),
    name: String(body.name || filenameFromUrl(String(body.url || "")) || "").trim() || undefined,
    prefix: String(body.prefix || "lumereel/videos"),
    uploadId: String(body.uploadId || "").trim() || undefined,
  });
  if (!result.ok) {
    return NextResponse.json({ error: sanitizeStudioText(result.message) }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    uploadId: result.uploadId,
    publicUrl: result.publicUrl || null,
    message: sanitizeStudioText(result.message),
  });
}
