import { createHash, randomBytes } from "crypto";
import path from "path";
import { getSettings } from "./settings";
import { assertPublicHttpUrl } from "./public-http-url";
import type { R2StudioMemberPublic } from "./r2-studio-types";

export const R2S_DEFAULT_BASE = "https://r2.open-traffic.com";
export const R2S_MULTIPART_THRESHOLD = 64 * 1024 * 1024;
const PART_SIZE = 8 * 1024 * 1024;
const KEY_PREFIX = "r2s_";

const PLACEHOLDER_KEYS = new Set([
  "r2s_你的key",
  "r2s_你的key",
  "r2s_yourkey",
  "r2s_your_key",
  "r2s_your-key",
  "r2s_...",
  "r2s_xxx",
  "r2s_example",
]);

export type { R2StudioPool, R2StudioPublicStatus } from "./r2-studio-types";
import type { R2StudioPool, R2StudioPublicStatus } from "./r2-studio-types";

export type R2StudioResolved = {
  baseUrl: string;
  apiKey: string;
  keyConfigured: boolean;
  keyFromEnv: boolean;
  enabled: boolean;
  storageMode: string;
  testedAt: Date | null;
  lastError: string;
};

/** Strip API keys and bearer tokens from any string that might be logged or shown. */
export function sanitizeStudioText(input: string): string {
  return input
    .replace(/r2s_[^\s"'\\]+/gi, "r2s_***")
    .replace(/Bearer\s+[^\s"'\\]+/gi, "Bearer ***")
    .replace(/access_token=[^&\s"'\\]+/gi, "access_token=***");
}

export function isPlaceholderKey(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  return PLACEHOLDER_KEYS.has(s.toLowerCase()) || PLACEHOLDER_KEYS.has(s);
}

export function validateApiKey(raw: string): { ok: true; key: string } | { ok: false; message: string } {
  const key = raw.trim();
  if (!key) return { ok: false, message: "请先填写 API Key（以 r2s_ 开头）。在 R2 Studio 创建一个带上传权限的 Key 后再试。" };
  if (isPlaceholderKey(key)) {
    return { ok: false, message: "这是文档里的占位符，不是真实密钥。请到 R2 Studio 创建 Key，并把完整值填到这里。" };
  }
  if (!key.startsWith(KEY_PREFIX) || key.length < 8) {
    return { ok: false, message: "API Key 格式不正确，应以 r2s_ 开头。请核对是否完整复制。" };
  }
  return { ok: true, key };
}

export function normalizeBaseUrl(raw: string | null | undefined): string {
  const s = (raw || "").trim().replace(/\/+$/, "");
  if (!s) return R2S_DEFAULT_BASE;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") return R2S_DEFAULT_BASE;
    return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, "")}`.replace(/\/$/, "");
  } catch {
    return R2S_DEFAULT_BASE;
  }
}

export async function resolveR2Studio(): Promise<R2StudioResolved> {
  const settings = await getSettings();
  const envKey = (process.env.R2_STUDIO_API_KEY || "").trim();
  const envBase = (process.env.R2_STUDIO_BASE_URL || "").trim();
  const apiKey = envKey || (settings.r2StudioApiKey || "").trim();
  const baseUrl = normalizeBaseUrl(envBase || settings.r2StudioBaseUrl || R2S_DEFAULT_BASE);
  const keyOk = validateApiKey(apiKey);
  const keyConfigured = keyOk.ok;
  // Website uploads always use R2 Studio. A leftover storageMode "r2" is not treated as a live channel.
  const storageMode = "r2studio";
  const enabled = keyConfigured && (Boolean(settings.r2StudioEnabled) || Boolean(envKey));
  return {
    baseUrl,
    apiKey: keyOk.ok ? keyOk.key : "",
    keyConfigured,
    keyFromEnv: Boolean(envKey),
    enabled,
    storageMode,
    testedAt: settings.r2StudioTestedAt,
    lastError: sanitizeStudioText(settings.r2StudioLastError || ""),
  };
}

export function toPublicStatus(cfg: R2StudioResolved): R2StudioPublicStatus {
  return {
    baseUrl: cfg.baseUrl,
    keyConfigured: cfg.keyConfigured,
    keyFromEnv: cfg.keyFromEnv,
    enabled: cfg.enabled,
    storageMode: cfg.storageMode,
    testedAt: cfg.testedAt ? cfg.testedAt.toISOString() : null,
    lastError: cfg.lastError,
  };
}

function studioHeaders(apiKey: string, extra?: HeadersInit): Headers {
  const h = new Headers(extra);
  h.set("Authorization", `Bearer ${apiKey}`);
  h.set("Accept", h.get("Accept") || "application/json");
  return h;
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  const clean = sanitizeStudioText(text).slice(0, 400);
  try {
    const j = JSON.parse(text) as { error?: string; message?: string };
    const msg = sanitizeStudioText(String(j.error || j.message || clean || res.statusText));
    return msg;
  } catch {
    return clean || res.statusText || `HTTP ${res.status}`;
  }
}

export async function testR2StudioConnection(input?: {
  baseUrl?: string;
  apiKey?: string;
}): Promise<{ ok: boolean; message: string; pool?: R2StudioPool }> {
  const saved = await resolveR2Studio();
  const baseUrl = normalizeBaseUrl(input?.baseUrl || saved.baseUrl);
  const keyRaw = (input?.apiKey || "").trim() || saved.apiKey;
  const checked = validateApiKey(keyRaw);
  if (!checked.ok) return { ok: false, message: checked.message };

  const url = `${baseUrl}/api/v1/pool?lite=1`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: studioHeaders(checked.key, { Accept: "application/json" }),
      cache: "no-store",
    });
    if (!res.ok) {
      const raw = await readErrorMessage(res);
      let hint = `连接失败（HTTP ${res.status}）：${raw}`;
      if (res.status === 401 || res.status === 403) {
        hint = "Key 无效或权限不足。请在 R2 Studio 重新创建带上传权限的 API Key，并确认完整复制。";
      } else if (res.status === 404) {
        hint = "找不到存储池接口，请检查 Base URL 是否为 R2 Studio 地址（默认 https://r2.open-traffic.com）。";
      } else if (res.status === 507) {
        hint = "存储池已满。测试已连通，但当前无法再写入。";
        return { ok: true, message: hint };
      }
      return { ok: false, message: hint };
    }
    const pool = (await res.json().catch(() => ({}))) as R2StudioPool;
    const used = typeof pool.totalUsed === "number" ? formatBytes(pool.totalUsed) : null;
    const cap = typeof pool.totalCapacity === "number" ? formatBytes(pool.totalCapacity) : null;
    const usage = used && cap ? `当前用量 ${used} / ${cap}。` : "已读取存储池信息。";
    return { ok: true, message: `连接成功。${usage}测试只做了只读查询，没有写入或删除任何文件。`, pool };
  } catch (err) {
    const raw = sanitizeStudioText(err instanceof Error ? err.message : String(err));
    const lower = raw.toLowerCase();
    if (lower.includes("enotfound") || lower.includes("getaddrinfo") || lower.includes("fetch failed") || lower.includes("network") || lower.includes("econnrefused") || lower.includes("certificate") || lower.includes("ssl") || lower.includes("tls")) {
      return { ok: false, message: `无法连接到 ${baseUrl}。请检查 Base URL 是否正确，以及这台服务器能否访问该地址。` };
    }
    return { ok: false, message: `连接失败：${raw}` };
  }
}

export function encodeObjectPath(rel: string): string {
  return rel
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const digits = i === 0 ? 0 : v >= 10 ? 1 : 2;
  return `${v.toFixed(digits)} ${units[i]}`;
}

export function formatSpeed(bps: number): string {
  if (!Number.isFinite(bps) || bps < 0) return "—";
  return `${formatBytes(bps)}/s`;
}

export function formatEta(seconds: number): string {
  if (seconds == null || seconds < 0 || !Number.isFinite(seconds)) return "未知";
  const s = Math.round(seconds);
  if (s < 60) return `约 ${s} 秒`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r ? `约 ${m} 分 ${r} 秒` : `约 ${m} 分钟`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `约 ${h} 小时 ${mm} 分`;
}

async function studioJson(
  cfg: { baseUrl: string; apiKey: string },
  pathname: string,
  init: RequestInit,
): Promise<{ ok: true; data: Record<string, unknown>; status: number } | { ok: false; status: number; message: string }> {
  const res = await fetch(`${cfg.baseUrl}${pathname}`, {
    ...init,
    headers: studioHeaders(cfg.apiKey, init.headers),
    cache: "no-store",
    // @ts-expect-error duplex is required in Node when sending a streamed body; harmless otherwise
    duplex: init.body ? "half" : undefined,
  });
  if (!res.ok) {
    const raw = await readErrorMessage(res);
    let message = `上传失败（HTTP ${res.status}）：${raw}`;
    if (res.status === 507) message = "存储池已满，无法上传。请在 R2 Studio 扩容或清理后再试。";
    if (res.status === 401 || res.status === 403) message = "Key 无效或没有上传权限。请在 R2 Studio 创建带上传权限的 Key。";
    return { ok: false, status: res.status, message };
  }
  const text = await res.text();
  if (!text) return { ok: true, data: {}, status: res.status };
  try {
    return { ok: true, data: JSON.parse(text) as Record<string, unknown>, status: res.status };
  } catch {
    return { ok: true, data: {}, status: res.status };
  }
}

function pickUrl(data: Record<string, unknown>): string {
  const publicUrl = typeof data.publicUrl === "string" ? data.publicUrl : "";
  const shortUrl = typeof data.shortUrl === "string" ? data.shortUrl : "";
  return publicUrl || shortUrl;
}

export async function uploadToR2Studio(opts: {
  rel: string;
  buffer: Buffer;
  contentType: string;
  uploadId?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const cfg = await resolveR2Studio();
  if (!cfg.keyConfigured || !cfg.apiKey) {
    throw new Error("尚未配置可用的 R2 Studio API Key。请到「存储设置」（/admin/storage）填写 Key 并测试连接。新文件不会保存到本机磁盘。");
  }
  const uploadId = opts.uploadId || `job-${randomBytes(8).toString("hex")}`;
  const encoded = encodeObjectPath(opts.rel);

  if (opts.buffer.length > R2S_MULTIPART_THRESHOLD) {
    return uploadMultipart(cfg, { ...opts, uploadId, encoded });
  }

  const put = await studioJson(cfg, `/api/v1/objects/${encoded}`, {
    method: "PUT",
    headers: {
      "Content-Type": opts.contentType,
      "X-Upload-Id": uploadId,
    },
    body: new Uint8Array(opts.buffer),
    signal: opts.signal,
  });
  if (!put.ok) throw new Error(put.message);
  const url = pickUrl(put.data);
  if (!url) throw new Error("上传已完成，但接口没有返回 publicUrl 或 shortUrl，无法写入前台地址。");
  return url;
}

async function uploadMultipart(
  cfg: { baseUrl: string; apiKey: string },
  opts: { rel: string; buffer: Buffer; contentType: string; uploadId: string; encoded: string; signal?: AbortSignal },
): Promise<string> {
  const fingerprint = createHash("sha256").update(opts.buffer).digest("hex");
  const started = await studioJson(cfg, "/api/v1/multipart", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Upload-Id": opts.uploadId },
    body: JSON.stringify({ key: opts.rel, size: opts.buffer.length, fingerprint, partSize: PART_SIZE, contentType: opts.contentType }),
    signal: opts.signal,
  });
  if (!started.ok) throw new Error(started.message);
  const mid = String(started.data.id || started.data.uploadId || started.data.multipartId || "");
  if (!mid) throw new Error("分片上传初始化失败：接口没有返回分片任务 ID。");

  // R2 Studio decides the final part size (5–90 MB); every part must match it exactly.
  const partSize = Number(started.data.partSize) || PART_SIZE;
  const total = Number(started.data.partCount) || Math.ceil(opts.buffer.length / partSize);
  const abort = () =>
    fetch(`${cfg.baseUrl}/api/v1/multipart/${encodeURIComponent(mid)}`, {
      method: "DELETE",
      headers: studioHeaders(cfg.apiKey),
      cache: "no-store",
    }).catch(() => null);
  try {
  for (let n = 1; n <= total; n += 1) {
    if (opts.signal?.aborted) throw new Error("上传已取消");
    const chunk = opts.buffer.subarray((n - 1) * partSize, n * partSize);
    const part = await studioJson(cfg, `/api/v1/multipart/${encodeURIComponent(mid)}/parts/${n}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Upload-Id": opts.uploadId,
      },
      body: new Uint8Array(chunk),
      signal: opts.signal,
    });
    if (!part.ok) throw new Error(`分片 ${n}/${total} 失败：${part.message}`);
  }
  } catch (err) {
    await abort();
    throw err;
  }

  const done = await studioJson(cfg, `/api/v1/multipart/${encodeURIComponent(mid)}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Upload-Id": opts.uploadId },
    body: JSON.stringify({}),
    signal: opts.signal,
  });
  if (!done.ok) throw new Error(done.message);
  const url = pickUrl(done.data);
  if (!url) throw new Error("分片已合并，但接口没有返回 publicUrl 或 shortUrl，无法写入前台地址。");
  return url;
}

export async function cancelR2StudioUpload(uploadId: string): Promise<{ ok: boolean; message: string }> {
  const cfg = await resolveR2Studio();
  if (!cfg.keyConfigured || !cfg.apiKey) {
    return { ok: false, message: "未配置 API Key，没有可取消的远程上传。" };
  }
  const id = uploadId.trim();
  if (!id) return { ok: false, message: "缺少上传任务 ID。" };
  try {
    const res = await fetch(`${cfg.baseUrl}/api/v1/uploads/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: studioHeaders(cfg.apiKey),
      cache: "no-store",
    });
    if (!res.ok && res.status !== 404) {
      return { ok: false, message: sanitizeStudioText(await readErrorMessage(res)) };
    }
    return { ok: true, message: "已请求取消上传。" };
  } catch (err) {
    return { ok: false, message: sanitizeStudioText(err instanceof Error ? err.message : String(err)) };
  }
}

