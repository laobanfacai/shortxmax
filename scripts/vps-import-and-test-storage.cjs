#!/usr/bin/env node
"use strict";

/**
 * Import R2 Studio exported official R2 / Garage profiles into StorageEndpoint
 * and test each node from the machine this script runs on (intended: the site VPS).
 *
 * Never prints access keys, secrets, api tokens, or raw account credentials.
 * Never stores apiToken.
 * Never switches the website upload channel away from r2studio.
 *
 * Usage:
 *   STORAGE_PROFILES_JSON=/path/to/profiles.json node scripts/vps-import-and-test-storage.cjs
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const net = require("net");
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
  raw = raw.replace(/GK[0-9A-Za-z_-]{8,}/g, "[redacted]");
  raw = raw.replace(/r2s_[0-9A-Za-z_-]+/g, "[redacted-key]");
  raw = raw.replace(/[?&](X-Amz-Credential|X-Amz-Signature|Signature|AWSAccessKeyId)=[^\s&]+/gi, "");
  raw = raw.replace(/secret[^=\s]*[=:]\s*\S+/gi, "secret=[redacted]");
  raw = raw.replace(/accessKeyId[=:]\s*\S+/gi, "accessKeyId=[redacted]");
  raw = raw.replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
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

function withTimeout(ms) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  return { signal: ac.signal, done: () => clearTimeout(timer) };
}

function tcpProbe(host, port, ms) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: ms });
    const done = (ok, reason) => {
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      resolve({ host, port, open: ok, reason: reason || (ok ? "open" : "closed") });
    };
    socket.on("connect", () => done(true, "open"));
    socket.on("timeout", () => done(false, "timeout"));
    socket.on("error", (err) => done(false, err.code || err.message || "error"));
  });
}

function s3Client(input) {
  return new S3Client({
    region: input.region || "auto",
    endpoint: input.endpoint,
    credentials: {
      accessKeyId: input.accessKey,
      secretAccessKey: input.secretKey,
    },
    forcePathStyle: input.forcePathStyle !== false,
    tls: input.tls,
  });
}

function classifyFailure(err, endpoint, bucket) {
  const raw = sanitizeError(err);
  const lower = raw.toLowerCase();
  if (lower.includes("invalidaccesskeyid") || lower.includes("invalid access")) {
    return "Access Key 不被该 Endpoint 接受。";
  }
  if (lower.includes("signaturedoesnotmatch") || lower.includes("invalidsecret")) {
    return "签名不匹配（Secret Key 或寻址方式/区域不正确）。";
  }
  if (lower.includes("nosuchbucket")) {
    return "找不到名为「" + bucket + "」的存储桶。";
  }
  if (
    lower.includes("access denied") ||
    lower.includes("forbidden") ||
    lower.includes("not authorized") ||
    lower.includes("explicit deny")
  ) {
    return "权限不足，或该 Endpoint 拒绝了此次请求。";
  }
  if (
    lower.includes("xml parse") ||
    lower.includes("mismatched tag") ||
    lower.includes("deserialization") ||
    lower.includes("unexpected token") ||
    lower.includes("<html") ||
    lower.includes("<!doctype") ||
    lower.includes("<hr>") ||
    lower.includes("</body>")
  ) {
    return "Endpoint 返回了网页而非 S3 接口（常见于 403/网关页）。";
  }
  if (
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
    const isOfficialR2 = String(endpoint).includes("r2.cloudflarestorage.com");
    return isOfficialR2
      ? "无法连接到 Cloudflare R2 Endpoint。"
      : "无法连接到 Endpoint（" + endpoint + "）。";
  }
  return raw || "无法访问该桶。";
}

function unimplemented(err) {
  const raw = sanitizeError(err).toLowerCase();
  return (
    raw.includes("notimplemented") ||
    raw.includes("method not allowed") ||
    raw.includes("not supported") ||
    raw.includes("unknownoperation")
  );
}

async function testOnce(input) {
  const endpoint = String(input.endpoint || "").trim().replace(/\/$/, "");
  const bucket = String(input.bucket || "").trim();
  const accessKey = String(input.accessKey || "").trim();
  const secretKey = String(input.secretKey || "").trim();
  const region = input.region || "auto";
  const forcePathStyle = input.forcePathStyle !== false;
  if (!bucket) return { ok: false, message: "请填写桶名。" };
  if (!accessKey || !secretKey) return { ok: false, message: "请填写 Access Key 和 Secret Key。" };
  if (!endpoint) return { ok: false, message: "缺少 Endpoint。" };

  const client = s3Client({
    endpoint,
    region,
    accessKey,
    secretKey,
    forcePathStyle,
  });

  const send = async (command) => {
    const t = withTimeout(15000);
    try {
      return await client.send(command, { abortSignal: t.signal });
    } finally {
      t.done();
    }
  };

  const style = forcePathStyle ? "path-style" : "virtual-host";
  const meta = { endpoint, region, style };

  try {
    await send(new HeadBucketCommand({ Bucket: bucket }));
    return {
      ok: true,
      ...meta,
      method: "HeadBucket",
      message: "连接成功：HeadBucket 已确认桶「" + bucket + "」可访问（" + style + "，region=" + region + "）。",
    };
  } catch (headErr) {
    try {
      await send(
        new ListObjectsV2Command({
          Bucket: bucket,
          MaxKeys: 1,
          Prefix: "_shortxmax_connection_test/",
        }),
      );
      return {
        ok: true,
        ...meta,
        method: "ListObjects",
        message: "连接成功：ListObjects 已确认桶「" + bucket + "」可列举（" + style + "，region=" + region + "）。",
      };
    } catch (listErr) {
      if (!unimplemented(headErr) && !unimplemented(listErr)) {
        return {
          ok: false,
          ...meta,
          method: "HeadBucket/ListObjects",
          message: "连接失败：" + classifyFailure(listErr, endpoint, bucket),
        };
      }
      const key = "_shortxmax_connection_test/" + Date.now() + "-" + crypto.randomBytes(4).toString("hex") + ".txt";
      try {
        await send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: Buffer.from("shortxmax-storage-ok", "utf8"),
            ContentType: "text/plain",
          }),
        );
        await send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        try {
          await send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        } catch {
          /* best-effort cleanup only under this prefix */
        }
        return {
          ok: true,
          ...meta,
          method: "PutGetDelete",
          message: "连接成功：已在测试前缀写入并读取后删除（" + style + "，region=" + region + "）。",
        };
      } catch (putErr) {
        return {
          ok: false,
          ...meta,
          method: "write-fallback",
          message: "连接失败：" + classifyFailure(putErr, endpoint, bucket),
        };
      }
    }
  } finally {
    try {
      client.destroy();
    } catch {
      /* ignore */
    }
  }
}

