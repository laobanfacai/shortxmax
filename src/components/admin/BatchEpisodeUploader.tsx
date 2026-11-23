"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { applyEpisodePlan } from "@/app/admin/actions";
import { buildEpisodePlan, seriesHasGaps, type ExistingEpisode, type EpisodePlan } from "@/lib/episode-numbers";
import { useStudioStatus } from "@/components/admin/StudioChannelCard";
import { assertPublicHttpUrl, filenameFromUrl } from "@/lib/public-http-url";
import {
  cancelStudioJob,
  formatBytes,
  formatEta,
  normalizeJob,
  startRemoteFetch,
  uploadFile,
  type StudioJob,
} from "@/lib/upload-client";

/**
 * 分集批量上传：本地文件（浏览器分片 → 本站流式转发 → R2 Studio）
 * 与从链接导入（R2 Studio 服务器直接下载）。只负责上传，不改动 R2 Studio 存储池。
 */

type TaskState = "queued" | "uploading" | "finalizing" | "done" | "error" | "cancelled";
type Task = {
  key: string;
  source: "file" | "link";
  filename: string;
  file?: File;
  url?: string;
  headers?: Record<string, string>;
  episode?: number;
  state: TaskState;
  phase?: string;
  sent: number;
  total: number;
  percent: number;
  speed: number;
  eta: number;
  jobId?: string;
  publicUrl?: string;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
  written?: boolean;
  seenAt?: number;
};

type Filter = "all" | "active" | "queued" | "done" | "error";
const ACTIVE: TaskState[] = ["uploading", "finalizing"];
const TERMINAL: TaskState[] = ["done", "error", "cancelled"];
const ACCEPT = "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov";
const VIDEO_RE = /\.(mp4|webm|mov)$/i;

let seq = 0;
const newKey = () => `t${Date.now().toString(36)}${(seq++).toString(36)}`;

function stateLabel(t: Task) {
  if (t.state === "uploading") {
    if (t.source === "link") {
      if (t.phase === "connecting") return "连接源站";
      if (t.phase === "downloading") return "下载中";
      return "源站下载中";
    }
    return "上传中";
  }
  return { queued: "排队中", finalizing: "合并中", done: "已完成", error: "失败", cancelled: "已取消" }[t.state] || t.state;
}

const DOT: Record<TaskState, string> = {
  queued: "#c9cdd4",
  uploading: "#1677ff",
  finalizing: "#ff7d00",
  done: "#00b42a",
  error: "#f53f3f",
  cancelled: "#86909c",
};

