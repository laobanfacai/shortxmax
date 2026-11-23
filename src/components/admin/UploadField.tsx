"use client";

import { useEffect, useRef, useState } from "react";
import { StudioChannelCard, useStudioStatus } from "@/components/admin/StudioChannelCard";
import { classifyUploadFailure } from "@/lib/storage-capacity";

type Progress = {
  state: string;
  percent: number;
  speed?: number;
  eta?: number;
  accountName?: string;
  error?: string;
};

const STATE_LABEL: Record<string, string> = {
  queued: "排队中",
  uploading: "上传中",
  finalizing: "收尾中",
  done: "已完成",
  error: "失败",
  cancelled: "已取消",
};

function formatBytes(n?: number) {
  if (n == null || !Number.isFinite(n) || n < 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
}

function formatEta(seconds?: number) {
  if (seconds == null || seconds < 0 || !Number.isFinite(seconds)) return "未知";
  const s = Math.round(seconds);
  if (s < 60) return `约 ${s} 秒`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `约 ${m} 分 ${r} 秒` : `约 ${m} 分钟`;
}

export function UploadField({
  name,
  label,
  kind,
  defaultValue,
}: {
  name: string;
  label: string;
  kind: "cover" | "video";
  defaultValue?: string | null;
}) {
  const [url, setUrl] = useState(defaultValue || "");
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const studioStatus = useStudioStatus();
  const studioReady = studioStatus.ready;

  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  function closeStream() {
    esRef.current?.close();
    esRef.current = null;
  }

  async function onFile(file: File | null) {
    if (!file) return;
    if (!studioReady) {
      setStatus("R2 Studio 尚未就绪。请到「存储设置」填写 r2s_ Key 并测试连接。没有 Key 时不会改走官方桶或本机磁盘。");
      return;
    }
    closeStream();
    const id = crypto.randomUUID ? crypto.randomUUID() : `job-${Date.now()}`;
    const ac = new AbortController();
    abortRef.current = ac;
    setUploadId(id || null);
    setStatus("上传中…");
    setProgress({ state: "queued", percent: 0 });

    if (id) {
      const es = new EventSource(`/api/admin/r2s/uploads/${encodeURIComponent(id)}/events`);
      esRef.current = es;
      const onEv = (e: MessageEvent) => {
        try {
          const j = JSON.parse(e.data) as Progress & { publicUrl?: string; shortUrl?: string };
          setProgress({
            state: j.state || "uploading",
            percent: Number(j.percent) || 0,
            speed: j.speed,
            eta: j.eta,
            accountName: j.accountName,
            error: j.error,
          });
          if (j.publicUrl || j.shortUrl) setUrl(String(j.publicUrl || j.shortUrl));
          if (j.state === "done" || j.state === "error" || j.state === "cancelled") closeStream();
        } catch {
          /* ignore */
        }
      };
      es.addEventListener("upload", onEv);
      es.addEventListener("snapshot", onEv);
      es.onerror = () => {
        /* proxy may return JSON error if not configured mid-flight; keep POST going */
      };
    }

    const data = new FormData();
    data.set("file", file);
    data.set("kind", kind);
    if (id) data.set("uploadId", id);
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: data, signal: ac.signal });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = classifyUploadFailure(json.error || "上传失败");
        setStatus(`上传失败：${msg}。没有改走官方桶直传，也没有写入本机磁盘。`);
        setProgress((p) => (p ? { ...p, state: "error", error: msg } : p));
        closeStream();
        return;
      }
      setUrl(json.url);
      setStatus("已上传");
      setProgress((p) => (p ? { ...p, state: "done", percent: 100 } : p));
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setStatus("已取消");
        setProgress((p) => (p ? { ...p, state: "cancelled" } : p));
      } else {
        setStatus("上传失败");
        setProgress((p) => (p ? { ...p, state: "error", error: "上传失败" } : p));
      }
    } finally {
      closeStream();
    }
  }

  async function onCancel() {
    abortRef.current?.abort();
    if (uploadId) {
      await fetch(`/api/admin/r2s/uploads/${encodeURIComponent(uploadId)}`, { method: "DELETE" }).catch(() => null);
    }
    setStatus("已取消");
    setProgress((p) => (p ? { ...p, state: "cancelled" } : p));
    closeStream();
  }

  const pct = Math.max(0, Math.min(100, progress?.percent || 0));
  const live = progress && ["queued", "uploading", "finalizing"].includes(progress.state);

  return (
    <div>
      <label className="label">{label}</label>
      <input type="hidden" name={name} value={url} />
      <input
        className="input"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={kind === "video" ? "/uploads/videos/..." : "/uploads/covers/..."}
      />
      <StudioChannelCard compact />
      <input
        type="file"
        accept={kind === "video" ? "video/mp4,video/webm" : "image/*"}
        className="mt-2 block text-sm text-muted"
        disabled={!studioReady}
        onChange={(e) => onFile(e.target.files?.[0] || null)}
      />
      {studioReady ? (
        <div className="mt-3 rounded-lg border p-3" style={{ borderColor: "var(--admin-border)" }}>
          <p className="text-xs text-muted">R2 Studio 上传进度（由本站代理，不在浏览器暴露 Key）</p>
          {progress ? (
            <>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10">
                <div className="h-full rounded-full bg-[var(--color-gold)]" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted">
                {STATE_LABEL[progress.state] || progress.state} · {pct.toFixed(0)}% · {formatBytes(progress.speed)}/s · 剩余{" "}
                {formatEta(progress.eta)}
                {progress.accountName ? ` · 写入账号 ${progress.accountName}` : ""}
              </p>
              {progress.error ? <p className="mt-1 text-xs text-danger">{progress.error}</p> : null}
              {live ? (
                <button type="button" className="mt-2 text-xs text-gold" onClick={onCancel}>
                  取消上传
                </button>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-xs text-muted">选择文件后将显示百分比、速率、剩余时间和写入账号。</p>
          )}
        </div>
      ) : status ? (
        <p className="mt-1 text-xs text-gold">{status}</p>
      ) : null}
      {!studioReady && status && !progress ? <p className="mt-1 text-xs text-gold">{status}</p> : null}
      {kind === "cover" && url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="mt-2 h-28 rounded-lg object-cover" />
      ) : null}
    </div>
  );
}
