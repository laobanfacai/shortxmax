import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { prisma } from "./prisma";
import { getSettings } from "./settings";
import {
  kindLabelFor,
  nodeDisabledReason,
  classifyUploadFailure,
  type AdminStorageNode,
  type AdminStorageUsage,
} from "./storage-capacity";

export function uploadRoot() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || "./uploads");
}

export function publicUploadRoot() {
  return path.resolve(/*turbopackIgnore: true*/ "./public/uploads");
}

const ALLOWED: Record<string, string[]> = {
  cover: [".jpg", ".jpeg", ".png", ".webp"],
  video: [".mp4", ".webm", ".mov", ".m3u8"],
};

export function isAllowed(kind: "cover" | "video", filename: string) {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED[kind].includes(ext);
}

function contentType(ext: string) {
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".m3u8") return "application/vnd.apple.mpegurl";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

/** Existing demo files already on disk are served as-is. Do not use this for new admin uploads. */
export async function saveLocal(rel: string, buffer: Buffer) {
  const dests = rel.startsWith("videos/") ? [path.join(uploadRoot(), rel)] : [path.join(uploadRoot(), rel), path.join(publicUploadRoot(), rel)];
  for (const dest of dests) {
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(/*turbopackIgnore: true*/ dest, buffer);
  }
  return `/uploads/${rel}`;
}

let rrCursor = 0;

function r2Client(ep: {
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
}) {
  return new S3Client({
    region: ep.region || "auto",
    endpoint: ep.endpoint,
    credentials: {
      accessKeyId: ep.accessKey,
      secretAccessKey: ep.secretKey,
    },
    forcePathStyle: true,
  });
}

function publicUrl(base: string, rel: string) {
  return `${base.replace(/\/$/, "")}/${rel}`;
}

async function uploadToR2(
  ep: {
    id: string;
    endpoint: string;
    region: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    publicBaseUrl: string;
  },
  rel: string,
  buffer: Buffer,
  ext: string,
) {
  const client = r2Client(ep);
  await client.send(
    new PutObjectCommand({
      Bucket: ep.bucket,
      Key: rel,
      Body: buffer,
      ContentType: contentType(ext),
    }),
  );
  await prisma.storageEndpoint.update({
    where: { id: ep.id },
    data: { lastError: "", lastOkAt: new Date() },
  });
  const base = ep.publicBaseUrl || `${ep.endpoint.replace(/\/$/, "")}/${ep.bucket}`;
  return publicUrl(base, rel);
}

export const R2_NOT_READY_MESSAGE =
  "尚未配置可用的 R2 Studio API Key。请到「存储设置」（/admin/storage）填写以 r2s_ 开头的 Key 并测试连接。新的封面和视频由 R2 Studio 写入它管理的存储池，不会保存到本机磁盘，也不会直传官方 R2 桶。";

export async function listReadyCloudflareNodes() {
  const nodes = await prisma.storageEndpoint.findMany({
    where: { isEnabled: true, provider: "r2" },
    orderBy: { sortOrder: "asc" },
  });
  return nodes.filter((n) => n.bucket && n.accessKey && n.secretKey && (n.endpoint || n.accountId));
}

export type UploadTarget = {
  target: "r2studio" | "r2" | "none";
  studioReady: boolean;
  r2Ready: boolean;
  r2NodeCount: number;
  preferred: "r2studio" | "r2";
  message?: string;
};

/** New uploads go only through R2 Studio. Official bucket records are never an upload target. Never local disk. */
export async function getUploadTarget(): Promise<UploadTarget> {
  const { resolveR2Studio } = await import("./r2-studio");
  const studio = await resolveR2Studio();
  const studioReady = Boolean(studio.keyConfigured && studio.enabled);
  if (studioReady) {
    return {
      target: "r2studio",
      studioReady: true,
      r2Ready: false,
      r2NodeCount: 0,
      preferred: "r2studio",
    };
  }
  return {
    target: "none",
    studioReady: false,
    r2Ready: false,
    r2NodeCount: 0,
    preferred: "r2studio",
    message: R2_NOT_READY_MESSAGE,
  };
}

export async function publicStorageStatus() {
  const { resolveR2Studio, toPublicStatus, getStudioPool } = await import("./r2-studio");
  const [cfg, target] = await Promise.all([resolveR2Studio(), getUploadTarget()]);
  const pool = target.studioReady ? await getStudioPool() : null;
  return {
    ...toPublicStatus(cfg),
    activeTarget: target.target,
    studioReady: target.studioReady,
    r2Ready: false,
    r2NodeCount: 0,
    ready: target.target !== "none",
    pool,
    message: target.message,
  };
}

