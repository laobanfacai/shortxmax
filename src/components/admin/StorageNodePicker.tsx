"use client";

import { useEffect, useState } from "react";
import {
  STORAGE_ENDPOINT_PREF_KEY,
  checkBatchFits,
  formatStorageBytes,
  selectDefaultNodeId,
  type AdminStorageNode,
} from "@/lib/storage-capacity";

export function useStorageNodes() {
  const [nodes, setNodes] = useState<AdminStorageNode[]>([]);
  const [defaultNodeId, setDefaultNodeId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/storage/nodes")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        const list = Array.isArray(j?.nodes) ? (j.nodes as AdminStorageNode[]) : [];
        const fallback = String(j?.defaultNodeId || "");
        let pref = "";
        try {
          pref = window.localStorage.getItem(STORAGE_ENDPOINT_PREF_KEY) || "";
        } catch {
          pref = "";
        }
        setNodes(list);
        setDefaultNodeId(fallback);
        setSelectedId(selectDefaultNodeId(list, pref, fallback));
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function select(id: string) {
    const node = nodes.find((n) => n.id === id);
    if (!node?.selectable) return;
    setSelectedId(id);
    try {
      window.localStorage.setItem(STORAGE_ENDPOINT_PREF_KEY, id);
    } catch {
      /* ignore quota / private mode */
    }
  }

  const selected = nodes.find((n) => n.id === selectedId && n.selectable) || null;
  const selectableCount = nodes.filter((n) => n.selectable).length;
  return { nodes, defaultNodeId, selectedId, selected, select, loaded, selectableCount };
}

function usageLine(node: AdminStorageNode) {
  const u = node.usage;
  if (!u) return "用量暂不可用（不影响选择；空间不足时会停止并说明原因）";
  const used = formatStorageBytes(u.usedBytes);
  if (u.remainingBytes != null) {
    return `已用 ${used} · 剩余 ${formatStorageBytes(u.remainingBytes)}${u.complete ? "" : "（扫描未完成，已用为下限）"}`;
  }
  if (u.capacityBytes != null) {
    return `已用 ${used} / ${formatStorageBytes(u.capacityBytes)}`;
  }
  return `已用 ${used}${u.complete ? "" : "（扫描未完成，已用为下限）"}`;
}

export function StorageNodePicker({
  nodes,
  selectedId,
  onSelect,
  disabled,
  compact,
}: {
  nodes: AdminStorageNode[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  if (!nodes.length) {
    return <p className="mt-3 text-sm text-danger">还没有存储配置。请先到「存储设置」导入并测试节点。</p>;
  }
  const selectable = nodes.filter((n) => n.selectable);
  const blocked = nodes.filter((n) => !n.selectable);
  if (compact) {
    return (
      <div className="mt-2" data-storage-picker="compact">
        <label className="label">存储配置</label>
        <select
          className="input"
          value={selectedId}
          disabled={disabled || selectable.length === 0}
          onChange={(e) => onSelect(e.target.value)}
        >
          {selectable.length === 0 ? <option value="">没有可用配置</option> : null}
          {selectable.map((node) => (
            <option key={node.id} value={node.id}>
              {node.label}
              {node.isDefault ? "（默认）" : ""} · {node.kindLabel} · 桶 {node.bucket}
            </option>
          ))}
        </select>
        {blocked.length ? (
          <p className="mt-1 text-xs text-muted">
            {blocked.length} 个配置不可用：{blocked.map((n) => `${n.label}（${n.disabledReason || "已停用"}）`).join("；")}
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <div className="mt-3 space-y-2" data-storage-picker="true">
      <p className="text-xs text-muted">
        存储配置：这一批只会传到你选中的节点，中途失败不会自动换到其他配置。灰色项不可选。
      </p>
      <div className="grid gap-2">
        {nodes.map((node) => {
          const active = node.selectable && node.id === selectedId;
          return (
            <label
              key={node.id}
              data-storage-node={node.label}
              data-selectable={node.selectable ? "1" : "0"}
              className="flex items-start gap-3 rounded-xl border p-3 text-sm"
              style={{
                borderColor: active ? "var(--color-gold)" : "var(--admin-border)",
                opacity: node.selectable ? 1 : 0.55,
                cursor: node.selectable && !disabled ? "pointer" : "not-allowed",
                background: active ? "color-mix(in srgb, var(--color-gold) 8%, transparent)" : "transparent",
              }}
            >
              <input
                type="radio"
                className="mt-1"
                name="storage-endpoint"
                value={node.id}
                checked={active}
                disabled={!node.selectable || disabled}
                onChange={() => onSelect(node.id)}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {node.label}
                  {node.isDefault ? <span className="text-xs font-normal text-gold">默认</span> : null}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {node.kindLabel} · 桶 {node.bucket || "未填"}
                </span>
                {node.selectable ? (
                  <span className="mt-0.5 block text-xs text-muted">{usageLine(node)}</span>
                ) : (
                  <span className="mt-0.5 block text-xs text-danger">{node.disabledReason || "不可用"}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function capacityWarning(totalBytes: number, node: AdminStorageNode | null) {
  if (!node) return "请先选择一个可用的存储配置。没有可用节点时不能开始上传。";
  const fit = checkBatchFits(totalBytes, node.usage);
  return fit.ok ? "" : fit.message || "";
}