function friendlyError(raw?: string) {
  const s = String(raw || "失败");
  if (/403/.test(s) && /源站/.test(s)) return `${s}，可在高级选项里添加 Referer 后重试`;
  return s;
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
  const studio = useStudioStatus();
  const inputRef = useRef<HTMLInputElement>(null);
  const controllers = useRef(new Map<string, AbortController>());
  const tasksRef = useRef<Task[]>([]);
  const startedRef = useRef(new Set<string>());

  const [tab, setTab] = useState<"local" | "link">("local");
  const [files, setFiles] = useState<File[]>([]);
  const [linkText, setLinkText] = useState("");
  const [showAdv, setShowAdv] = useState(false);
  const [headerRows, setHeaderRows] = useState<{ k: string; v: string }[]>([{ k: "Referer", v: "" }]);
  const [fileConcurrency, setFileConcurrency] = useState(2);
  const [autoWrite, setAutoWrite] = useState(true);
  const [compactGaps, setCompactGaps] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [tasks, setTasksState] = useState<Task[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [writing, setWriting] = useState(false);
  const [compactPreview, setCompactPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const setTasks = useCallback((fn: (prev: Task[]) => Task[]) => {
    // Keep the ref in sync immediately so schedulers never read a stale list.
    const next = fn(tasksRef.current);
    tasksRef.current = next;
    setTasksState(next);
  }, []);
  const patch = useCallback(
    (key: string, p: Partial<Task>) => setTasks((prev) => prev.map((t) => (t.key === key ? { ...t, ...p } : t))),
    [setTasks],
  );

  // ───────── pending input ─────────
  const links = useMemo(() => {
    const out: { url: string; ok: boolean; message?: string }[] = [];
    const seen = new Set<string>();
    for (const line of linkText.split(/\r?\n/)) {
      const raw = line.trim();
      if (!raw || seen.has(raw)) continue;
      seen.add(raw);
      const c = assertPublicHttpUrl(raw);
      out.push(c.ok ? { url: c.url, ok: true } : { url: raw, ok: false, message: c.message });
    }
    return out;
  }, [linkText]);
  const validLinks = links.filter((l) => l.ok);
  const badLinks = links.filter((l) => !l.ok);

  const pendingNames = useMemo(
    () => (tab === "local" ? files.map((f) => ({ filename: f.name })) : validLinks.map((l) => ({ filename: filenameFromUrl(l.url) }))),
    [tab, files, validLinks],
  );
  // Episodes already uploaded in this session but not yet written also hold numbers.
  const unwrittenNames = tasks.filter((t) => !t.written && !["error", "cancelled"].includes(t.state)).map((t) => ({ filename: t.filename }));
  const pendingPlan = useMemo(() => {
    if (!pendingNames.length) return null;
    return buildEpisodePlan({ existing: episodes, incoming: [...unwrittenNames, ...pendingNames], compactGaps });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingNames, episodes, compactGaps, unwrittenNames.length]);
  const pendingNumbers = useMemo(() => {
    if (!pendingPlan) return [] as number[];
    const news = pendingPlan.items.filter((it) => it.kind === "new");
    return news.slice(unwrittenNames.length).map((it) => it.assignedNumber);
  }, [pendingPlan, unwrittenNames.length]);

  const compactPlan: EpisodePlan | null = useMemo(
    () => (compactPreview ? buildEpisodePlan({ existing: episodes, incoming: [], compactGaps: true }) : null),
    [compactPreview, episodes],
  );
  const hasGaps = useMemo(() => seriesHasGaps(episodes.map((e) => e.number)), [episodes]);

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const picked = Array.from(list);
    const ok = picked.filter((f) => VIDEO_RE.test(f.name));
    if (!ok.length) {
      setError("请选择 mp4 / webm / mov 视频文件。");
      return;
    }
    setError(picked.length > ok.length ? `已忽略 ${picked.length - ok.length} 个不支持的文件。` : "");
    setFiles((prev) => {
      const keys = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...ok.filter((f) => !keys.has(f.name + f.size))];
    });
  }

  function fetchHeaders(): Record<string, string> | undefined {
    const out: Record<string, string> = {};
    for (const r of headerRows) if (r.k.trim() && r.v.trim()) out[r.k.trim()] = r.v.trim();
    return Object.keys(out).length ? out : undefined;
  }

  // ───────── running ─────────
  const runFile = useCallback(
    async (key: string) => {
      const t = tasksRef.current.find((x) => x.key === key);
      if (!t?.file) return;
      const ac = new AbortController();
      controllers.current.set(key, ac);
      patch(key, { state: "uploading", error: undefined, startedAt: Date.now(), sent: 0, percent: 0, speed: 0, eta: -1 });
      try {
        const out = await uploadFile(t.file, "video", {
          signal: ac.signal,
          partConcurrency: 2,
          onJobId: (id) => patch(key, { jobId: id }),
          onProgress: (p) =>
            patch(key, {
              state: p.phase === "finalizing" ? "finalizing" : "uploading",
              sent: p.sent,
              total: p.total,
              percent: p.total ? Math.round((p.sent / p.total) * 100) : 0,
              speed: p.phase === "finalizing" ? 0 : p.speed,
              eta: p.eta,
            }),
        });
        patch(key, { state: "done", percent: 100, publicUrl: out.url, finishedAt: Date.now(), speed: 0 });
      } catch (err) {
        const aborted = (err as Error).name === "AbortError";
        patch(key, {
          state: aborted ? "cancelled" : "error",
          error: aborted ? undefined : (err as Error).message || "上传失败",
          speed: 0,
          finishedAt: Date.now(),
        });
      } finally {
        controllers.current.delete(key);
      }
    },
    [patch],
  );

  const pumpRef = useRef<() => void>(() => {});
  const pump = useCallback(() => {
    const list = tasksRef.current;
    const free = fileConcurrency - startedRef.current.size;
    const next = list
      .filter((t) => t.source === "file" && t.state === "queued" && !startedRef.current.has(t.key))
      .reverse() // oldest first
      .slice(0, Math.max(0, free));
    for (const t of next) {
      startedRef.current.add(t.key);
      void runFile(t.key).finally(() => {
        startedRef.current.delete(t.key);
        pumpRef.current();
      });
    }
  }, [fileConcurrency, runFile]);
  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  const runLink = useCallback(
    async (key: string) => {
      const t = tasksRef.current.find((x) => x.key === key);
      if (!t?.url) return;
      patch(key, { state: "queued", phase: undefined, error: undefined, percent: 0, startedAt: Date.now(), seenAt: Date.now() });
      try {
        const out = await startRemoteFetch({ url: t.url, name: t.filename, headers: t.headers });
        patch(key, { jobId: out.id, ...(out.publicUrl ? { state: "done", publicUrl: out.publicUrl, percent: 100 } : {}) });
      } catch (err) {
        patch(key, { state: "error", error: (err as Error).message || "无法开始下载", finishedAt: Date.now() });
      }
    },
    [patch],
  );

  function start() {
    setError("");
    setMessage("");
    if (!studio.ready) {
      setError("R2 Studio 还没配置好，请先到「存储设置」填写 Key 并测试连接。");
      return;
    }
    if (tab === "local") {
      if (!files.length) return;
      const added: Task[] = files.map((f, i) => ({
        key: newKey(),
        source: "file",
        filename: f.name,
        file: f,
        episode: pendingNumbers[i],
        state: "queued",
        sent: 0,
        total: f.size,
        percent: 0,
        speed: 0,
        eta: -1,
      }));
      setTasks((prev) => [...added, ...prev]);
      setFiles([]);
      setTimeout(() => pumpRef.current(), 0);
    } else {
      if (!validLinks.length) return;
      const headers = fetchHeaders();
      const added: Task[] = validLinks.map((l, i) => ({
        key: newKey(),
        source: "link",
        filename: filenameFromUrl(l.url),
        url: l.url,
        headers,
        episode: pendingNumbers[i],
        state: "queued",
        sent: 0,
        total: 0,
        percent: 0,
        speed: 0,
        eta: -1,
      }));
      setTasks((prev) => [...added, ...prev]);
      setLinkText(badLinks.map((b) => b.url).join("\n"));
      setTimeout(() => added.forEach((t) => void runLink(t.key)), 0);
    }
  }

  // ───────── live progress for link imports: one SSE stream + polling fallback ─────────
  const watching = tasks.some((t) => t.source === "link" && t.jobId && !TERMINAL.includes(t.state));
  const applyJob = useCallback(
    (j: StudioJob) => {
      const t = tasksRef.current.find((x) => x.jobId === j.id && x.source === "link");
      if (!t || TERMINAL.includes(t.state)) return;
      const state = (j.state as TaskState) || t.state;
      const p: Partial<Task> = {
        state,
        phase: j.phase,
        seenAt: Date.now(),
        percent: j.percent != null ? Math.round(j.percent) : t.percent,
        speed: j.speed ?? 0,
        eta: j.eta ?? -1,
        sent: j.received ?? t.sent,
        total: j.size ?? t.total,
      };
      if (state === "done") {
        p.publicUrl = j.publicUrl || j.shortUrl;
        p.percent = 100;
        p.finishedAt = Date.now();
        if (!p.publicUrl) {
          p.state = "error";
          p.error = "下载完成，但没有返回访问地址";
        }
      }
      if (state === "error" || state === "cancelled") {
        p.error = state === "error" ? j.error || "下载失败" : undefined;
        p.finishedAt = Date.now();
      }
      patch(t.key, p);
    },
    [patch],
  );

  useEffect(() => {
    if (!watching) return;
    const es = new EventSource("/api/admin/r2s/events");
    const onUpload = (e: MessageEvent) => {
      try {
        const j = normalizeJob(JSON.parse(e.data));
        if (j) applyJob(j);
      } catch {
        /* ignore */
      }
    };
    const onSnapshot = (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data) as { uploads?: Record<string, unknown>[] };
        for (const raw of d.uploads || []) {
          const j = normalizeJob(raw);
          if (j) applyJob(j);
        }
      } catch {
        /* ignore */
      }
    };
    es.addEventListener("upload", onUpload);
    es.addEventListener("snapshot", onSnapshot);
    // The pool event is deliberately ignored: this page never shows or changes the storage pool.
    const poll = setInterval(async () => {
      const stale = tasksRef.current.filter(
        (t) => t.source === "link" && t.jobId && !TERMINAL.includes(t.state) && Date.now() - (t.seenAt || 0) > 4000,
      );
      for (const t of stale) {
        try {
          const res = await fetch(`/api/admin/r2s/uploads/${encodeURIComponent(t.jobId!)}`);
          if (!res.ok) continue;
          const j = normalizeJob({ ...(await res.json()), id: t.jobId });
          if (j) applyJob(j);
        } catch {
          /* ignore */
        }
      }
    }, 3000);
    return () => {
      es.close();
      clearInterval(poll);
    };
  }, [watching, applyJob]);

  // ───────── write finished uploads into episodes ─────────
  const anyActive = tasks.some((t) => !TERMINAL.includes(t.state));
  const unwritten = tasks.filter((t) => t.state === "done" && t.publicUrl && !t.written);

  const writeEpisodes = useCallback(async () => {
    const rows = tasksRef.current.filter((t) => t.state === "done" && t.publicUrl && !t.written);
    if (!rows.length) return;
    setWriting(true);
    setError("");
    // Oldest first so episode order follows the order they were added.
    const ordered = [...rows].reverse();
    const result = await applyEpisodePlan({
      seriesId,
      compactGaps,
      incoming: ordered.map((t) => ({ filename: t.filename, videoUrl: t.publicUrl! })),
    });
    setWriting(false);
    if (!result.ok) {
      setError(`写入分集失败：${result.message}`);
      return;
    }
    const keys = new Set(rows.map((r) => r.key));
    setTasks((prev) => prev.map((t) => (keys.has(t.key) ? { ...t, written: true } : t)));
    setMessage(`已写入 ${rows.length} 个分集。`);
    router.refresh();
  }, [compactGaps, router, seriesId, setTasks]);

  useEffect(() => {
    if (autoWrite && !anyActive && unwritten.length && !writing) void writeEpisodes();
  }, [autoWrite, anyActive, unwritten.length, writing, writeEpisodes]);

  // Warn before leaving while local files are still uploading (link imports continue on the server).
  const localActive = tasks.some((t) => t.source === "file" && !TERMINAL.includes(t.state));
  useEffect(() => {
    if (!localActive) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [localActive]);

  // ───────── row actions ─────────
  async function cancel(t: Task) {
    if (t.source === "file") {
      const ac = controllers.current.get(t.key);
      if (ac) ac.abort();
      else patch(t.key, { state: "cancelled" });
    } else {
      if (t.jobId) await cancelStudioJob(t.jobId);
      patch(t.key, { state: "cancelled", speed: 0, finishedAt: Date.now() });
    }
  }
  function retry(t: Task) {
    if (t.source === "file") {
      patch(t.key, { state: "queued", error: undefined, percent: 0, sent: 0 });
      setTimeout(() => pumpRef.current(), 0);
    } else {
      patch(t.key, { headers: fetchHeaders() ?? t.headers, jobId: undefined });
      setTimeout(() => void runLink(t.key), 0);
    }
  }
  const remove = (t: Task) => setTasks((prev) => prev.filter((x) => x.key !== t.key));
  const clearFinished = () => setTasks((prev) => prev.filter((t) => !(t.state === "done" && t.written) && t.state !== "cancelled"));

  // ───────── derived ─────────
  const counts = {
    all: tasks.length,
    active: tasks.filter((t) => ACTIVE.includes(t.state)).length,
    queued: tasks.filter((t) => t.state === "queued").length,
    done: tasks.filter((t) => t.state === "done").length,
    error: tasks.filter((t) => t.state === "error").length,
  };
  const totalSpeed = tasks.reduce((a, t) => a + (ACTIVE.includes(t.state) ? t.speed || 0 : 0), 0);
  const shown = tasks.filter((t) =>
    filter === "all" ? true : filter === "active" ? ACTIVE.includes(t.state) : t.state === filter,
  );
  const canStart = studio.ready && (tab === "local" ? files.length > 0 : validLinks.length > 0);

  return (
    <section className="mt-8" data-batch-upload="true">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium">分集上传</h2>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: !studio.loaded ? "#c9cdd4" : studio.ready ? "#00b42a" : "#f53f3f" }}
          />
          {!studio.loaded ? "正在检查 R2 Studio…" : studio.ready ? "R2 Studio 已连接" : "R2 Studio 未就绪，请到「存储设置」配置"}
        </div>
      </div>

      <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
        {/* ───────── left: add ───────── */}
        <div className="admin-card p-5">
          <h3 className="font-medium">添加视频</h3>
          <p className="mt-1 text-xs text-muted">文件写入 R2 Studio，完成后按集号写入分集。存储池由 R2 Studio 管理，本页不做改动。</p>

          <div className="mt-4 flex gap-6 border-b text-sm" style={{ borderColor: "var(--admin-border)" }}>
            {(["local", "link"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`-mb-px border-b-2 pb-2.5 ${tab === k ? "font-medium text-gold" : "border-transparent text-muted"}`}
                style={tab === k ? { borderColor: "var(--color-gold)" } : undefined}
              >
                {k === "local" ? "本地上传" : "从链接导入"}
              </button>
            ))}
          </div>

          {tab === "local" ? (
            <div className="mt-4">
              <div
                className="rounded-xl border border-dashed p-7 text-center"
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
                <p className="text-sm">
                  把视频拖到这里，或{" "}
                  <button type="button" className="text-gold underline-offset-2 hover:underline" onClick={() => inputRef.current?.click()}>
                    点击选择文件
                  </button>
                </p>
                <p className="mt-1.5 text-xs text-muted">支持 mp4 / webm / mov，可多选；按 8MB 分片上传，大文件也不占服务器内存。中断后重新选择同一个文件会续传。</p>
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
              </div>

              {files.length ? (
                <ul className="mt-3 divide-y rounded-lg border text-sm" style={{ borderColor: "var(--admin-border)" }}>
                  {files.map((f, i) => (
                    <li key={f.name + f.size} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="truncate">{f.name}</span>
                      <span className="flex shrink-0 items-center gap-3 text-xs text-muted">
                        {pendingNumbers[i] ? `第 ${pendingNumbers[i]} 集 · ` : ""}
                        {formatBytes(f.size)}
                        <button type="button" className="text-danger" onClick={() => setFiles((p) => p.filter((x) => x !== f))}>
                          移除
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <label className="label mt-4">同时上传</label>
              <select className="input" value={fileConcurrency} onChange={(e) => setFileConcurrency(Number(e.target.value))}>
                <option value={1}>1 个文件</option>
                <option value={2}>2 个文件（推荐）</option>
                <option value={3}>3 个文件</option>
              </select>
            </div>
          ) : (
            <div className="mt-4">
              <label className="label">视频链接（每行一个，仅限 http/https 公网地址）</label>
              <textarea
                className="input min-h-[120px] font-mono text-xs leading-6"
                placeholder={"https://cdn.example.com/drama/ep01.mp4\nhttps://cdn.example.com/drama/ep02.mp4"}
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
              />
              <div className="mt-1.5 flex justify-between gap-3 text-xs text-muted">
                <span>
                  {validLinks.length ? `已识别 ${validLinks.length} 个链接` : "粘贴链接后自动识别"}
                  {pendingNumbers.length ? ` · 第 ${pendingNumbers[0]}${pendingNumbers.length > 1 ? `–${pendingNumbers[pendingNumbers.length - 1]}` : ""} 集` : ""}
                </span>
                <span>服务器直接下载，不经过你的电脑</span>
              </div>
              {badLinks.length ? (
                <p className="mt-1 text-xs text-danger">
                  {badLinks.length} 行无法使用：{badLinks[0].message}
                </p>
              ) : null}

              <div className="mt-3 rounded-lg p-3" style={{ background: "color-mix(in srgb, var(--admin-border) 35%, transparent)" }}>
                <button type="button" className="text-sm text-muted" onClick={() => setShowAdv((v) => !v)}>
                  高级选项 {showAdv ? "▴" : "▾"}
                </button>
                {showAdv ? (
                  <div className="mt-3">
                    <p className="text-xs text-muted">保存到 lumereel/videos/，自动加日期和随机前缀，不会覆盖已有文件。</p>
                    <p className="mt-3 text-xs text-muted">源站请求头（防盗链时填写，最多 10 个）</p>
                    {headerRows.map((r, i) => (
                      <div key={i} className="mt-1.5 flex gap-2">
                        <input
                          className="input w-32"
                          value={r.k}
                          placeholder="名称"
                          onChange={(e) => setHeaderRows((p) => p.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))}
                        />
                        <input
                          className="input flex-1"
                          value={r.v}
                          placeholder="值，例如 https://cdn.example.com/"
                          onChange={(e) => setHeaderRows((p) => p.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setHeaderRows((p) => (p.length > 1 ? p.filter((_, j) => j !== i) : [{ k: "", v: "" }]))}
                        >
                          －
                        </button>
                      </div>
                    ))}
                    {headerRows.length < 10 ? (
                      <button type="button" className="mt-2 text-xs text-gold" onClick={() => setHeaderRows((p) => [...p, { k: "", v: "" }])}>
                        ＋ 添加请求头
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <p className="mt-3 rounded-md border px-3 py-2 text-xs text-gold" style={{ borderColor: "var(--admin-border)" }}>
                R2 Studio 同时下载 3 个，其余排队；关掉页面也不会中断。
              </p>
            </div>
          )}

          <label className="mt-4 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={compactGaps} onChange={(e) => setCompactGaps(e.target.checked)} />
            <span>
              遇到缺集时用下一集前移补齐
              <span className="block text-xs text-muted">例如已有 1–4、6–9 集，6→5、7→6……免费集数仍按前 {freeEpisodeCount} 集同步。</span>
            </span>
          </label>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={autoWrite} onChange={(e) => setAutoWrite(e.target.checked)} />
              全部完成后自动写入分集
            </label>
            <div className="flex gap-2">
              {tab === "local" && files.length ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFiles([])}>
                  清空
                </button>
              ) : null}
              <button type="button" className="btn btn-gold btn-sm" disabled={!canStart} onClick={start}>
                {tab === "local"
                  ? files.length
                    ? `开始上传 ${files.length} 个文件`
                    : "开始上传"
                  : validLinks.length
                    ? `开始导入 ${validLinks.length} 个链接`
                    : "开始导入"}
              </button>
            </div>
          </div>

          {hasGaps ? (
            <div className="mt-5 border-t pt-4 text-xs" style={{ borderColor: "var(--admin-border)" }}>
              <div className="flex items-center justify-between">
                <span className="text-muted">已有分集存在缺号。</span>
                <button type="button" className="btn btn-outline-gold btn-sm" onClick={() => setCompactPreview((v) => !v)}>
                  {compactPreview ? "收起" : "补齐缺集"}
                </button>
              </div>
              {compactPlan ? (
                <div className="mt-3">
                  <p className="text-muted">缺：{compactPlan.missingNumbers.join("、")}。确认后只调整集号，不删除视频。</p>
                  <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
                    {compactPlan.items
                      .filter((it) => it.shifted)
                      .map((it) => (
                        <li key={it.id}>
                          第 {it.originalNumber} 集 → 第 {it.assignedNumber} 集
                        </li>
                      ))}
                  </ul>
                  <button
                    type="button"
                    className="btn btn-gold btn-sm mt-3"
                    disabled={writing || anyActive}
                    onClick={async () => {
                      setWriting(true);
                      const r = await applyEpisodePlan({ seriesId, compactGaps: true, incoming: [] });
                      setWriting(false);
                      if (!r.ok) setError(r.message);
                      else {
                        setMessage(r.message);
                        setCompactPreview(false);
                        router.refresh();
                      }
                    }}
                  >
                    确认补齐
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {message ? <p className="mt-3 text-sm text-gold">{message}</p> : null}
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        </div>

        {/* ───────── right: queue ───────── */}
        <div className="admin-card min-w-0 p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
            <h3 className="font-medium">上传任务</h3>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(
                [
                  ["all", "全部"],
                  ["active", "进行中"],
                  ["queued", "排队"],
                  ["done", "已完成"],
                  ["error", "失败"],
                ] as [Filter, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className={`rounded-full px-2.5 py-1 ${filter === k ? "text-gold" : "text-muted"}`}
                  style={{
                    background: filter === k ? "color-mix(in srgb, var(--color-gold) 12%, transparent)" : "color-mix(in srgb, var(--admin-border) 45%, transparent)",
                  }}
                >
                  {label} {counts[k]}
                </button>
              ))}
              <button type="button" className="btn btn-ghost btn-sm ml-1" onClick={clearFinished} disabled={!tasks.length}>
                清除已完成
              </button>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-3 px-5 pt-4">
            {[
              ["总速度", `${formatBytes(totalSpeed)}/s`, ""],
              ["进行中", counts.active, ""],
              ["排队", counts.queued, ""],
              ["已完成", counts.done, "#00b42a"],
              ["失败", counts.error, "#f53f3f"],
            ].map(([l, v, c]) => (
              <div key={String(l)} className="rounded-lg px-3 py-2.5" style={{ background: "color-mix(in srgb, var(--admin-border) 30%, transparent)" }}>
                <div className="text-xs text-muted">{l}</div>
                <div className="mt-0.5 whitespace-nowrap text-lg font-semibold" style={c ? { color: String(c) } : undefined}>
                  {v}
                </div>
              </div>
            ))}
          </div>

          {shown.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="text-xs text-muted">
                    <th className="px-5 py-2 font-medium">文件 / 来源</th>
                    <th className="px-3 py-2 font-medium">集号</th>
                    <th className="px-3 py-2 font-medium">状态</th>
                    <th className="px-3 py-2 font-medium">进度</th>
                    <th className="px-3 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((t) => {
                    const unknownSize = t.source === "link" && t.state === "uploading" && t.phase === "downloading" && !t.total;
                    const barColor = t.state === "finalizing" ? DOT.finalizing : t.state === "error" ? DOT.error : t.state === "done" ? DOT.done : t.source === "link" ? "#722ed1" : DOT.uploading;
                    return (
                      <tr key={t.key} className="border-t align-middle" style={{ borderColor: "var(--admin-border)" }}>
                        <td className="max-w-[260px] px-5 py-3">
                          <div className="truncate font-medium">{t.filename}</div>
                          <div className="mt-0.5 truncate text-xs text-muted">
                            <span
                              className="mr-1.5 rounded px-1.5 py-px"
                              style={{
                                background: t.source === "file" ? "rgba(22,119,255,.18)" : "rgba(114,46,209,.22)",
                                color: t.source === "file" ? "#69b1ff" : "#b37feb",
                              }}
                            >
                              {t.source === "file" ? "本地" : "链接"}
                            </span>
                            {t.source === "file" ? formatBytes(t.total) : t.url?.replace(/^https?:\/\//, "")}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">{t.episode ? `第 ${t.episode} 集` : "—"}</td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            <i className="inline-block h-[7px] w-[7px] rounded-full" style={{ background: DOT[t.state] }} />
                            {stateLabel(t)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {t.state === "error" ? (
                            <span className="text-xs text-danger">{friendlyError(t.error)}</span>
                          ) : t.state === "done" ? (
                            <div>
                              <a href={t.publicUrl} target="_blank" rel="noreferrer" title={t.publicUrl} className="block max-w-[200px] truncate font-mono text-xs text-gold">
                                {t.publicUrl?.split("/").pop()}
                              </a>
                              <div className="mt-0.5 text-xs text-muted">
                                {t.written ? "已写入分集" : autoWrite ? "等待其余任务完成后写入分集" : "尚未写入分集"}
                                {t.startedAt && t.finishedAt ? ` · 用时 ${Math.max(1, Math.round((t.finishedAt - t.startedAt) / 1000))} 秒` : ""}
                              </div>
                            </div>
                          ) : t.state === "cancelled" ? (
                            <span className="text-xs text-muted">已取消{t.source === "file" ? "，远端分片已清理" : ""}</span>
                          ) : (
                            <div>
                              <div className="h-1.5 w-full max-w-[280px] overflow-hidden rounded-full bg-black/10">
                                {unknownSize ? (
                                  <div className="h-full w-1/3 animate-pulse rounded-full" style={{ background: barColor }} />
                                ) : (
                                  <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${t.state === "finalizing" ? 100 : t.percent}%`, background: barColor }} />
                                )}
                              </div>
                              <div className="mt-1 whitespace-nowrap text-xs text-muted">
                                {t.state === "queued"
                                  ? t.source === "link"
                                    ? "等待空闲下载位（同时最多 3 个）"
                                    : "等待上传"
                                  : t.state === "finalizing"
                                    ? "100% · 正在合并分片…"
                                    : unknownSize
                                      ? `已收到 ${formatBytes(t.sent)} · 源站未给大小 · ${formatBytes(t.speed)}/s · 剩余时间未知`
                                      : `${t.percent}%${t.total ? ` · ${formatBytes(t.sent)} / ${formatBytes(t.total)}` : ""}${t.source === "link" && t.phase === "uploading" ? " · 写入存储" : ""} · ${formatBytes(t.speed)}/s · ${formatEta(t.eta)}`}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs">
                          {t.state === "queued" && t.source === "file" ? (
                            <button type="button" className="text-gold" onClick={() => remove(t)}>
                              移除
                            </button>
                          ) : null}
                          {(t.state === "uploading" || (t.state === "queued" && t.source === "link")) ? (
                            <button type="button" className="text-gold" onClick={() => cancel(t)}>
                              取消
                            </button>
                          ) : null}
                          {t.state === "finalizing" ? <span className="text-muted">—</span> : null}
                          {t.state === "error" || t.state === "cancelled" ? (
                            <span className="space-x-3">
                              {t.source === "link" || t.file ? (
                                <button type="button" className="text-gold" onClick={() => retry(t)}>
                                  重试
                                </button>
                              ) : null}
                              <button type="button" className="text-gold" onClick={() => remove(t)}>
                                移除
                              </button>
                            </span>
                          ) : null}
                          {t.state === "done" ? (
                            <span className="space-x-3">
                              <button type="button" className="text-gold" onClick={() => navigator.clipboard?.writeText(t.publicUrl || "")}>
                                复制链接
                              </button>
                              <a className="text-gold" href={t.publicUrl} target="_blank" rel="noreferrer">
                                预览
                              </a>
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-12 text-center text-sm text-muted">{tasks.length ? "这个筛选下没有任务。" : "还没有任务。添加视频后点击开始。"}</p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-xs text-muted">
            <span>进度实时推送；失败和取消的任务不会写入分集。</span>
            {!autoWrite && unwritten.length ? (
              <button type="button" className="btn btn-gold btn-sm" disabled={writing || anyActive} onClick={writeEpisodes}>
                {writing ? "正在写入…" : `写入 ${unwritten.length} 个分集`}
              </button>
            ) : writing ? (
              <span className="text-gold">正在写入分集…</span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
