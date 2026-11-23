#!/usr/bin/env node
"use strict";

/**
 * Import R2 Studio / official R2 / Garage profiles into StorageEndpoint,
 * test each node, and switch the default upload channel to official R2
 * when at least one Cloudflare R2 node is ready.
 *
 * Usage:
 *   STORAGE_PROFILES_JSON=/path/to/profiles.json node scripts/import-storage-profiles.cjs
 *
 * Never prints access keys, secrets, api tokens, or account IDs.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
const {
  S3Client,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

function die(message) {
  console.error(message);
  process.exit(1);
}

function sanitizeError(err) {
  let raw = err instanceof Error ? err.message : String(err);
  raw = raw.replace(/AKIA[0-9A-Z]{8,}/gi, "[redacted]");
  raw = raw.replace(/[?&](X-Amz-Credential|X-Amz-Signature|Signature|AWSAccessKeyId)=[^\s&]+/gi, "");
  raw = raw.replace(/secret[^=\s]*[=:]\s*\S+/gi, "secret=[redacted]");
  return raw.slice(0, 400);
}

function r2EndpointFor(accountId, endpoint) {
  const custom = String(endpoint || "").trim();
  if (custom) return custom.replace(/\/$/, "");
  const id = String(accountId || "").trim();
  if (id) return "https://" + id + ".r2.cloudflarestorage.com";
  return "";
}

function classifyProvider(profile) {
  const endpoint = String(profile.endpoint || "").trim();
  if (endpoint && !endpoint.includes("r2.cloudflarestorage.com")) return "garage";
  return "r2";
}

function s3Client(input) {
  return new S3Client({
    region: input.region || "auto",
    endpoint: input.endpoint,
    credentials: {
      accessKeyId: input.accessKey,
      secretAccessKey: input.secretKey,
    },
    forcePathStyle: true,
  });
}

function withTimeout(ms) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  return { signal: ac.signal, done: () => clearTimeout(timer) };
}

async function testConnection(input) {
  const endpoint = r2EndpointFor(input.accountId || "", input.endpoint);
  const bucket = String(input.bucket || "").trim();
  const accessKey = String(input.accessKey || "").trim();
  const secretKey = String(input.secretKey || "").trim();
  if (!bucket) return { ok: false, message: "请填写桶名。" };
  if (!accessKey || !secretKey) return { ok: false, message: "请填写 Access Key 和 Secret Key。" };
  if (!endpoint) return { ok: false, message: "请填写账户 ID（用于生成 Endpoint），或填写自定义 Endpoint。" };

  const client = s3Client({
    endpoint,
    region: input.region || "auto",
    accessKey,
    secretKey,
  });
  const pub = String(input.publicBaseUrl || "").trim();
  const extra = pub
    ? " 公开地址已填写：" + pub.replace(/\/$/, "") + "。"
    : " 建议再填写公开访问地址或自定义域名，前台才能直接播放。";

  const failed = (err, fallback) => {
    const raw = sanitizeError(err);
    const lower = raw.toLowerCase();
    let hint = raw || fallback;
    if (lower.includes("invalidaccesskeyid") || lower.includes("invalid access")) {
      hint = "Access Key 不正确，请重新复制 Access Key。";
    } else if (lower.includes("signaturedoesnotmatch") || lower.includes("signature") || lower.includes("invalidsecret")) {
      hint = "Secret Key 不正确，或复制时多了空格。请重新复制密钥。";
    } else if (lower.includes("nosuchbucket")) {
      hint = "找不到名为「" + bucket + "」的存储桶，请核对桶名，并确认令牌属于同一个账户。";
    } else if (
      lower.includes("access denied") ||
      lower.includes("forbidden") ||
      lower.includes("not authorized") ||
      lower.includes("explicit deny")
    ) {
      hint = "权限不足。请确认密钥具备该桶的读取/列举权限。";
    } else if (
      lower.includes("xml parse") ||
      lower.includes("mismatched tag") ||
      lower.includes("deserialization") ||
      lower.includes("unexpected token") ||
      lower.includes("<html") ||
      lower.includes("<hr>") ||
      lower.includes("</body>")
    ) {
      hint = "Endpoint 返回了网页而非 S3 接口（常见原因是 403/网关页，或该地址未对当前机器开放）。";
    } else if (
      lower.includes("enotfound") ||
      lower.includes("econnrefused") ||
      lower.includes("econnreset") ||
      lower.includes("etimedout") ||
      lower.includes("timeout") ||
      lower.includes("aborted") ||
      lower.includes("abort") ||
      lower.includes("networking") ||
      lower.includes("getaddrinfo") ||
      lower.includes("fetch failed") ||
      lower.includes("aggregateerror")
    ) {
      const isOfficialR2 = endpoint.includes("r2.cloudflarestorage.com");
      hint = isOfficialR2
        ? "无法连接到 Cloudflare R2 Endpoint。请确认网络可访问 r2.cloudflarestorage.com。"
        : "无法连接到 Endpoint（" + endpoint + "）。请确认地址可从当前机器访问。";
    }
    return { ok: false, message: "连接失败：" + hint };
  };

  const unimplemented = (err) => {
    const raw = sanitizeError(err).toLowerCase();
    return (
      raw.includes("notimplemented") ||
      raw.includes("method not allowed") ||
      raw.includes("not supported") ||
      raw.includes("unknownoperation")
    );
  };

  const send = async (command) => {
    const t = withTimeout(12000);
    try {
      return await client.send(command, { abortSignal: t.signal });
    } finally {
      t.done();
    }
  };

  try {
    await send(new HeadBucketCommand({ Bucket: bucket }));
    return { ok: true, message: "连接成功：已确认桶「" + bucket + "」可访问（HeadBucket）。" + extra };
  } catch (headErr) {
    try {
      await send(
        new ListObjectsV2Command({
          Bucket: bucket,
          MaxKeys: 1,
          Prefix: "_shortxmax_connection_test/",
        }),
      );
      return { ok: true, message: "连接成功：已确认桶「" + bucket + "」可列举（ListObjects）。" + extra };
    } catch (listErr) {
      if (!unimplemented(headErr) && !unimplemented(listErr)) {
        return failed(listErr, failed(headErr, "无法访问该桶。").message);
      }
      const key = "_shortxmax_connection_test/" + Date.now() + "-" + crypto.randomBytes(4).toString("hex") + ".txt";
      const body = Buffer.from("shortxmax-storage-ok", "utf8");
      try {
        await send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: "text/plain",
          }),
        );
        await send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        try {
          await send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        } catch {
          // cleanup is best-effort; never delete anything outside this prefix
        }
        return { ok: true, message: "连接成功：已在桶「" + bucket + "」的测试前缀写入并读取后删除。" + extra };
      } catch (putErr) {
        return failed(putErr, failed(listErr, "连接失败。").message);
      }
    }
  }
}

async function main() {
  const jsonPath = process.env.STORAGE_PROFILES_JSON;
  if (!jsonPath) die("STORAGE_PROFILES_JSON is required");
  const resolved = path.resolve(jsonPath);
  if (!fs.existsSync(resolved)) die("profiles file not found");

  const data = JSON.parse(fs.readFileSync(resolved, "utf8"));
  const profiles = data.profiles;
  if (!Array.isArray(profiles) || profiles.length === 0) die("no profiles in export");

  const prisma = new PrismaClient();
  const results = [];
  try {
    let officialOk = 0;
    let sortOrder = 0;

    for (const profile of profiles) {
      const name = String(profile.name || "").trim();
      const bucket = String(profile.bucket || "").trim();
      const accountId = String(profile.accountId || "").trim();
      const accessKey = String(profile.accessKeyId || profile.accessKey || "").trim();
      const secretKey = String(profile.secretAccessKey || profile.secretKey || "").trim();
      const publicBaseUrl = String(profile.publicBaseUrl || "").trim().replace(/\/$/, "");
      const region = String(profile.region || "auto").trim() || "auto";
      const provider = classifyProvider(profile);
      const endpoint =
        provider === "r2"
          ? r2EndpointFor(accountId, profile.endpoint)
          : String(profile.endpoint || "").trim().replace(/\/$/, "");
      const typeLabel = provider === "r2" ? "Cloudflare R2" : "Garage/VPS";

      const existing = await prisma.storageEndpoint.findMany();
      const match = existing.find((ep) =>
        provider === "r2"
          ? ep.accountId === accountId && ep.bucket === bucket
          : ep.endpoint === endpoint && ep.bucket === bucket,
      );

      const test = await testConnection({
        accountId,
        endpoint,
        region,
        accessKey,
        secretKey,
        bucket,
        publicBaseUrl,
      });

      const payload = {
        label: name || (provider === "r2" ? "Cloudflare R2" : "Garage"),
        provider,
        accountId,
        accessKey,
        secretKey,
        bucket,
        endpoint,
        region,
        publicBaseUrl,
        weight: 1,
        isEnabled: Boolean(test.ok),
        sortOrder,
        lastError: test.ok ? "" : test.message,
        lastOkAt: test.ok ? new Date() : match && match.lastOkAt ? match.lastOkAt : null,
      };

      if (match) {
        await prisma.storageEndpoint.update({ where: { id: match.id }, data: payload });
      } else {
        await prisma.storageEndpoint.create({ data: payload });
      }

      if (provider === "r2" && test.ok) officialOk += 1;
      results.push({
        name: payload.label,
        type: typeLabel,
        bucket,
        publicBaseUrl,
        ok: Boolean(test.ok),
        error: test.ok ? "" : test.message,
        action: match ? "updated" : "created",
      });
      sortOrder += 1;
    }

    let defaultChannel = "none";
    // Imported official/Garage nodes are records only. Website uploads stay on R2 Studio.
    const settings = await prisma.siteSettings.findFirst();
    defaultChannel = settings ? settings.storageMode : "r2studio";

    const readyOfficial = results.filter((r) => r.type === "Cloudflare R2" && r.ok).map((r) => r.name);
    console.log(
      JSON.stringify(
        {
          officialOk,
          defaultChannel,
          defaultOfficialNodes: readyOfficial,
          results: results.filter((r) => r.type !== "settings"),
          settingsWarning: results.find((r) => r.type === "settings") || null,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("import failed:", sanitizeError(err));
  process.exit(1);
});
