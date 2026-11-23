"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { applyEpisodePlan } from "@/app/admin/actions";
import {
  buildEpisodePlan,
  seriesHasGaps,
  type ExistingEpisode,
  type EpisodePlan,
} from "@/lib/episode-numbers";
import { StudioChannelCard, useStudioStatus } from "@/components/admin/StudioChannelCard";
import { classifyUploadFailure, formatStorageBytes } from "@/lib/storage-capacity";
import { assertPublicHttpUrl, filenameFromUrl } from "@/lib/public-http-url";

type QueueItem = {
  filename: string;
  file?: File;
  sourceUrl?: string;
  uploadId?: string;
  state: "queued" | "uploading" | "done" | "error";
  percent: number;
  phase?: string;
  speed?: number;
  eta?: number;
  url?: string;
  error?: string;
};

const ACCEPT = "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov";

const PHASE_LABEL: Record<string, string> = {
  queued: "排队中",
  connecting: "正在连接",
  downloading: "正在下载",
  uploading: "正在上传",
  finalizing: "收尾中",
  done: "已完成",
  error: "失败",
  cancelled: "已取消",
};

function formatBytes(n: number) {
  return formatStorageBytes(n);
}

function listenStudioProgress(
  uploadId: string,
  onEv: (j: Record<string, unknown>) => void,
): EventSource {
  const es = new EventSource(`/api/admin/r2s/uploads/${encodeURIComponent(uploadId)}/events`);
  const handler = (e: MessageEvent) => {
    try {
      onEv(JSON.parse(e.data) as Record<string, unknown>);
    } catch {
      /* ignore */
    }
  };
  es.addEventListener("upload", handler);
  es.addEventListener("snapshot", handler);
  return es;
}

async function uploadVideo(
  file: File,
  uploadId: string,
  onProgress: (pct: number, extra?: { speed?: number }) => void,
  signal: AbortSignal,
) {
  const data = new FormData();
  data.set("file", file);
  data.set("kind", "video");
  data.set("uploadId", uploadId);
  const xhr = new XMLHttpRequest();
  const url = await new Promise<string>((resolve, reject) => {
    xhr.open("POST", "/api/admin/upload");
    xhr.responseType = "json";
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      const json = xhr.response || {};
      if (xhr.status >= 200 && xhr.status < 300 && json.url) resolve(String(json.url));
      else reject(new Error(json.error || "上传失败"));
    };
    xhr.onerror = () => reject(new Error("上传失败"));
    xhr.onabort = () => reject(new DOMException("已取消", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort());
    xhr.send(data);
  });
  return url;
}