async function uploadToReadyCloudflare(rel: string, buffer: Buffer, ext: string): Promise<string> {
  const ready = await listReadyCloudflareNodes();
  if (!ready.length) throw new Error("没有已启用的 Cloudflare R2 节点。");
  const weighted: typeof ready = [];
  for (const n of ready) {
    const w = Math.max(1, n.weight || 1);
    for (let i = 0; i < w; i++) weighted.push(n);
  }
  const start = rrCursor % weighted.length;
  rrCursor = (rrCursor + 1) % (weighted.length * 50 + 1);
  const tried = new Set<string>();
  const errors: string[] = [];
  for (let i = 0; i < weighted.length; i++) {
    const ep = weighted[(start + i) % weighted.length];
    if (tried.has(ep.id)) continue;
    tried.add(ep.id);
    try {
      return await uploadToR2({ ...ep, endpoint: r2EndpointFor(ep.accountId, ep.endpoint) }, rel, buffer, ext);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${ep.label}: ${msg}`);
      await prisma.storageEndpoint.update({
        where: { id: ep.id },
        data: { lastError: msg.slice(0, 500) },
      });
    }
  }
  throw new Error(errors.join("；") || "Cloudflare R2 上传失败");
}

/**
 * Upload entry point. New files go only to R2 Studio (small PUT or multipart).
 * Official bucket credentials and local disk are never used as a fallback.
 */
export async function saveUpload(opts: {
  kind: "cover" | "video";
  originalName: string;
  buffer: Buffer;
  uploadId?: string;
  signal?: AbortSignal;
  /** Ignored: uploads no longer pin to a direct StorageEndpoint. */
  endpointId?: string;
}) {
  const ext = path.extname(opts.originalName).toLowerCase() || (opts.kind === "video" ? ".mp4" : ".jpg");
  if (!isAllowed(opts.kind, "file" + ext)) {
    throw new Error("Unsupported file type");
  }

  const route = await getUploadTarget();
  if (route.target !== "r2studio" || !route.studioReady) {
    throw new Error(R2_NOT_READY_MESSAGE);
  }

  const { uploadToR2Studio, newUploadRel } = await import("./r2-studio");
  try {
    return await uploadToR2Studio({
      rel: newUploadRel(opts.kind, opts.originalName),
      buffer: opts.buffer,
      contentType: contentType(ext),
      uploadId: opts.uploadId,
      signal: opts.signal,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`上传到 R2 Studio 失败，文件没有写入本机磁盘，也没有改走官方桶直传。${msg}`.trim());
  }
}


export function r2EndpointFor(accountId: string, endpoint?: string | null) {
  const ep = (endpoint || "").trim();
  if (ep) return ep.replace(/\/$/, "");
  const id = (accountId || "").trim();
  if (id) return `https://${id}.r2.cloudflarestorage.com`;
  return "";
}

export async function testR2Connection(input: {
  accountId?: string;
  endpoint?: string;
  region?: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  publicBaseUrl?: string;
}): Promise<{ ok: boolean; message: string }> {
  const endpoint = r2EndpointFor(input.accountId || "", input.endpoint);
  const bucket = (input.bucket || "").trim();
  const accessKey = (input.accessKey || "").trim();
  const secretKey = (input.secretKey || "").trim();
  if (!bucket) return { ok: false, message: "请填写桶名。" };
  if (!accessKey || !secretKey) return { ok: false, message: "请填写 Access Key 和 Secret Key。" };
  if (!endpoint) return { ok: false, message: "请填写账户 ID（用于生成 Endpoint），或在高级设置中填写 Endpoint。" };

  const client = r2Client({
    endpoint,
    region: input.region || "auto",
    accessKey,
    secretKey,
  });
  const pub = (input.publicBaseUrl || "").trim();
  const extra = pub
    ? ` 公开地址已填写：${pub.replace(/\/$/, "")}。`
    : " 建议再填写公开访问地址或自定义域名，前台才能直接播放。";

  const failed = (err: unknown, fallback: string) => {
    const raw = sanitizeStorageError(err);
    const lower = raw.toLowerCase();
    let hint = raw || fallback;
    if (lower.includes("invalidaccesskeyid") || lower.includes("invalid access")) {
      hint = "Access Key 不正确，请重新复制 Access Key。";
    } else if (lower.includes("signaturedoesnotmatch") || lower.includes("signature") || lower.includes("invalidsecret")) {
      hint = "Secret Key 不正确，或复制时多了空格。请重新复制密钥。";
    } else if (lower.includes("nosuchbucket")) {
      hint = `找不到名为「${bucket}」的存储桶，请核对桶名，并确认令牌属于同一个账户。`;
    } else if (lower.includes("access denied") || lower.includes("forbidden") || lower.includes("not authorized") || lower.includes("explicit deny")) {
      hint = "权限不足。请确认密钥具备该桶的读取/列举权限。";
    } else if (
      lower.includes("xml parse") ||
      lower.includes("mismatched tag") ||
      lower.includes("deserialization") ||
      lower.includes("unexpected token") ||
      (lower.includes("<html") || lower.includes("<hr>") || lower.includes("</body>"))
    ) {
      hint = "Endpoint 返回了网页而非 S3 接口（常见原因是 403/网关页，或该地址未对当前机器开放）。";
    } else if (
      lower.includes("enotfound") ||
      lower.includes("econnrefused") ||
      lower.includes("econnreset") ||
      lower.includes("etimedout") ||
      lower.includes("timeout") ||
      lower.includes("networking") ||
      lower.includes("getaddrinfo") ||
      lower.includes("fetch failed") ||
      lower.includes("aggregateerror")
    ) {
      const isOfficialR2 = endpoint.includes("r2.cloudflarestorage.com");
      hint = isOfficialR2
        ? "无法连接到 Cloudflare R2 Endpoint。请确认网络可访问 r2.cloudflarestorage.com。"
        : `无法连接到 Endpoint（${endpoint}）。请确认地址可从当前机器访问。`;
    }
    return { ok: false as const, message: `连接失败：${hint}` };
  };

  const unimplemented = (err: unknown) => {
    const raw = sanitizeStorageError(err).toLowerCase();
    return raw.includes("notimplemented") || raw.includes("method not allowed") || raw.includes("not supported") || raw.includes("unknownoperation");
  };

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return { ok: true, message: `连接成功：已确认桶「${bucket}」可访问（HeadBucket）。${extra}` };
  } catch (headErr) {
    try {
      await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          MaxKeys: 1,
          Prefix: "_shortxmax_connection_test/",
        }),
      );
      return { ok: true, message: `连接成功：已确认桶「${bucket}」可列举（ListObjects）。${extra}` };
    } catch (listErr) {
      if (!unimplemented(headErr) && !unimplemented(listErr)) {
        // Prefer the more specific of the two real errors.
        return failed(listErr, failed(headErr, "无法访问该桶。").message);
      }
      const key = `_shortxmax_connection_test/${Date.now()}-${randomBytes(4).toString("hex")}.txt`;
      const body = Buffer.from("shortxmax-storage-ok", "utf8");
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: "text/plain",
          }),
        );
        await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        try {
          await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        } catch {
          // cleanup is best-effort; never delete anything outside this prefix
        }
        return { ok: true, message: `连接成功：已在桶「${bucket}」的测试前缀写入并读取后删除。${extra}` };
      } catch (putErr) {
        return failed(putErr, failed(listErr, "连接失败。").message);
      }
    }
  }
}

