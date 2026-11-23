import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isAllowed, saveUpload } from "@/lib/storage";
import { sanitizeStudioText } from "@/lib/r2-studio";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "无权操作" }, { status: 403 });
  const form = await req.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") || "cover") === "video" ? "video" : "cover";
  const uploadId = String(form.get("uploadId") || "").trim() || undefined;
  const endpointId = String(form.get("endpointId") || "").trim() || undefined;
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请选择文件" }, { status: 400 });
  }
  if (!isAllowed(kind, file.name)) {
    return NextResponse.json({ error: "不支持的文件类型" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const url = await saveUpload({
      kind,
      originalName: file.name,
      buffer,
      uploadId,
      signal: req.signal,
      endpointId,
    });
    return NextResponse.json({ url, uploadId: uploadId || null });
  } catch (err) {
    const message = sanitizeStudioText(err instanceof Error ? err.message : "上传失败");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