export async function openStudioEventStream(
  pathname: string,
  signal?: AbortSignal,
): Promise<{ ok: true; response: Response } | { ok: false; status: number; message: string }> {
  const cfg = await resolveR2Studio();
  if (!cfg.keyConfigured || !cfg.apiKey) {
    return { ok: false, status: 400, message: "未配置 API Key，无法订阅实时事件。请先填写 Key 并测试连接。" };
  }
  try {
    const res = await fetch(`${cfg.baseUrl}${pathname}`, {
      method: "GET",
      headers: studioHeaders(cfg.apiKey, { Accept: "text/event-stream" }),
      cache: "no-store",
      signal,
    });
    if (!res.ok || !res.body) {
      const message = res.ok
        ? "R2 Studio 没有返回事件流。"
        : sanitizeStudioText(await readErrorMessage(res));
      const hint =
        res.status === 401 || res.status === 403
          ? "Key 无效或权限不足，无法订阅进度事件。"
          : message || `订阅失败（HTTP ${res.status}）`;
      return { ok: false, status: res.ok ? 502 : res.status, message: hint };
    }
    return { ok: true, response: res };
  } catch (err) {
    if (signal?.aborted) return { ok: false, status: 499, message: "已取消" };
    return {
      ok: false,
      status: 502,
      message: `无法连接到 R2 Studio 事件流：${sanitizeStudioText(err instanceof Error ? err.message : String(err))}`,
    };
  }
}