function sanitizeStorageError(err: unknown) {
  let raw = err instanceof Error ? err.message : String(err);
  // Never leak credentials or signed query strings if an SDK message includes them.
  raw = raw.replace(/AKIA[0-9A-Z]{8,}/gi, "[redacted]");
  raw = raw.replace(/[?&](X-Amz-Credential|X-Amz-Signature|Signature|AWSAccessKeyId)=[^&\s]+/gi, "");
  raw = raw.replace(/secret[^=\s]*[=:]\s*\S+/gi, "secret=[redacted]");
  return raw.slice(0, 400);
}


export async function uploadToPinnedEndpoint(
  endpointId: string,
  rel: string,
  buffer: Buffer,
  ext: string,
): Promise<string> {
  const id = String(endpointId || "").trim();
  if (!id) throw new Error("请选择一个存储配置。");
  const ep = await prisma.storageEndpoint.findUnique({ where: { id } });
  if (!ep) throw new Error("找不到所选的存储配置。");
  const hasCreds = Boolean(ep.bucket && ep.accessKey && ep.secretKey && (ep.endpoint || ep.accountId));
  const reason = nodeDisabledReason({
    isEnabled: ep.isEnabled,
    hasCreds,
    lastOkAt: ep.lastOkAt,
    lastError: ep.lastError,
  });
  if (!ep.isEnabled || !hasCreds) {
    throw new Error(reason || "所选存储配置不可用。");
  }
  try {
    return await uploadToR2({ ...ep, endpoint: r2EndpointFor(ep.accountId, ep.endpoint) }, rel, buffer, ext);
  } catch (err) {
    const classified = classifyUploadFailure(sanitizeStorageError(err));
    await prisma.storageEndpoint.update({
      where: { id: ep.id },
      data: { lastError: classified.slice(0, 500) },
    });
    throw new Error(`「${ep.label || "存储配置"}」上传失败：${classified}。已停止，没有改传到其他配置。`);
  }
}