function unique(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function variantsFor(profile, provider, defaultEndpoint) {
  const name = String(profile.name || "").trim();
  const regions = unique([String(profile.region || "auto").trim() || "auto", "auto", "us-east-1", "garage"]);
  const styles = [true, false];
  const endpoints = [];

  const add = (ep) => {
    const v = String(ep || "").trim().replace(/\/$/, "");
    if (v) endpoints.push(v);
  };
  add(defaultEndpoint);

  if (provider === "garage" && /本机存储/.test(name)) {
    add("http://127.0.0.1:3900");
    add("http://64.235.39.49:3900");
    add("http://64.235.39.49:3902");
    add("http://64.235.39.49:3903");
    add("https://64.235.39.49:3900");
    add("http://64.235.39.49");
    add("https://64.235.39.49");
  }
  if (provider === "garage" && /\(216\)/.test(name)) {
    add("https://s3.open-traffic.com");
    add("http://s3.open-traffic.com");
  }

  const attempts = [];
  for (const endpoint of unique(endpoints)) {
    for (const forcePathStyle of styles) {
      for (const region of regions) {
        attempts.push({ endpoint, forcePathStyle, region });
      }
    }
  }
  return attempts;
}

async function endpointPortOpen(endpoint) {
  try {
    const u = new URL(endpoint);
    const port = Number(u.port) || (u.protocol === "https:" ? 443 : 80);
    return await tcpProbe(u.hostname, port, 3000);
  } catch (err) {
    return { open: false, reason: sanitizeError(err) };
  }
}

async function testProfile(profile, provider, defaultEndpoint, creds) {
  const attempts = variantsFor(profile, provider, defaultEndpoint);
  const tried = [];
  const reachCache = new Map();
  for (const attempt of attempts) {
    let reach = reachCache.get(attempt.endpoint);
    if (!reach) {
      reach = await endpointPortOpen(attempt.endpoint);
      reachCache.set(attempt.endpoint, reach);
    }
    if (!reach.open) {
      tried.push({
        endpoint: attempt.endpoint,
        region: attempt.region,
        style: attempt.forcePathStyle ? "path-style" : "virtual-host",
        ok: false,
        method: "tcp",
        message: "连接失败：无法连接到 Endpoint（" + attempt.endpoint + "），端口不可达（" + (reach.reason || "closed") + "）。",
      });
      continue;
    }
    const result = await testOnce({
      ...creds,
      endpoint: attempt.endpoint,
      region: attempt.region,
      forcePathStyle: attempt.forcePathStyle,
    });
    tried.push({
      endpoint: attempt.endpoint,
      region: attempt.region,
      style: attempt.forcePathStyle ? "path-style" : "virtual-host",
      ok: result.ok,
      method: result.method || null,
      message: result.message,
    });
    if (result.ok) {
      return { ok: true, used: result, tried };
    }
  }
  const last = tried[tried.length - 1];
  return { ok: false, used: null, tried, message: last ? last.message : "没有可测的 Endpoint。" };
}

async function main() {
  const jsonPath = process.env.STORAGE_PROFILES_JSON;
  if (!jsonPath) die("STORAGE_PROFILES_JSON is required");
  const resolved = path.resolve(jsonPath);
  if (!fs.existsSync(resolved)) die("profiles file not found");

  const data = JSON.parse(fs.readFileSync(resolved, "utf8"));
  const profiles = data.profiles;
  if (!Array.isArray(profiles) || profiles.length === 0) die("no profiles in export");
  if (data.exportedAt) console.log("export exportedAt=" + data.exportedAt);

  const probeTargets = [
    ["127.0.0.1", 3900],
    ["127.0.0.1", 3902],
    ["127.0.0.1", 3910],
    ["64.235.39.49", 3900],
    ["64.235.39.49", 3902],
    ["64.235.39.49", 3903],
    ["64.235.39.49", 443],
    ["216.108.231.193", 3900],
    ["216.108.231.193", 3910],
    ["216.108.231.193", 443],
  ];
  const probes = [];
  for (const [host, port] of probeTargets) {
    probes.push(await tcpProbe(host, port, 3000));
  }
  console.log("tcpProbes=" + JSON.stringify(probes));

  const prisma = new PrismaClient();
  const results = [];
  try {
    let sortOrder = 0;
    const existing = await prisma.storageEndpoint.findMany();

    for (const profile of profiles) {
      const name = String(profile.name || "").trim();
      const bucket = String(profile.bucket || "").trim();
      const accountId = String(profile.accountId || "").trim();
      const accessKey = String(profile.accessKeyId || profile.accessKey || "").trim();
      const secretKey = String(profile.secretAccessKey || profile.secretKey || "").trim();
      const publicBaseUrl = String(profile.publicBaseUrl || "").trim();
      const region = String(profile.region || "auto").trim() || "auto";
      const provider = classifyProvider(profile);
      const endpoint =
        provider === "r2"
          ? r2EndpointFor(accountId, profile.endpoint)
          : String(profile.endpoint || "").trim().replace(/\/$/, "");

      const match =
        provider === "r2"
          ? existing.find((ep) => ep.accountId === accountId && ep.bucket === bucket)
          : existing.find(
              (ep) =>
                ep.bucket === bucket &&
                (ep.label === name || ep.endpoint === endpoint || ep.publicBaseUrl === publicBaseUrl),
            );

      const test = await testProfile(profile, provider, endpoint, {
        accessKey,
        secretKey,
        bucket,
      });

      const keepEndpoint = test.ok && test.used && test.used.endpoint ? test.used.endpoint : endpoint;
      const keepRegion = test.ok && test.used && test.used.region ? test.used.region : region;
      const payload = {
        label: name || (provider === "r2" ? "Cloudflare R2" : "Garage"),
        provider,
        accountId,
        accessKey,
        secretKey,
        bucket,
        endpoint: keepEndpoint,
        region: keepRegion,
        publicBaseUrl,
        weight: 1,
        isEnabled: Boolean(test.ok),
        sortOrder,
        lastError: test.ok ? "" : (test.message || "连接失败。").slice(0, 500),
        lastOkAt: test.ok ? new Date() : match && match.lastOkAt ? match.lastOkAt : null,
      };

      let row;
      if (match) {
        row = await prisma.storageEndpoint.update({ where: { id: match.id }, data: payload });
        match._updated = true;
      } else {
        row = await prisma.storageEndpoint.create({ data: payload });
        existing.push({ ...row, _updated: true });
      }

      const originalNote =
        keepEndpoint !== endpoint
          ? { originalEndpoint: endpoint, updatedEndpoint: keepEndpoint }
          : { originalEndpoint: endpoint, updatedEndpoint: null };

      results.push({
        name: payload.label,
        type: provider === "r2" ? "Cloudflare R2" : "Garage/VPS",
        bucket,
        publicBaseUrl,
        action: match && match.id === row.id && !row ? "updated" : match ? "updated" : "created",
        ok: test.ok,
        method: test.used ? test.used.method : null,
        endpointStored: keepEndpoint,
        ...originalNote,
        style: test.used ? test.used.style : null,
        region: test.used ? test.used.region : keepRegion,
        error: test.ok ? "" : test.message || "",
        attempts: test.tried.map((t) => ({
          endpoint: t.endpoint,
          region: t.region,
          style: t.style,
          ok: t.ok,
          message: t.message,
        })),
        idSuffix: String(row.id).slice(-8),
      });
      sortOrder += 1;
    }

    const settings = await prisma.siteSettings.findUnique({
      where: { id: "default" },
      select: { storageMode: true, r2StudioEnabled: true, r2StudioApiKey: true },
    });
    const keyPresent = Boolean(settings && String(settings.r2StudioApiKey || "").trim());
    let storageMode = settings ? settings.storageMode : "unknown";
    if (storageMode !== "r2studio") {
      await prisma.siteSettings.update({
        where: { id: "default" },
        data: { storageMode: "r2studio" },
      });
      storageMode = "r2studio";
    }

    console.log(
      JSON.stringify(
        {
          imported: results.length,
          storageMode,
          r2StudioEnabled: settings ? Boolean(settings.r2StudioEnabled) : false,
          studioKeyPresent: keyPresent,
          results,
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
  console.error("import-and-test failed:", sanitizeError(err));
  process.exit(1);
});
