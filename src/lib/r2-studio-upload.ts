/**
 * Chunked upload + remote fetch against R2 Studio (https://r2.open-traffic.com).
 *
 * The browser slices a file into parts and sends each part to this site; each
 * route streams the part straight through to R2 Studio. Nothing is buffered in
 * memory or written to local disk, so a file of any size costs the Node process
 * only one part in flight. The API key never reaches the browser.
 *
 * Scope: upload and fetch only. This module never changes R2 Studio's storage pool.
 */
import { randomBytes } from "crypto";
import path from "path";
import { resolveR2Studio, sanitizeStudioText, encodeObjectPath } from "./r2-studio";
import { assertPublicHttpUrl } from "./public-http-url";

/** Files up to this size go in one request; larger ones use multipart. */
export const SINGLE_MAX_BYTES = 8 * 1024 * 1024;
/** Part size we ask R2 Studio for (its limits are 5 MB to 90 MB). */
export const PART_SIZE_BYTES = 8 * 1024 * 1024;
/** Hard ceiling per incoming request body, a little above the part size. */
export const MAX_REQUEST_BYTES = 96 * 1024 * 1024;
/** Upper bound for one file. Override with UPLOAD_MAX_BYTES. */
export function maxFileBytes() {
  const v = Number(process.env.UPLOAD_MAX_BYTES || 0);
  return Number.isFinite(v) && v > 0 ? v : 20 * 1024 * 1024 * 1024;
}

export const KEY_ROOT = "lumereel/";
export const FETCH_PREFIX = "lumereel/videos";
const MP_ID_RE = /^mp-[a-f0-9]{4,64}$/;
const JOB_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const HEADER_NAME_RE = /^[A-Za-z0-9-]{1,64}$/;
const FORBIDDEN_FETCH_HEADERS = new Set(["host", "content-length", "connection", "transfer-encoding", "authorization", "cookie", "proxy-authorization"]);

export type UploadKind = "cover" | "video";