const usageCache = new Map<string, { at: number; usage: AdminStorageUsage }>();
const USAGE_TTL_MS = 5 * 60 * 1000;

async function probeNodeUsage(ep: {
  id: string;
  accountId: string;
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
}): Promise<AdminStorageUsage | null> {
  const cached = usageCache.get(ep.id);
  if (cached && Date.now() - cached.at < USAGE_TTL_MS) return cached.usage;
  const endpoint = r2EndpointFor(ep.accountId, ep.endpoint);
  if (!endpoint || !ep.bucket || !ep.accessKey || !ep.secretKey) return null;
  const client = r2Client({
    endpoint,
    region: ep.region || "auto",
    accessKey: ep.accessKey,
    secretKey: ep.secretKey,
  });
  let used = 0;
  let token: string | undefined;
  let complete = true;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 4000);
  try {
    do {
      const res = await client.send(
        new ListObjectsV2Command({
          Bucket: ep.bucket,
          ContinuationToken: token,
          MaxKeys: 1000,
        }),
        { abortSignal: ac.signal },
      );
      for (const obj of res.Contents || []) used += Number(obj.Size || 0);
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
  } catch (err) {
    const aborted = err instanceof Error && (err.name === "AbortError" || /aborted/i.test(err.message));
    if (aborted && used > 0) complete = false;
    else return null;
  } finally {
    clearTimeout(timer);
  }
  const usage: AdminStorageUsage = {
    usedBytes: used,
    capacityBytes: null,
    remainingBytes: null,
    complete,
    checkedAt: new Date().toISOString(),
  };
  usageCache.set(ep.id, { at: Date.now(), usage });
  return usage;
}

/** Safe list for the admin picker: names, buckets, status, optional usage. Never includes keys. */
export async function listAdminStorageNodes(): Promise<{
  defaultNodeId: string;
  nodes: AdminStorageNode[];
}> {
  const rows = await prisma.storageEndpoint.findMany({ orderBy: { sortOrder: "asc" } });
  const ready = await listReadyCloudflareNodes();
  const defaultNodeId = ready[0]?.id || "";

  const usages = await Promise.all(
    rows.map(async (ep) => {
      const hasCreds = Boolean(ep.bucket && ep.accessKey && ep.secretKey && (ep.endpoint || ep.accountId));
      if (!hasCreds) return null;
      try {
        return await probeNodeUsage(ep);
      } catch {
        return null;
      }
    }),
  );

  const nodes: AdminStorageNode[] = rows.map((ep, i) => {
    const hasCreds = Boolean(ep.bucket && ep.accessKey && ep.secretKey && (ep.endpoint || ep.accountId));
    const lastError = (ep.lastError || "").trim();
    const disabledReason = nodeDisabledReason({
      isEnabled: ep.isEnabled,
      hasCreds,
      lastOkAt: ep.lastOkAt,
      lastError,
    });
    const selectable = Boolean(ep.isEnabled && hasCreds && ep.lastOkAt && !disabledReason);
    return {
      id: ep.id,
      label: ep.label || "未命名配置",
      provider: ep.provider,
      kindLabel: kindLabelFor(ep.provider),
      bucket: ep.bucket,
      isEnabled: ep.isEnabled,
      lastOkAt: ep.lastOkAt ? ep.lastOkAt.toISOString() : null,
      lastError,
      selectable,
      disabledReason,
      isDefault: ep.id === defaultNodeId,
      usage: usages[i],
    };
  });

  return { defaultNodeId, nodes };
}
