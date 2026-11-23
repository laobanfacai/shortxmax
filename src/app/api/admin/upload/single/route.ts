import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/auth";
import {
  SINGLE_MAX_BYTES,
  UploadError,
  checkFile,
  errorResponse,
  newObjectKey,
  putSingle,
  sniffMatches,
  type UploadKind,
} from "@/lib/r2-studio-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST /api/admin/upload/single?kind=cover|video&name=a.jpg&head=<base64 of first 16 bytes>  body: raw file (≤ 8 MB) */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "无权操作" }, { status: 403 });
  try {
    const q = new URL(req.url).searchParams;
    const kind: UploadKind = q.get("kind") === "video" ? "video" : "cover";
    const name = String(q.get("name") || "");
    const size = Number(req.headers.get("content-length") || -1);
    if (size > SINGLE_MAX_BYTES) throw new UploadError("单次上传过大，请走分片上传", 413);
    const { ext, contentType } = checkFile(kind, name, size);
    const head = Buffer.from(String(q.get("head") || ""), "base64");
    if (!sniffMatches(kind, ext, head)) throw new UploadError("文件内容和扩展名不符，请确认这是真正的" + (kind === "video" ? "视频" : "图片"), 415);
    if (!req.body) throw new UploadError("请求里没有文件内容", 400);
    const jobId = `u-${randomBytes(8).toString("hex")}`;
    const out = await putSingle({ key: newObjectKey(kind, ext), contentType, size, body: req.body, jobId, signal: req.signal });
    return Response.json({ ok: true, id: jobId, url: out.url, key: out.key });
  } catch (err) {
    return errorResponse(err);
  }
}