export function sseProxyHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}

export function newUploadRel(kind: "cover" | "video", originalName: string): string {
  const ext = path.extname(originalName).toLowerCase() || (kind === "video" ? ".mp4" : ".jpg");
  const folder = kind === "video" ? "videos" : "covers";
  const name = `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`;
  return `lumereel/${folder}/${name}`;
}

export function sanitizeStudioPool(raw: unknown): import("./r2-studio-types").R2StudioPool | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const membersIn = Array.isArray(o.members) ? o.members : [];
  const members: R2StudioMemberPublic[] = [];
  for (const item of membersIn) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const name = String(m.name || m.accountName || m.label || m.account || m.email || "成员").slice(0, 80);
    if (/r2s_|secret|accessKey|apiToken/i.test(name)) continue;
    members.push({
      name,
      usedBytes: num(m.usedBytes ?? m.used ?? m.totalUsed),
      capacityBytes: num(m.capacityBytes ?? m.capacity ?? m.totalCapacity),
    });
  }
  const target = o.target;
  return {
    totalUsed: num(o.totalUsed ?? o.used),
    totalCapacity: num(o.totalCapacity ?? o.capacity),
    target: typeof target === "string" || typeof target === "number" ? target : undefined,
    members: members.length ? members : undefined,
  };
}

