"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { R2StudioPool, R2StudioPublicStatus } from "@/lib/r2-studio-types";

type UploadRow = {
  id?: string;
  state?: string;
  percent?: number;
  speed?: number;
  eta?: number;
  accountName?: string;
  key?: string;
  size?: number;
  received?: number;
  error?: string;
  publicUrl?: string;
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

function formatSpeed(bps?: number) {
  if (bps == null || !Number.isFinite(bps) || bps < 0) return "—";
  return `${formatBytes(bps)}/s`;
}

function formatEta(seconds?: number) {
  if (seconds == null || seconds < 0 || !Number.isFinite(seconds)) return "未知";
  const s = Math.round(seconds);
  if (s < 60) return `约 ${s} 秒`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r ? `约 ${m} 分 ${r} 秒` : `约 ${m} 分钟`;
  return `约 ${Math.floor(m / 60)} 小时 ${m % 60} 分`;
}

function memberLabel(m: unknown, i: number) {
  if (!m || typeof m !== "object") return `节点 ${i + 1}`;
  const o = m as Record<string, unknown>;
  const name = String(o.name || o.label || o.accountName || o.id || `节点 ${i + 1}`);
  const used = typeof o.used === "number" ? o.used : typeof o.totalUsed === "number" ? o.totalUsed : null;
  const cap = typeof o.capacity === "number" ? o.capacity : typeof o.totalCapacity === "number" ? o.totalCapacity : null;
  return cap != null ? `${name} · ${formatBytes(used || 0)} / ${formatBytes(cap)}` : name;
}

export function R2StudioPanel({ initial }: { initial: R2StudioPublicStatus }) {
  const [status, setStatus] = useState(initial);
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [pool, setPool] = useState<R2StudioPool | null>(null);
  const [uploads, setUploads] = useState<Record<string, UploadRow>>({});
  const [streamState, setStreamState] = useState<"off" | "on" | "error">("off");
  const esRef = useRef<EventSource | null>(null);

  const keyLabel = status.keyFromEnv ? "已由环境变量配置" : status.keyConfigured ? "已保存在服务器" : "尚未填写";

  const jsonPost = useCallback(async (url: string, body: Record<string, unknown>) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      message?: string;
      error?: string;
      pool?: R2StudioPool;
    } & Partial<R2StudioPublicStatus>;
    return { res, data };
  }, []);

  const payload = useCallback(() => {
    const body: Record<string, unknown> = { baseUrl };
    if (apiKey.trim()) body.apiKey = apiKey.trim();
    return body;
  }, [apiKey, baseUrl]);

  const applyStatus = useCallback((data: Partial<R2StudioPublicStatus>) => {
    setStatus((prev) => ({
      ...prev,
      baseUrl: data.baseUrl ?? prev.baseUrl,
      keyConfigured: data.keyConfigured ?? prev.keyConfigured,
      keyFromEnv: data.keyFromEnv ?? prev.keyFromEnv,
      enabled: data.enabled ?? prev.enabled,
      storageMode: data.storageMode ?? prev.storageMode,
      testedAt: data.testedAt ?? prev.testedAt,
      lastError: data.lastError ?? prev.lastError,
      activeTarget: data.activeTarget ?? prev.activeTarget,
      studioReady: data.studioReady ?? prev.studioReady,
      r2Ready: data.r2Ready ?? prev.r2Ready,
      r2NodeCount: data.r2NodeCount ?? prev.r2NodeCount,
      ready: data.ready ?? prev.ready,
    }));
  }, []);

  async function onTest() {
    setBusy("test");
    setFlash(null);
    try {
      const { res, data } = await jsonPost("/api/admin/r2s/test", payload());
      if (data.pool) setPool(data.pool);
      setFlash({ ok: Boolean(data.ok && res.ok), text: data.message || data.error || "测试完成" });
      applyStatus(data);
    } catch {
      setFlash({ ok: false, text: "测试请求失败，请稍后重试。" });
    } finally {
      setBusy(null);
    }
  }

  async function onSave() {
    setBusy("save");
    setFlash(null);
    try {
      const { res, data } = await jsonPost("/api/admin/r2s/save", payload());
      setFlash({ ok: Boolean(data.ok && res.ok), text: data.message || data.error || "已保存" });
      applyStatus(data);
      if (data.ok) setApiKey("");
    } catch {
      setFlash({ ok: false, text: "保存失败，请稍后重试。" });
    } finally {
      setBusy(null);
    }
  }

  async function onEnable(enable: boolean) {
    setBusy(enable ? "enable" : "disable");
    setFlash(null);
    try {
      const { res, data } = await jsonPost("/api/admin/r2s/enable", { ...payload(), enable });
      if (data.pool) setPool(data.pool);
      setFlash({ ok: Boolean(data.ok && res.ok), text: data.message || data.error || (enable ? "已启用" : "已停用") });
      applyStatus(data);
      if (data.ok && enable) setApiKey("");
    } catch {
      setFlash({ ok: false, text: enable ? "启用失败，请稍后重试。" : "停用失败，请稍后重试。" });
    } finally {
      setBusy(null);
    }
  }

  const canStream = status.keyConfigured || Boolean(apiKey.trim());

  useEffect(() => {
    if (!status.keyConfigured) {
      esRef.current?.close();
      esRef.current = null;
      setStreamState("off");
      return;
    }
    const es = new EventSource("/api/admin/r2s/events");
    esRef.current = es;
    const onSnap = (e: MessageEvent) => {
      try {
        const j = JSON.parse(e.data) as { pool?: R2StudioPool; uploads?: UploadRow[] | Record<string, UploadRow> };
        if (j.pool) setPool(j.pool);
        if (Array.isArray(j.uploads)) {
          const map: Record<string, UploadRow> = {};
          j.uploads.forEach((u, i) => {
            map[String(u.id || i)] = u;
          });
          setUploads(map);
        } else if (j.uploads && typeof j.uploads === "object") {
          setUploads(j.uploads as Record<string, UploadRow>);
        }
        setStreamState("on");
      } catch {
        /* ignore malformed events */
      }
    };
    const onUpload = (e: MessageEvent) => {
      try {
        const j = JSON.parse(e.data) as UploadRow;
        const id = String(j.id || j.key || `tmp-${Date.now()}`);
        setUploads((prev) => ({ ...prev, [id]: { ...prev[id], ...j, id } }));
        setStreamState("on");
      } catch {
        /* ignore */
      }
    };
    const onPool = (e: MessageEvent) => {
      try {
        setPool(JSON.parse(e.data) as R2StudioPool);
        setStreamState("on");
      } catch {
        /* ignore */
      }
    };
    es.addEventListener("snapshot", onSnap);
    es.addEventListener("upload", onUpload);
    es.addEventListener("pool", onPool);
    es.onerror = () => setStreamState("error");
    es.onopen = () => setStreamState("on");
    return () => {
      es.removeEventListener("snapshot", onSnap as EventListener);
      es.removeEventListener("upload", onUpload as EventListener);
      es.removeEventListener("pool", onPool as EventListener);
      es.close();
      esRef.current = null;
    };
  }, [status.keyConfigured]);

  const rows = useMemo(() => Object.values(uploads).sort((a, b) => String(b.id).localeCompare(String(a.id))), [uploads]);
  const members = Array.isArray(pool?.members) ? pool!.members! : [];

  async function cancel(id?: string) {
    if (!id) return;
    await fetch(`/api/admin/r2s/uploads/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  return (
    <section className="admin-card mt-6 space-y-4 p-5">
      <div>
        <h2 className="text-lg font-medium">R2 Studio</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          在{" "}
          <a className="text-gold" href="https://r2.open-traffic.com" target="_blank" rel="noreferrer">
            R2 Studio
          </a>{" "}
          创建一个<strong>带上传权限</strong>的 API Key（以 <code>r2s_</code> 开头），填到本页。先点「测试连接」，成功后再启用。
          这是网站唯一的上传通道。测试只会读取存储池信息，不会写入或删除文件。密钥只保存在服务器（也可写在环境变量 <code>R2_STUDIO_API_KEY</code>），不会出现在前端页面或日志里。已导入的官方桶记录不会被当成直传目标。
        </p>
        <p className="mt-2 text-xs text-muted">
          当前：{status.activeTarget === "r2studio" && status.ready
            ? "新上传走 R2 Studio，由 Studio 决定写入存储池中的哪个桶"
            : "R2 Studio 尚未就绪。请填写以 r2s_ 开头的 Key 并测试连接。没有 Key 时不会改走官方桶直传，也不会写入本机磁盘。"}
          {" · "}
          Key {keyLabel}
          {streamState === "on" ? " · 实时事件已连接" : streamState === "error" && status.keyConfigured ? " · 实时事件未连上（不影响保存配置）" : null}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="label">Base URL</label>
          <input
            className="input"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://r2.open-traffic.com"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="label">API Key（{keyLabel}，留空则不修改）</label>
          <input
            className="input"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={status.keyConfigured ? "已保存，如需更换请粘贴新 Key" : "r2s_ 开头，在 R2 Studio 创建"}
            autoComplete="new-password"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button className="btn btn-outline-gold btn-md" type="button" onClick={onTest} disabled={Boolean(busy)}>
          {busy === "test" ? "正在测试…" : "测试连接"}
        </button>
        <button className="btn btn-ghost btn-md" type="button" onClick={onSave} disabled={Boolean(busy)}>
          {busy === "save" ? "保存中…" : "仅保存配置"}
        </button>
        {status.ready && status.activeTarget === "r2studio" ? (
          <button className="btn btn-ghost btn-md" type="button" onClick={() => onEnable(false)} disabled={Boolean(busy)}>
            {busy === "disable" ? "处理中…" : "停用 R2 Studio 通道（不会改回本地磁盘）"}
          </button>
        ) : (
          <button className="btn btn-gold btn-md" type="button" onClick={() => onEnable(true)} disabled={Boolean(busy)}>
            {busy === "enable" ? "正在启用…" : "测试成功后开始使用 R2 Studio"}
          </button>
        )}
      </div>
      {flash ? (
        <p className={`text-sm ${flash.ok ? "text-gold" : "text-danger"}`}>{flash.text}</p>
      ) : status.lastError && !status.enabled ? (
        <p className="text-sm text-danger">{status.lastError}</p>
      ) : null}

      <div className="rounded-xl border p-4" style={{ borderColor: "var(--admin-border)" }}>
        <h3 className="text-sm font-medium">存储池</h3>
        {pool ? (
          <div className="mt-2 space-y-1 text-sm">
            <p>
              用量 {formatBytes(pool.totalUsed)}
              {pool.totalCapacity != null ? ` / ${formatBytes(pool.totalCapacity)}` : ""}
              {pool.target != null && String(pool.target) ? ` · 目标 ${String(pool.target)}` : ""}
            </p>
            {members.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted">
                {members.map((m, i) => (
                  <li key={i}>{memberLabel(m, i)}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">暂无成员明细。测试连接或启用后，这里会随实时事件更新。</p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">
            {status.keyConfigured
              ? "等待实时事件或先点「测试连接」，即可看到用量和成员。"
              : "填写并测试 Key 之后，这里会显示存储池用量、容量和成员。"}
          </p>
        )}
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: "var(--admin-border)" }}>
        <h3 className="text-sm font-medium">实时上传进度</h3>
        <p className="mt-1 text-xs text-muted">
          进度、速率、剩余时间和当前写入账号会在上传时自动刷新。浏览器只连接本站代理，Key 不会放进 EventSource 地址。
        </p>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-muted">当前没有上传任务。在剧集封面或分集视频处上传后，进度会出现在这里。</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {rows.map((u) => {
              const pct = Math.max(0, Math.min(100, Number(u.percent) || 0));
              const state = u.state || "queued";
              return (
                <li key={u.id} className="rounded-lg border p-3" style={{ borderColor: "var(--admin-border)" }}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{STATE_LABEL[state] || state}</span>
                    {u.accountName ? <span className="text-xs text-muted">写入账号：{u.accountName}</span> : null}
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10">
                    <div className="h-full rounded-full bg-[var(--color-gold)]" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {pct.toFixed(0)}% · {formatSpeed(u.speed)} · 剩余 {formatEta(u.eta)}
                    {u.received != null && u.size ? ` · ${formatBytes(u.received)} / ${formatBytes(u.size)}` : null}
                  </p>
                  {u.key ? <p className="mt-1 truncate text-xs text-muted">{u.key}</p> : null}
                  {u.error ? <p className="mt-1 text-xs text-danger">{u.error}</p> : null}
                  {state === "uploading" || state === "queued" || state === "finalizing" ? (
                    <button type="button" className="mt-2 text-xs text-gold" onClick={() => cancel(u.id)}>
                      取消上传
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {!canStream ? <p className="mt-2 text-xs text-muted">配置好 Key 后会自动尝试订阅全局事件。</p> : null}
      </div>
    </section>
  );
}