async function fetchRemoteToBucket(
  sourceUrl: string,
  filename: string,
  uploadId: string,
  onProgress: (info: { percent: number; phase?: string; speed?: number; eta?: number }) => void,
  signal: AbortSignal,
) {
  const es = listenStudioProgress(uploadId, (j) => {
    onProgress({
      percent: Number(j.percent) || 0,
      phase: String(j.phase || j.fetchPhase || j.state || ""),
      speed: typeof j.speed === "number" ? j.speed : undefined,
      eta: typeof j.eta === "number" ? j.eta : undefined,
    });
  });
  const close = () => {
    es.close();
  };
  signal.addEventListener("abort", close);
  try {
    const res = await fetch("/api/admin/r2s/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: sourceUrl, name: filename, uploadId, prefix: "lumereel/videos" }),
      signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "无法开始从链接下载");
    if (json.publicUrl) return String(json.publicUrl);
    const id = String(json.uploadId || uploadId);
    // Poll until done if the fetch job is async (202).
    for (let i = 0; i < 1800; i++) {
      if (signal.aborted) throw new DOMException("已取消", "AbortError");
      const st = await fetch(`/api/admin/r2s/uploads/${encodeURIComponent(id)}`, { signal });
      const body = await st.json().catch(() => ({}));
      if (body.percent != null || body.phase || body.state) {
        onProgress({
          percent: Number(body.percent) || 0,
          phase: String(body.phase || body.state || ""),
          speed: typeof body.speed === "number" ? body.speed : undefined,
          eta: typeof body.eta === "number" ? body.eta : undefined,
        });
      }
      if (body.publicUrl) return String(body.publicUrl);
      if (body.state === "done") {
        if (body.publicUrl) return String(body.publicUrl);
        throw new Error("下载已完成，但没有返回可播放地址。");
      }
      if (body.state === "error" || body.state === "cancelled") {
        throw new Error(body.error || (body.state === "cancelled" ? "已取消" : "下载失败"));
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("等待下载超时。");
  } finally {
    close();
  }
}

export function BatchEpisodeUploader({
  seriesId,
  freeEpisodeCount,
  episodes,
}: {
  seriesId: string;
  freeEpisodeCount: number;
  episodes: ExistingEpisode[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const liveUploadIdRef = useRef<string | null>(null);
  const studio = useStudioStatus();
  const [compactGaps, setCompactGaps] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [remoteUrls, setRemoteUrls] = useState<string[]>([]);
  const [urlDraft, setUrlDraft] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [previewMode, setPreviewMode] = useState<"idle" | "upload" | "compact">("idle");
  const [busy, setBusy] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [partialReady, setPartialReady] = useState(false);

  const hasGaps = useMemo(() => seriesHasGaps(episodes.map((e) => e.number)), [episodes]);
  const incomingNames = useMemo(
    () => [
      ...files.map((f) => ({ filename: f.name })),
      ...remoteUrls.map((u) => ({ filename: filenameFromUrl(u) })),
    ],
    [files, remoteUrls],
  );

  const plan: EpisodePlan | null = useMemo(() => {
    if (previewMode === "idle") return null;
    return buildEpisodePlan({
      existing: episodes,
      incoming: previewMode === "upload" ? incomingNames : [],
      compactGaps: previewMode === "compact" ? true : compactGaps,
    });
  }, [previewMode, episodes, incomingNames, compactGaps]);

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const next = Array.from(list).filter((f) => /\.(mp4|webm|mov)$/i.test(f.name) || f.type.startsWith("video/"));
    if (!next.length) {
      setError("请选择 mp4 / webm 视频文件。");
      return;
    }
    setError("");
    setMessage("");
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name + f.size));
      const merged = [...prev];
      for (const f of next) {
        const key = f.name + f.size;
        if (!names.has(key)) {
          merged.push(f);
          names.add(key);
        }
      }
      return merged;
    });
    setPreviewMode("upload");
  }

  function addUrl() {
    const raw = urlDraft.trim();
    const checked = assertPublicHttpUrl(raw);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    if (remoteUrls.includes(checked.url)) {
      setError("这个链接已经在列表里。");
      return;
    }
    setError("");
    setRemoteUrls((prev) => [...prev, checked.url]);
    setUrlDraft("");
    setPreviewMode("upload");
  }

  function cancelPreview() {
    abortRef.current?.abort();
    setPreviewMode("idle");
    setBusy(false);
    setQueue([]);
    setMessage("");
    setError("");
    setPartialReady(false);
  }

  async function confirm() {
    if (!plan) return;
    setBusy(true);
    setError("");
    setMessage("");
    setPartialReady(false);
    const compact = previewMode === "compact" ? true : compactGaps;

    let incoming: { filename: string; videoUrl: string }[] = [];
    if (previewMode === "upload") {
      if (!studio.ready) {
        setError("R2 Studio 尚未就绪。请先到「存储设置」填写 r2s_ Key 并测试连接。没有 Key 时不会改走官方桶或本机磁盘。");
        setBusy(false);
        return;
      }
      const ac = new AbortController();
      abortRef.current = ac;
      const items: QueueItem[] = [
        ...files.map((file) => ({ filename: file.name, file, state: "queued" as const, percent: 0 })),
        ...remoteUrls.map((sourceUrl) => ({
          filename: filenameFromUrl(sourceUrl),
          sourceUrl,
          state: "queued" as const,
          percent: 0,
        })),
      ];
      setQueue(items);
      try {
        for (let i = 0; i < items.length; i++) {
          const uploadId = crypto.randomUUID ? `job-${crypto.randomUUID()}` : `job-${Date.now()}-${i}`;
          liveUploadIdRef.current = uploadId;
          setQueue((q) => q.map((row, idx) => (idx === i ? { ...row, state: "uploading", percent: 0, uploadId } : row)));
          let url = "";
          if (items[i].file) {
            url = await uploadVideo(
              items[i].file!,
              uploadId,
              (pct) => setQueue((q) => q.map((row, idx) => (idx === i ? { ...row, percent: pct } : row))),
              ac.signal,
            );
          } else {
            url = await fetchRemoteToBucket(
              items[i].sourceUrl!,
              items[i].filename,
              uploadId,
              (info) =>
                setQueue((q) =>
                  q.map((row, idx) =>
                    idx === i
                      ? { ...row, percent: info.percent, phase: info.phase, speed: info.speed, eta: info.eta }
                      : row,
                  ),
                ),
              ac.signal,
            );
          }
          items[i] = { ...items[i], state: "done", percent: 100, url };
          setQueue((q) => q.map((row, idx) => (idx === i ? items[i] : row)));
        }
        incoming = items.map((row) => ({ filename: row.filename, videoUrl: row.url! }));
        liveUploadIdRef.current = null;
      } catch (err) {
        const aborted = (err as Error).name === "AbortError";
        const reason = aborted ? "已取消" : classifyUploadFailure((err as Error).message || "上传失败");
        setQueue((q) =>
          q.map((row) => {
            if (row.state === "done") return row;
            if (row.state === "uploading") return { ...row, state: "error", error: reason };
            return { ...row, state: "error", error: aborted ? "未处理：已取消" : `未处理：已停止（${reason}）` };
          }),
        );
        const succeeded = items.filter((row) => row.url).length;
        setPartialReady(succeeded > 0);
        setError(
          aborted
            ? "已取消。"
            : succeeded
              ? `中途失败：${reason}。已成功 ${succeeded} 个已保留，后续已停止。可以将已成功的写入分集，或取消。`
              : `失败：${reason}。已停止，没有写入分集，也没有改走官方桶直传。`,
        );
        setBusy(false);
        return;
      }
    }

    const result = await applyEpisodePlan({
      seriesId,
      compactGaps: compact,
      incoming,
    });
    if (!result.ok) {
      setError(result.message);
      setBusy(false);
      return;
    }
    setMessage(result.message);
    setFiles([]);
    setRemoteUrls([]);
    setQueue([]);
    setPreviewMode("idle");
    setBusy(false);
    router.refresh();
  }

  async function writeSucceeded() {
    const succeeded = queue.filter((row) => row.url);
    if (!succeeded.length) return;
    setBusy(true);
    setError("");
    const result = await applyEpisodePlan({
      seriesId,
      compactGaps,
      incoming: succeeded.map((row) => ({ filename: row.filename, videoUrl: row.url! })),
    });
    if (!result.ok) {
      setError(result.message);
      setBusy(false);
      return;
    }
    setMessage(result.message + `（仅写入已成功的 ${succeeded.length} 个。）`);
    setFiles([]);
    setRemoteUrls([]);
    setQueue([]);
    setPartialReady(false);
    setPreviewMode("idle");
    setBusy(false);
    router.refresh();
  }

  async function onCancelUpload() {
    abortRef.current?.abort();
    const id = liveUploadIdRef.current;
    if (id) {
      await fetch(`/api/admin/r2s/uploads/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
    }
    setError("已请求取消。");
  }

  const canStartUpload = studio.ready && (files.length > 0 || remoteUrls.length > 0);

  return (
    <section className="admin-card mt-8 p-5" data-batch-upload="true">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">批量上传</h2>
          <p className="mt-1 text-xs text-muted">
            选择本地视频，或粘贴公开的 http(s) 链接，由 R2 Studio 下载并写入它管理的存储池。不会把官方桶凭证接进网站，也不会写入本机磁盘。写入前会预览集号，遇到空号时可前移补齐。
          </p>
        </div>
        {hasGaps ? (
          <button
            type="button"
            className="btn btn-outline-gold btn-sm"
            disabled={busy}
            onClick={() => {
              setError("");
              setMessage("");
              setPreviewMode("compact");
            }}
          >
            补齐缺集
          </button>
        ) : (
          <p className="text-xs text-muted">当前已有集号是连续的。</p>
        )}
      </div>

      <StudioChannelCard />

      <label className="mt-4 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={compactGaps}
          onChange={(e) => setCompactGaps(e.target.checked)}
          disabled={busy}
        />
        <span>
          遇到缺集时自动用下一集前移补齐
          <span className="mt-0.5 block text-xs text-muted">
            默认开启。例如实际有 1、2、3、4、6、7、8、9 集（缺第 5 集）时，6→5、7→6，最终成为连续的 1–8 集。取消勾选则保留原始集号。
          </span>
        </span>
      </label>

      <div
        className="mt-4 rounded-xl border border-dashed p-6 text-center"
        style={{
          borderColor: dragOver ? "var(--color-gold)" : "var(--admin-border)",
          background: dragOver ? "color-mix(in srgb, var(--color-gold) 8%, transparent)" : "transparent",
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <p className="text-sm">将多个视频拖到这里，或</p>
        <button
          type="button"
          className="btn btn-gold btn-sm mt-3"
          onClick={() => inputRef.current?.click()}
          disabled={busy || !studio.ready}
        >
          选择视频文件
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="mt-2 text-xs text-muted">支持 mp4 / webm，可一次选择多个。免费集数仍按「前 {freeEpisodeCount} 集」同步。</p>
      </div>

      <div className="mt-5" data-fetch-to-bucket="true">
        <h3 className="text-sm font-medium">从链接下载到存储桶</h3>
        <p className="mt-1 text-xs text-muted">
          填写可公开访问的 http(s) 视频地址。本站服务端代为调用 R2 Studio 的 fetch 接口（Key 不会进入浏览器），Studio 负责下载并写入存储池。可随时取消。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="input flex-1"
            placeholder="https://example.com/videos/EP06.mp4"
            value={urlDraft}
            disabled={busy || !studio.ready}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addUrl();
              }
            }}
          />
          <button type="button" className="btn btn-outline-gold btn-sm" onClick={addUrl} disabled={busy || !studio.ready}>
            添加链接
          </button>
        </div>
        {remoteUrls.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs">
            {remoteUrls.map((u) => (
              <li key={u} className="flex justify-between gap-3">
                <span className="truncate">
                  {filenameFromUrl(u)} · {u}
                </span>
                <button
                  type="button"
                  className="text-danger"
                  disabled={busy}
                  onClick={() => setRemoteUrls((prev) => prev.filter((x) => x !== u))}
                >
                  移除
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {files.length > 0 && previewMode === "upload" ? (
        <ul className="mt-3 space-y-1 text-xs text-muted">
          {files.map((f) => (
            <li key={f.name + f.size} className="flex items-center justify-between gap-3">
              <span>
                {f.name} · {formatBytes(f.size)}
              </span>
              <button
                type="button"
                className="text-danger"
                disabled={busy}
                onClick={() => setFiles((prev) => prev.filter((x) => !(x.name === f.name && x.size === f.size)))}
              >
                移除
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {plan ? (
        <div className="mt-6" data-episode-plan="true">
          <h3 className="text-sm font-medium">集号映射预览</h3>
          <p className="mt-1 text-xs text-muted">
            {previewMode === "compact"
              ? "确认后只调整已有分集的集号和标题，不会删除视频文件。"
              : compactGaps
                ? "确认后先上传或从链接下载到 R2 Studio，再按此表写入分集。标为「用下一集补缺」的行会从原集号前移到空号上。"
                : "已关闭自动补齐，将保留识别到的原始集号。"}
          </p>
          {plan.hasGaps && (previewMode === "compact" || compactGaps) ? (
            <p className="mt-2 text-xs text-gold">检测到缺集：{plan.missingNumbers.join("、")}。将把后面的集依次前移。</p>
          ) : null}

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="py-2 pr-3 font-medium">来源</th>
                  <th className="py-2 pr-3 font-medium">原集号 / 文件名</th>
                  <th className="py-2 pr-3 font-medium">新集号</th>
                  <th className="py-2 font-medium">说明</th>
                </tr>
              </thead>
              <tbody>
                {plan.items.map((it, i) => (
                  <tr key={(it.id || it.filename || "row") + i} className="border-t" style={{ borderColor: "var(--admin-border)" }}>
                    <td className="py-2 pr-3 text-xs text-muted">{it.kind === "existing" ? "已有分集" : "新文件"}</td>
                    <td className="py-2 pr-3">
                      <span className="font-medium">{it.originalNumber}</span>
                      {it.filename ? <span className="mt-0.5 block text-xs text-muted">{it.filename}</span> : null}
                      {!it.filename && (it.originalTitle || it.title) ? (
                        <span className="mt-0.5 block text-xs text-muted">{it.originalTitle || it.title}</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 font-medium">
                      {it.shifted ? (
                        <span>
                          {it.originalNumber}→{it.assignedNumber}
                        </span>
                      ) : (
                        it.assignedNumber
                      )}
                    </td>
                    <td className="py-2 text-xs">
                      {it.shifted ? (
                        <span className="text-gold">用下一集补缺</span>
                      ) : it.parseFailed ? (
                        <span className="text-muted">文件名无集号，按选择顺序</span>
                      ) : it.conflict ? (
                        <span className="text-muted">识别集号冲突，已顺延</span>
                      ) : (
                        <span className="text-muted">保持</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {queue.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-muted">R2 Studio 任务队列</p>
              {queue.map((row) => (
                <div key={row.filename + (row.sourceUrl || "")}>
                  <div className="flex justify-between text-xs">
                    <span>
                      {row.filename}
                      {row.sourceUrl ? " · 来自链接" : ""}
                    </span>
                    <span className="text-muted">
                      {row.state === "done"
                        ? "已完成"
                        : row.state === "error"
                          ? row.error
                          : `${PHASE_LABEL[row.phase || ""] || row.phase || "进行中"} · ${row.percent}%${
                              row.speed ? ` · ${formatStorageBytes(row.speed)}/s` : ""
                            }`}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/10">
                    <div
                      className="h-full rounded-full bg-[var(--color-gold)]"
                      style={{ width: `${row.state === "done" ? 100 : row.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="btn btn-gold btn-md"
              onClick={confirm}
              disabled={busy || (!plan.willChange && previewMode === "compact") || (previewMode === "upload" && !canStartUpload)}
            >
              {busy
                ? previewMode === "upload"
                  ? "正在交给 R2 Studio…"
                  : "正在写入…"
                : previewMode === "upload"
                  ? "确认并上传 / 下载到桶"
                  : "确认并补齐缺集"}
            </button>
            {partialReady ? (
              <button type="button" className="btn btn-outline-gold btn-md" onClick={writeSucceeded} disabled={busy}>
                写入已成功的分集
              </button>
            ) : null}
            <button type="button" className="btn btn-ghost btn-md" onClick={busy ? onCancelUpload : cancelPreview}>
              {busy ? "取消当前任务" : "取消"}
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p className="mt-3 text-sm text-gold">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
    </section>
  );
}