const EXT: Record<UploadKind, Record<string, string>> = {
  cover: { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" },
  video: { ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime" },
};

export class UploadError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function isMultipartId(id: string) {
  return MP_ID_RE.test(id);
}
export function isJobId(id: string) {
  return JOB_ID_RE.test(id);
}

export function checkFile(kind: UploadKind, filename: string, size: number) {
  const ext = path.extname(String(filename || "")).toLowerCase();
  const contentType = EXT[kind]?.[ext];
  if (!contentType) {
    const allowed = Object.keys(EXT[kind]).join(" / ");
    throw new UploadError(`不支持的文件类型，${kind === "video" ? "视频" : "封面"}只支持 ${allowed}`, 415);
  }
  if (!Number.isFinite(size) || size <= 0) throw new UploadError("文件大小无效", 400);
  if (size > maxFileBytes()) throw new UploadError(`文件太大，单个文件上限 ${(maxFileBytes() / 1024 ** 3).toFixed(0)} GB`, 413);
  return { ext, contentType };
}

export function newObjectKey(kind: UploadKind, ext: string) {
  const folder = kind === "video" ? "videos" : "covers";
  return `${KEY_ROOT}${folder}/${Date.now()}-${randomBytes(6).toString("hex")}${ext}`;
}

/** Magic-byte check on the first bytes of a file (sent by the browser before upload). */
export function sniffMatches(kind: UploadKind, ext: string, head: Uint8Array): boolean {
  if (!head.length) return true;
  const hex = Buffer.from(head.subarray(0, 16)).toString("hex");
  const ascii = Buffer.from(head.subarray(0, 16)).toString("latin1");
  if (kind === "cover") {
    if (ext === ".png") return hex.startsWith("89504e47");
    if (ext === ".webp") return ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
    return hex.startsWith("ffd8ff");
  }
  if (ext === ".webm") return hex.startsWith("1a45dfa3");
  // mp4 / mov: ISO-BMFF box at offset 4 (ftyp, or moov/mdat/wide/free for some .mov files)
  const box = ascii.slice(4, 8);
  return ["ftyp", "moov", "mdat", "wide", "free", "skip", "pnot"].includes(box);
}

async function studio() {
  const cfg = await resolveR2Studio();
  if (!cfg.keyConfigured || !cfg.apiKey || !cfg.enabled) {
    throw new UploadError("R2 Studio 还没配置好。请到「存储设置」填写 r2s_ Key 并测试连接。", 503);
  }
  return cfg;
}

type Json = Record<string, unknown>;

async function call(
  pathname: string,
  init: RequestInit & { duplex?: "half" },
): Promise<Json> {
  const cfg = await studio();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${cfg.apiKey}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}${pathname}`, { ...init, headers, cache: "no-store" } as RequestInit);
  } catch (err) {
    if (init.signal?.aborted) throw new UploadError("已取消", 499);
    throw new UploadError(`无法连接到 R2 Studio：${sanitizeStudioText(err instanceof Error ? err.message : String(err))}`, 502);
  }
  const text = await res.text();
  let data: Json = {};
  try {
    data = text ? (JSON.parse(text) as Json) : {};
  } catch {
    data = {};
  }
  if (!res.ok) {
    const e = (data.error && typeof data.error === "object" ? data.error : data) as Json;
    const raw = sanitizeStudioText(String(e.message || text || res.statusText)).slice(0, 300);
    if (res.status === 401 || res.status === 403) throw new UploadError("R2 Studio Key 无效或没有上传权限", 502);
    if (res.status === 507) throw new UploadError("R2 Studio 存储池已满，暂时无法写入", 507);
    if (res.status === 404) throw new UploadError(raw || "任务不存在或已结束", 404);
    throw new UploadError(raw || `R2 Studio 返回 HTTP ${res.status}`, res.status >= 500 ? 502 : 400);
  }
  return data;
}

function pickUrl(d: Json): string {
  return String(d.publicUrl || d.shortUrl || d.url || "");
}

/** Single request upload. The body is streamed through; X-File-Size lets Studio reserve space. */
export async function putSingle(opts: {
  key: string;
  contentType: string;
  size: number;
  body: ReadableStream<Uint8Array>;
  jobId: string;
  signal?: AbortSignal;
}) {
  const d = await call(`/api/v1/objects/${encodeObjectPath(opts.key)}`, {
    method: "PUT",
    headers: { "Content-Type": opts.contentType, "X-File-Size": String(opts.size), "X-Upload-Id": opts.jobId },
    body: opts.body,
    duplex: "half",
    signal: opts.signal,
  });
  const url = pickUrl(d);
  if (!url) throw new UploadError("上传完成，但 R2 Studio 没有返回访问地址", 502);
  return { url, key: String(d.key || opts.key) };
}

export type MultipartInfo = {
  id: string;
  key: string;
  size: number;
  partSize: number;
  partCount: number;
  done: number[];
  resumed: boolean;
};

function toInfo(d: Json): MultipartInfo {
  return {
    id: String(d.id || ""),
    key: String(d.key || ""),
    size: Number(d.size) || 0,
    partSize: Number(d.partSize) || 0,
    partCount: Number(d.partCount) || 0,
    done: Array.isArray(d.done) ? (d.done as unknown[]).map(Number).filter(Number.isFinite) : [],
    resumed: Boolean(d.resumed),
  };
}

export async function getMultipart(id: string): Promise<MultipartInfo> {
  if (!isMultipartId(id)) throw new UploadError("分片任务 ID 无效", 400);
  const info = toInfo(await call(`/api/v1/multipart/${encodeURIComponent(id)}`, { method: "GET" }));
  if (!info.key.startsWith(KEY_ROOT)) throw new UploadError("这个分片任务不属于本站", 403);
  return info;
}

export async function beginMultipart(opts: { key: string; size: number; contentType: string; fingerprint: string }) {
  const info = toInfo(
    await call("/api/v1/multipart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: opts.key,
        size: opts.size,
        contentType: opts.contentType,
        fingerprint: opts.fingerprint.slice(0, 300),
        partSize: PART_SIZE_BYTES,
      }),
    }),
  );
  if (!info.id || !info.partSize || !info.partCount) throw new UploadError("R2 Studio 没有返回分片计划", 502);
  return info;
}

export async function putPart(opts: { id: string; n: number; body: ReadableStream<Uint8Array>; length: number; signal?: AbortSignal }) {
  if (!isMultipartId(opts.id)) throw new UploadError("分片任务 ID 无效", 400);
  const headers: Record<string, string> = { "Content-Type": "application/octet-stream" };
  const d = await call(`/api/v1/multipart/${encodeURIComponent(opts.id)}/parts/${opts.n}`, {
    method: "PUT",
    headers,
    body: opts.body,
    duplex: "half",
    signal: opts.signal,
  });
  return { done: Number(d.done) || 0, partCount: Number(d.partCount) || 0 };
}

export async function completeMultipart(id: string) {
  await getMultipart(id);
  const d = await call(`/api/v1/multipart/${encodeURIComponent(id)}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const url = pickUrl(d);
  if (!url) throw new UploadError("分片已合并，但 R2 Studio 没有返回访问地址", 502);
  return { url, key: String(d.key || "") };
}

export async function abortMultipart(id: string) {
  await getMultipart(id);
  await call(`/api/v1/multipart/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Cancel a running single upload or fetch job by its job id. */
export async function cancelJob(id: string) {
  if (!isJobId(id)) throw new UploadError("任务 ID 无效", 400);
  await call(`/api/v1/uploads/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getJob(id: string): Promise<Json> {
  if (!isJobId(id)) throw new UploadError("任务 ID 无效", 400);
  return call(`/api/v1/uploads/${encodeURIComponent(id)}`, { method: "GET" });
}

export function cleanFetchHeaders(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  const entries = Object.entries(raw as Record<string, unknown>).filter(([k, v]) => String(k).trim() && String(v ?? "").trim());
  if (entries.length > 10) throw new UploadError("源站请求头最多 10 个", 400);
  for (const [k0, v0] of entries) {
    const k = String(k0).trim();
    const v = String(v0).trim();
    if (!HEADER_NAME_RE.test(k)) throw new UploadError(`请求头名称不合法：${k}`, 400);
    if (/[\r\n\0]/.test(v) || v.length > 8192) throw new UploadError(`请求头的值不合法：${k}`, 400);
    if (FORBIDDEN_FETCH_HEADERS.has(k.toLowerCase())) throw new UploadError(`不允许设置这个请求头：${k}`, 400);
    out[k] = v;
  }
  return out;
}

/** Ask R2 Studio to download a public URL into the bucket. Returns at once (202); progress comes over SSE. */
export async function startFetch(input: { url: string; name?: string; headers?: Record<string, string> }) {
  const checked = assertPublicHttpUrl(input.url);
  if (!checked.ok) throw new UploadError(checked.message, 400);
  const id = `f-${randomBytes(8).toString("hex")}`;
  const body: Json = { url: checked.url, prefix: FETCH_PREFIX, unique: true, id };
  const name = String(input.name || "").trim();
  if (name) {
    const ext = path.extname(name).toLowerCase();
    if (ext && !EXT.video[ext]) throw new UploadError("从链接导入只支持 mp4 / webm / mov 视频", 415);
    body.name = name.slice(0, 200);
  }
  if (input.headers && Object.keys(input.headers).length) body.headers = input.headers;
  const d = await call("/api/v1/fetch", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Upload-Id": id },
    body: JSON.stringify(body),
  });
  return { id: String(d.id || id), state: String(d.state || "queued"), publicUrl: pickUrl(d) || null };
}

export function errorResponse(err: unknown) {
  const status = err instanceof UploadError ? err.status : 500;
  const message = sanitizeStudioText(err instanceof Error ? err.message : "上传失败");
  return Response.json({ error: message }, { status: status === 499 ? 400 : status });
}
