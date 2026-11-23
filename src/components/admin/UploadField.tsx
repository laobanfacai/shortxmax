"use client";

import { useEffect, useRef, useState } from "react";
import { StudioChannelCard, useStudioStatus } from "@/components/admin/StudioChannelCard";
import { classifyUploadFailure } from "@/lib/storage-capacity";
import { uploadFile } from "@/lib/upload-client";

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
    const ac = new AbortController();
    abortRef.current = ac;
    setStatus("上传中…");
    setProgress({ state: "uploading", percent: 0 });
    try {
      const out = await uploadFile(file, kind, {
        signal: ac.signal,
        onProgress: (p) =>
          setProgress({
            state: p.phase === "finalizing" ? "finalizing" : "uploading",
            percent: p.total ? (p.sent / p.total) * 100 : 0,
            speed: p.speed,
            eta: p.eta,
          }),
      });
      setUrl(out.url);
      setStatus("已上传");
      setProgress({ state: "done", percent: 100 });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setStatus("已取消");
        setProgress((p) => (p ? { ...p, state: "cancelled" } : p));
      } else {
        const msg = classifyUploadFailure((err as Error).message || "上传失败");
        setStatus(`上传失败：${msg}`);
        setProgress((p) => (p ? { ...p, state: "error", error: msg } : { state: "error", percent: 0, error: msg }));
      }
    }
  }

  async function onCancel() {
    // Aborting also deletes the multipart session on R2 Studio (see uploadFile).
    abortRef.current?.abort();
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
        accept={kind === "video" ? "video/mp4,video/webm,video/quicktime,.mov" : "image/jpeg,image/png,image/webp"}
        className="mt-2 block text-sm text-muted"
        disabled={!studioReady}
        onChange={(e) => onFile(e.target.files?.[0] || null)}
      />
      {studioReady ? (
        <div className="mt-3 rounded-lg border p-3" style={{ borderColor: "var(--admin-border)" }}>
          <p className="text-xs text-muted">上传进度（分片经本站转发到 R2 Studio，Key 不进浏览器）</p>
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
