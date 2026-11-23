/** Pure helpers for admin storage-node selection. No credentials here. */

export const STORAGE_ENDPOINT_PREF_KEY = "shortxmax.admin.storageEndpointId";

export type AdminStorageUsage = {
  usedBytes: number;
  capacityBytes: number | null;
  remainingBytes: number | null;
  complete: boolean;
  checkedAt?: string;
};

export type AdminStorageNode = {
  id: string;
  label: string;
  provider: string;
  kindLabel: string;
  bucket: string;
  isEnabled: boolean;
  lastOkAt: string | null;
  lastError: string;
  selectable: boolean;
  disabledReason: string;
  isDefault: boolean;
  usage: AdminStorageUsage | null;
};

export function kindLabelFor(provider: string) {
  if (provider === "r2") return "Cloudflare R2";
  if (provider === "garage" || provider === "s3") return "Garage/VPS";
  return provider || "存储节点";
}

export function formatStorageBytes(n?: number | null) {
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

export function selectDefaultNodeId(
  nodes: Array<{ id: string; selectable: boolean }>,
  preferredId?: string | null,
  fallbackId?: string | null,
) {
  if (preferredId && nodes.some((n) => n.id === preferredId && n.selectable)) return preferredId;
  if (fallbackId && nodes.some((n) => n.id === fallbackId && n.selectable)) return fallbackId;
  return nodes.find((n) => n.selectable)?.id || "";
}

/** Block a batch only when remaining capacity is known and the total clearly exceeds it. */
export function checkBatchFits(
  totalBytes: number,
  usage?: AdminStorageUsage | null,
): { ok: boolean; message?: string } {
  if (!Number.isFinite(totalBytes) || totalBytes < 0) return { ok: true };
  if (!usage || usage.remainingBytes == null) return { ok: true };
  if (totalBytes > usage.remainingBytes) {
    return {
      ok: false,
      message: `本批文件约 ${formatStorageBytes(totalBytes)}，该配置剩余约 ${formatStorageBytes(usage.remainingBytes)}，空间明显不足。请换一个存储配置后再传，以免传一半才失败。`,
    };
  }
  return { ok: true };
}

export function classifyUploadFailure(raw: string) {
  const lower = String(raw || "").toLowerCase();
  if (
    lower.includes("insufficient") ||
    lower.includes("quota") ||
    lower.includes("storage limit") ||
    lower.includes("exceeded") ||
    lower.includes("no space") ||
    lower.includes("not enough space") ||
    lower.includes("disk full") ||
    lower.includes("507")
  ) {
    return "存储空间不足";
  }
  if (lower.includes("access denied") || lower.includes("forbidden") || lower.includes("not authorized") || lower.includes("403")) {
    return "权限不足";
  }
  if (
    lower.includes("enotfound") ||
    lower.includes("econnrefused") ||
    lower.includes("etimedout") ||
    lower.includes("timeout") ||
    lower.includes("network") ||
    lower.includes("fetch failed")
  ) {
    return "网络无法连接到该配置";
  }
  const trimmed = String(raw || "").replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, 240) : "上传失败";
}

export function nodeDisabledReason(input: {
  isEnabled: boolean;
  hasCreds: boolean;
  lastOkAt: Date | string | null;
  lastError: string;
}) {
  if (!input.hasCreds) return "缺少访问密钥，无法使用。";
  if (!input.isEnabled && input.lastError) return input.lastError;
  if (!input.isEnabled) return "已停用。";
  if (!input.lastOkAt) return "尚未测试连接成功。";
  return "";
}