export async function getStudioPool(): Promise<import("./r2-studio-types").R2StudioPool | null> {
  const cfg = await resolveR2Studio();
  if (!cfg.keyConfigured || !cfg.apiKey) return null;
  try {
    const res = await fetch(`${cfg.baseUrl}/api/v1/pool?lite=1`, {
      method: "GET",
      headers: studioHeaders(cfg.apiKey, { Accept: "application/json" }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return sanitizeStudioPool(await res.json().catch(() => null));
  } catch {
    return null;
  }
}

export async function startStudioFetch(input: {
  url: string;
  name?: string;
  prefix?: string;
  uploadId?: string;
}): Promise<{ ok: boolean; uploadId?: string; publicUrl?: string; message: string }> {
  const checked = assertPublicHttpUrl(input.url);
  if (!checked.ok) return checked;
  const cfg = await resolveR2Studio();
  if (!cfg.keyConfigured || !cfg.apiKey) {
    return { ok: false, message: "尚未配置可用的 R2 Studio API Key。请到「存储设置」填写 Key 并测试连接。" };
  }
  const uploadId = (input.uploadId || `job-${randomBytes(8).toString("hex")}`).trim();
  const body: Record<string, unknown> = {
    url: checked.url,
    prefix: (input.prefix || "lumereel/videos").replace(/^\/+|\/+$/g, ""),
    unique: true,
    id: uploadId,
  };
  const name = (input.name || "").trim();
  if (name) body.name = name;
  try {
    const res = await fetch(`${cfg.baseUrl}/api/v1/fetch`, {
      method: "POST",
      headers: studioHeaders(cfg.apiKey, {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Upload-Id": uploadId,
      }),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      data = {};
    }
    if (!res.ok && res.status !== 202) {
      const raw = sanitizeStudioText(String((data as { error?: { message?: string } }).error?.message || (data as { message?: string }).message || text || res.statusText));
      let message = `无法开始下载（HTTP ${res.status}）：${raw.slice(0, 300)}`;
      if (res.status === 400) message = raw.slice(0, 300) || "链接不被接受。请使用可公开访问的 http(s) 地址。";
      if (res.status === 401 || res.status === 403) message = "Key 无效或没有上传权限。请在「存储设置」重新填写 r2s_ Key 并测试连接。";
      if (res.status === 507) message = "存储池已满，无法从链接写入。";
      return { ok: false, message };
    }
    const job = (data.job && typeof data.job === "object" ? data.job : data) as Record<string, unknown>;
    const id = String(job.id || job.uploadId || data.id || data.uploadId || uploadId);
    const publicUrl = pickUrl(job) || pickUrl(data);
    return {
      ok: true,
      uploadId: id,
      publicUrl: publicUrl || undefined,
      message: publicUrl ? "已完成下载并写入存储桶。" : "已开始从链接下载到存储桶。",
    };
  } catch (err) {
    return { ok: false, message: `无法连接到 R2 Studio：${sanitizeStudioText(err instanceof Error ? err.message : String(err))}` };
  }
}

export async function getStudioUpload(id: string): Promise<{
  ok: boolean;
  message: string;
  state?: string;
  phase?: string;
  percent?: number;
  speed?: number;
  eta?: number;
  publicUrl?: string;
  error?: string;
}> {
  const cfg = await resolveR2Studio();
  if (!cfg.keyConfigured || !cfg.apiKey) {
    return { ok: false, message: "未配置 API Key。" };
  }
  const uploadId = id.trim();
  if (!uploadId) return { ok: false, message: "缺少上传任务 ID。" };
  try {
    const res = await fetch(`${cfg.baseUrl}/api/v1/uploads/${encodeURIComponent(uploadId)}`, {
      method: "GET",
      headers: studioHeaders(cfg.apiKey, { Accept: "application/json" }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return { ok: false, message: sanitizeStudioText(String((data as { message?: string }).message || res.statusText || `HTTP ${res.status}`)) };
    }
    const publicUrl = pickUrl(data);
    return {
      ok: true,
      message: "ok",
      state: typeof data.state === "string" ? data.state : undefined,
      phase: typeof data.phase === "string" ? data.phase : typeof data.fetchPhase === "string" ? data.fetchPhase : undefined,
      percent: typeof data.percent === "number" ? data.percent : undefined,
      speed: typeof data.speed === "number" ? data.speed : undefined,
      eta: typeof data.eta === "number" ? data.eta : undefined,
      publicUrl: publicUrl || undefined,
      error: typeof data.error === "string" ? sanitizeStudioText(data.error) : undefined,
    };
  } catch (err) {
    return { ok: false, message: sanitizeStudioText(err instanceof Error ? err.message : String(err)) };
  }
}
