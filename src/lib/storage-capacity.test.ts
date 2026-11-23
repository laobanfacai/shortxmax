import assert from "node:assert/strict";
import { test, describe } from "node:test";
import {
  checkBatchFits,
  selectDefaultNodeId,
  classifyUploadFailure,
  nodeDisabledReason,
  formatStorageBytes,
} from "./storage-capacity";

describe("checkBatchFits", () => {
  test("allows upload when remaining space is unknown", () => {
    assert.deepEqual(checkBatchFits(5000, null), { ok: true });
    assert.deepEqual(checkBatchFits(5000, { usedBytes: 100, capacityBytes: null, remainingBytes: null, complete: false }), { ok: true });
  });

  test("blocks when the batch is clearly larger than remaining space", () => {
    const r = checkBatchFits(2000, { usedBytes: 9000, capacityBytes: 10000, remainingBytes: 1000, complete: true });
    assert.equal(r.ok, false);
    assert.match(r.message || "", /空间明显不足/);
    assert.match(r.message || "", /请换一个存储配置/);
  });

  test("allows when the batch fits in remaining space", () => {
    assert.equal(checkBatchFits(500, { usedBytes: 9000, capacityBytes: 10000, remainingBytes: 1000, complete: true }).ok, true);
  });
});

describe("selectDefaultNodeId", () => {
  const nodes = [
    { id: "a", selectable: true },
    { id: "b", selectable: true },
    { id: "c", selectable: false },
  ];
  test("prefers the last remembered selectable node", () => {
    assert.equal(selectDefaultNodeId(nodes, "b", "a"), "b");
  });
  test("ignores a remembered node that is no longer selectable", () => {
    assert.equal(selectDefaultNodeId(nodes, "c", "a"), "a");
  });
  test("falls back to the default official node, then the first selectable", () => {
    assert.equal(selectDefaultNodeId(nodes, null, "a"), "a");
    assert.equal(selectDefaultNodeId(nodes, "missing", "missing"), "a");
    assert.equal(selectDefaultNodeId([{ id: "c", selectable: false }], "c", "c"), "");
  });
});

describe("classifyUploadFailure and disabled reasons", () => {
  test("maps quota and network errors without leaking details", () => {
    assert.equal(classifyUploadFailure("QuotaExceeded: bucket storage limit exceeded"), "存储空间不足");
    assert.equal(classifyUploadFailure("ECONNREFUSED"), "网络无法连接到该配置");
    assert.equal(classifyUploadFailure("Access Denied"), "权限不足");
  });
  test("explains disabled or untested nodes", () => {
    assert.match(nodeDisabledReason({ isEnabled: false, hasCreds: true, lastOkAt: null, lastError: "连接失败：无法连接到 Endpoint（http://127.0.0.1:3900）。" }), /无法连接到 Endpoint/);
    assert.equal(nodeDisabledReason({ isEnabled: true, hasCreds: true, lastOkAt: null, lastError: "" }), "尚未测试连接成功。");
    assert.equal(nodeDisabledReason({ isEnabled: true, hasCreds: true, lastOkAt: new Date(), lastError: "" }), "");
  });
  test("formats byte sizes", () => {
    assert.equal(formatStorageBytes(512), "512 B");
    assert.equal(formatStorageBytes(10 * 1024 * 1024), "10.0 MB");
  });
});
