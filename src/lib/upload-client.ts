"use client";

/**
 * Browser side of the R2 Studio upload: slices a file, sends parts to this site
 * (which streams them through to R2 Studio), retries failed parts, and resumes an
 * interrupted multipart upload when the same file is picked again.
 */

export const SINGLE_MAX_BYTES = 8 * 1024 * 1024;

export type UploadProgress = {
  phase: "preparing" | "uploading" | "finalizing";
  sent: number;
  total: number;
  /** bytes/s, smoothed */
  speed: number;
  /** seconds, -1 unknown */
  eta: number;
};

export type UploadResult = { url: string; id: string };

export class UploadAbort extends Error {
  constructor() {
    super("已取消");
    this.name = "AbortError";
  }
}

class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const RESUME_PREFIX = "sxm.upload.mp.";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function readHead(file: File) {
  const buf = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s);
}

function xhrSend(opts: {
  method: string;
  url: string;
  body: Blob;
  signal: AbortSignal;
  onLoaded: (n: number) => void;
}): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    if (opts.signal.aborted) return reject(new UploadAbort());
    const xhr = new XMLHttpRequest();
    xhr.open(opts.method, opts.url);
    xhr.responseType = "json";
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (ev) => opts.onLoaded(ev.loaded);
    const onAbort = () => xhr.abort();
    opts.signal.addEventListener("abort", onAbort, { once: true });
    xhr.onload = () => {
      opts.signal.removeEventListener("abort", onAbort);
      const json = (xhr.response || {}) as Record<string, unknown>;
      if (xhr.status >= 200 && xhr.status < 300) resolve(json);
      else reject(new HttpError(String(json.error || `HTTP ${xhr.status}`), xhr.status));
    };
    xhr.onerror = () => {
      opts.signal.removeEventListener("abort", onAbort);
      reject(new HttpError("网络中断", 0));
    };
    xhr.onabort = () => reject(new UploadAbort());
    xhr.send(opts.body);
  });
}

async function postJson(url: string, body: unknown, signal?: AbortSignal, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new HttpError(String(json.error || `HTTP ${res.status}`), res.status);
  return json;
}

const retryable = (err: unknown) =>
  err instanceof HttpError && (err.status === 0 || err.status === 408 || err.status === 429 || err.status >= 500);

/** Smoothed speed / ETA meter. */
function meter(total: number) {
  let lastAt = performance.now();
  let lastSent = 0;
  let speed = 0;
  return (sent: number) => {
    const now = performance.now();
    const dt = (now - lastAt) / 1000;
    if (dt >= 0.5) {
      const inst = Math.max(0, (sent - lastSent) / dt);
      speed = speed ? speed * 0.6 + inst * 0.4 : inst;
      lastAt = now;
      lastSent = sent;
    }
    const eta = speed > 0 ? (total - sent) / speed : -1;
    return { speed, eta };
  };
}

