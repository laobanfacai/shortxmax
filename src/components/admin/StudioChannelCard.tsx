"use client";

import { useEffect, useState } from "react";
import { formatStorageBytes } from "@/lib/storage-capacity";
import type { R2StudioPool, R2StudioPublicStatus } from "@/lib/r2-studio-types";

export type StudioStatus = R2StudioPublicStatus & { pool?: R2StudioPool | null; message?: string };

export function useStudioStatus() {
  const [status, setStatus] = useState<StudioStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/r2s/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled) {
          setStatus(j);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return { status, loaded, ready: Boolean(status?.studioReady && status?.activeTarget === "r2studio") };
}

export function StudioChannelCard({ compact }: { compact?: boolean }) {
  const { status, loaded, ready } = useStudioStatus();
  if (!loaded) {
    return <p className="mt-3 text-xs text-muted">正在读取 R2 Studio 通道状态…</p>;
  }
  const pool = status?.pool;
  const used = pool && typeof pool.totalUsed === "number" ? formatStorageBytes(pool.totalUsed) : null;
  const cap = pool && typeof pool.totalCapacity === "number" ? formatStorageBytes(pool.totalCapacity) : null;
  const members = pool?.members || [];

  if (!ready) {
    return (
      <div className="mt-3 rounded-xl border p-3 text-sm" style={{ borderColor: "var(--admin-border)" }} data-studio-channel="missing">
        <p className="font-medium">上传通道：R2 Studio（尚未就绪）</p>
        <p className="mt-1 text-xs text-danger">
          请到{" "}
          <a className="text-gold" href="/admin/storage">
            存储设置
          </a>{" "}
          填写以 <code>r2s_</code> 开头的 API Key 并测试连接。没有 Key 时不会改走官方桶直传，也不会写入本机磁盘。
        </p>
      </div>
    );
  }

  return (
    <div
      className="mt-3 rounded-xl border p-3 text-sm"
      style={{ borderColor: "var(--color-gold)" }}
      data-studio-channel="ready"
    >
      <p className="font-medium">上传通道：R2 Studio</p>
      <p className="mt-1 text-xs text-muted">
        文件经本站代理传到 {status?.baseUrl || "https://r2.open-traffic.com"}，由 Studio 决定写入存储池中的哪个桶。不会直连官方 R2 凭证。
      </p>
      {!compact && used ? (
        <p className="mt-1 text-xs text-muted">
          存储池用量 {used}
          {cap ? ` / ${cap}` : ""}
        </p>
      ) : null}
      {!compact && members.length ? (
        <ul className="mt-1 text-xs text-muted">
          {members.map((m, i) => (
            <li key={m.name + i}>
              成员 {m.name}
              {typeof m.usedBytes === "number" ? ` · 已用 ${formatStorageBytes(m.usedBytes)}` : ""}
              {typeof m.capacityBytes === "number" ? ` / ${formatStorageBytes(m.capacityBytes)}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {compact && used ? (
        <p className="mt-1 text-xs text-muted">
          存储池 {used}
          {cap ? ` / ${cap}` : ""}
        </p>
      ) : null}
    </div>
  );
}
