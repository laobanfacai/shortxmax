import { requireAdmin } from "@/lib/auth";
import {
  SINGLE_MAX_BYTES,
  UploadError,
  beginMultipart,
  checkFile,
  errorResponse,
  getMultipart,
  isMultipartId,
  newObjectKey,
  sniffMatches,
  type UploadKind,
} from "@/lib/r2-studio-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/upload/multipart
 * { kind, filename, size, fingerprint, head (base64 first 16 bytes), resumeId? }
 * → { id, partSize, partCount, done: number[], resumed }
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "无权操作" }, { status: 403 });
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const kind: UploadKind = b.kind === "cover" ? "cover" : "video";
    const filename = String(b.filename || "");
    const size = Number(b.size);
    const { ext, contentType } = checkFile(kind, filename, size);
    if (size <= SINGLE_MAX_BYTES) throw new UploadError("小文件请直接上传，不需要分片", 400);
    if (!sniffMatches(kind, ext, Buffer.from(String(b.head || ""), "base64"))) {
      throw new UploadError("文件内容和扩展名不符，请确认这是真正的视频文件", 415);
    }
    const resumeId = String(b.resumeId || "");
    if (resumeId && isMultipartId(resumeId)) {
      try {
        const info = await getMultipart(resumeId);
        if (info.size === size) return Response.json({ ok: true, ...info, resumed: true });
      } catch {
        /* session gone or not ours: start a fresh one */
      }
    }
    const fingerprint = `${admin.id}|${String(b.fingerprint || "").slice(0, 200)}`;
    const info = await beginMultipart({ key: newObjectKey(kind, ext), size, contentType, fingerprint });
    return Response.json({ ok: true, ...info });
  } catch (err) {
    return errorResponse(err);
  }
}