export async function uploadFile(
  file: File,
  kind: "cover" | "video",
  opts: {
    signal: AbortSignal;
    onProgress?: (p: UploadProgress) => void;
    onJobId?: (id: string) => void;
    partConcurrency?: number;
    retries?: number;
  },
): Promise<UploadResult> {
  const total = file.size;
  const tick = meter(total);
  const report = (phase: UploadProgress["phase"], sent: number) => {
    const { speed, eta } = tick(sent);
    opts.onProgress?.({ phase, sent, total, speed, eta: phase === "finalizing" ? -1 : eta });
  };
  const retries = opts.retries ?? 3;
  report("preparing", 0);
  const head = await readHead(file);

  if (total <= SINGLE_MAX_BYTES) {
    const q = new URLSearchParams({ kind, name: file.name, head });
    for (let attempt = 0; ; attempt++) {
      try {
        const json = await xhrSend({
          method: "POST",
          url: `/api/admin/upload/single?${q}`,
          body: file,
          signal: opts.signal,
          onLoaded: (n) => report("uploading", Math.min(n, total)),
        });
        return { url: String(json.url), id: String(json.id || "") };
      } catch (err) {
        if (err instanceof UploadAbort || attempt >= retries || !retryable(err)) throw err;
        await sleep(1000 * 2 ** attempt);
      }
    }
  }

  const fingerprint = `${file.name}|${file.size}|${file.lastModified}`;
  const resumeKey = RESUME_PREFIX + fingerprint;
  const resumeId = typeof localStorage !== "undefined" ? localStorage.getItem(resumeKey) || "" : "";
  const plan = await postJson(
    "/api/admin/upload/multipart",
    { kind, filename: file.name, size: total, fingerprint, head, resumeId },
    opts.signal,
  );
  const id = String(plan.id);
  const partSize = Number(plan.partSize);
  const partCount = Number(plan.partCount);
  const done = new Set<number>((plan.done as number[]) || []);
  try {
    localStorage.setItem(resumeKey, id);
  } catch {
    /* private mode */
  }
  opts.onJobId?.(id);

  const partLen = (n: number) => (n < partCount ? partSize : total - partSize * (partCount - 1));
  let doneBytes = 0;
  done.forEach((n) => (doneBytes += partLen(n)));
  const inflight = new Map<number, number>();
  const sentNow = () => doneBytes + [...inflight.values()].reduce((a, b) => a + b, 0);
  report("uploading", sentNow());

  const todo: number[] = [];
  for (let n = 1; n <= partCount; n++) if (!done.has(n)) todo.push(n);

  const abortOnCancel = () => {
    postJson(`/api/admin/upload/multipart/${encodeURIComponent(id)}`, undefined, undefined, "DELETE").catch(() => null);
    try {
      localStorage.removeItem(resumeKey);
    } catch {
      /* ignore */
    }
  };
  opts.signal.addEventListener("abort", abortOnCancel, { once: true });

  try {
    let failure: unknown = null;
    const worker = async () => {
      while (todo.length && !failure) {
        const n = todo.shift()!;
        const start = (n - 1) * partSize;
        const blob = file.slice(start, start + partLen(n));
        for (let attempt = 0; ; attempt++) {
          try {
            inflight.set(n, 0);
            await xhrSend({
              method: "PUT",
              url: `/api/admin/upload/multipart/${encodeURIComponent(id)}/parts/${n}`,
              body: blob,
              signal: opts.signal,
              onLoaded: (b) => {
                inflight.set(n, b);
                report("uploading", sentNow());
              },
            });
            inflight.delete(n);
            doneBytes += blob.size;
            report("uploading", sentNow());
            break;
          } catch (err) {
            inflight.delete(n);
            if (err instanceof UploadAbort || attempt >= retries || !retryable(err)) {
              failure = failure || err;
              return;
            }
            await sleep(1000 * 2 ** attempt);
          }
        }
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, opts.partConcurrency ?? 2) }, worker));
    if (failure) throw failure;

    report("finalizing", total);
    const out = await postJson(`/api/admin/upload/multipart/${encodeURIComponent(id)}/complete`, {}, opts.signal);
    try {
      localStorage.removeItem(resumeKey);
    } catch {
      /* ignore */
    }
    return { url: String(out.url), id };
  } finally {
    opts.signal.removeEventListener("abort", abortOnCancel);
  }
}

export async function startRemoteFetch(input: { url: string; name?: string; headers?: Record<string, string> }) {
  const json = await postJson("/api/admin/upload/fetch", input);
  return { id: String(json.id), publicUrl: (json.publicUrl as string) || null };
}

export async function cancelStudioJob(id: string) {
  await fetch(`/api/admin/r2s/uploads/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
}

export type StudioJob = {
  id: string;
  state?: string;
  phase?: string;
  percent?: number;
  speed?: number;
  eta?: number;
  size?: number;
  received?: number;
  publicUrl?: string;
  shortUrl?: string;
  error?: string;
  accountName?: string;
};

export function normalizeJob(raw: Record<string, unknown>): StudioJob | null {
  const id = String(raw.id || "");
  if (!id) return null;
  const err = raw.error;
  return {
    id,
    state: raw.state ? String(raw.state) : undefined,
    phase: raw.phase ? String(raw.phase) : undefined,
    percent: typeof raw.percent === "number" ? raw.percent : undefined,
    speed: typeof raw.speed === "number" ? raw.speed : undefined,
    eta: typeof raw.eta === "number" ? raw.eta : undefined,
    size: typeof raw.size === "number" ? raw.size : undefined,
    received: typeof raw.received === "number" ? raw.received : undefined,
    publicUrl: raw.publicUrl ? String(raw.publicUrl) : undefined,
    shortUrl: raw.shortUrl ? String(raw.shortUrl) : undefined,
    accountName: raw.accountName ? String(raw.accountName) : undefined,
    error: err ? String(typeof err === "object" ? (err as { message?: string }).message || "失败" : err) : undefined,
  };
}

export function formatBytes(n?: number) {
  if (n == null || !Number.isFinite(n) || n < 0) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : v >= 100 ? 0 : 1)} ${u[i]}`;
}

export function formatEta(s?: number) {
  if (s == null || s < 0 || !Number.isFinite(s)) return "剩余时间未知";
  const t = Math.round(s);
  if (t < 60) return `剩余约 ${t} 秒`;
  const m = Math.floor(t / 60);
  if (m < 60) return `剩余约 ${m} 分 ${t % 60} 秒`;
  return `剩余约 ${Math.floor(m / 60)} 小时 ${m % 60} 分`;
}
