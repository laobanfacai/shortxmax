"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { toggleSeriesFlag } from "@/app/admin/actions";
import { SafeCover } from "@/components/public/SafeCover";

export type AdminShowRow = {
  id: string;
  title: string;
  slug: string;
  hook: string;
  synopsis: string;
  coverUrl: string;
  genre: string;
  status: string;
  isFeatured: boolean;
  isTrending: boolean;
  isNew: boolean;
  isPaid: boolean;
  isCatalogOnly: boolean;
  totalEpisodes: number;
  freeEpisodeCount: number;
  updateStatus: string;
  source: string | null;
  externalId: string | null;
  episodeCount: number;
};

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const OPEN_MS = 460;
const CLOSE_MS = 400;
const CONTENT_MS = 240;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function duration(ms: number) {
  return prefersReducedMotion() ? 80 : ms;
}

function Flag({ id, field, on, label }: { id: string; field: string; on: boolean; label: string }) {
  return (
    <form action={toggleSeriesFlag}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="field" value={field} />
      <button
        type="submit"
        className={`rounded-full border px-2 py-0.5 text-[11px] ${on ? "text-gold" : "text-muted"}`}
        style={{ borderColor: on ? "var(--color-gold)" : "var(--admin-border)" }}
      >
        {label}
      </button>
    </form>
  );
}

function statusLabel(s: AdminShowRow) {
  if (s.status === "published") return "已上架";
  if (s.status === "archived") return "已下架";
  return "草稿";
}

export function AdminShowsTable({ shows }: { shows: AdminShowRow[] }) {
  const [open, setOpen] = useState<{
    show: AdminShowRow;
    origin: DOMRect;
    originKey: string;
  } | null>(null);

  const openFrom = useCallback((show: AdminShowRow, el: HTMLElement, originKey: string) => {
    const origin = el.getBoundingClientRect();
    setOpen({ show, origin, originKey });
  }, []);

  const close = useCallback(() => setOpen(null), []);

  return (
    <>
      <div className="admin-card mt-4 overflow-x-auto">
        {shows.length === 0 ? (
          <p className="admin-empty">没有匹配的剧集，请修改筛选条件。</p>
        ) : (
          <table className="admin-table admin-shows-table min-w-[1120px]">
            <thead>
              <tr>
                <th>剧名</th>
                <th>来源 / 外部ID</th>
                <th>正片</th>
                <th>类型</th>
                <th>前台标签</th>
                <th>集数 / 免费</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {shows.map((s) => (
                <tr key={s.id} className="admin-show-row">
                  <td>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        className="admin-show-poster-btn"
                        data-show-cover={s.id}
                        aria-label={`查看《${s.title}》详情`}
                        onClick={(e) => openFrom(s, e.currentTarget, `cover:${s.id}`)}
                      >
                        <SafeCover src={s.coverUrl} alt={`${s.title} 封面`} className="h-full w-full object-cover" />
                      </button>
                      <div className="min-w-0">
                        <p className="admin-show-title">{s.title}</p>
                        <p className="admin-show-slug">/{s.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <p className="text-sm">{s.source || "—"}</p>
                    <p className="max-w-[220px] truncate text-xs text-muted" title={s.externalId || ""}>
                      {s.externalId || "无外部ID（演示/手工）"}
                    </p>
                  </td>
                  <td>
                    {s.isCatalogOnly || s.episodeCount === 0 ? (
                      <span className="text-xs text-muted">仅目录 · 无正片</span>
                    ) : (
                      <span className="text-xs text-gold">有正片 · {s.episodeCount} 集视频</span>
                    )}
                  </td>
                  <td>{s.genre}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <Flag id={s.id} field="isFeatured" on={s.isFeatured} label="推荐" />
                      <Flag id={s.id} field="isTrending" on={s.isTrending} label="热门" />
                      <Flag id={s.id} field="isNew" on={s.isNew} label="新片" />
                      <Flag
                        id={s.id}
                        field="status"
                        on={s.status === "published"}
                        label={statusLabel(s)}
                      />
                    </div>
                  </td>
                  <td>
                    {s.totalEpisodes} / {s.freeEpisodeCount}
                    <p className="text-xs text-muted">
                      {s.isPaid ? "付费" : "免费"} · {s.updateStatus === "ongoing" ? "更新中" : "已完结"}
                    </p>
                  </td>
                  <td>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <button
                        type="button"
                        className="admin-show-open-btn"
                        data-show-open={s.id}
                        onClick={(e) => openFrom(s, e.currentTarget, `btn:${s.id}`)}
                      >
                        详情
                      </button>
                      <Link href={`/admin/shows/${s.id}`} className="text-gold">
                        编辑
                      </Link>
                      <Link href={`/admin/shows/${s.id}/episodes`} className="text-gold">
                        分集
                      </Link>
                      <Link href={`/shows/${s.slug}`} className="text-gold">
                        前台
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {open ? (
        <ShowDetailLayer
          show={open.show}
          origin={open.origin}
          originKey={open.originKey}
          onClosed={close}
        />
      ) : null}
    </>
  );
}

function ShowDetailLayer({
  show,
  origin,
  originKey,
  onClosed,
}: {
  show: AdminShowRow;
  origin: DOMRect;
  originKey: string;
  onClosed: () => void;
}) {
  const labelId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const originRef = useRef(origin);
  originRef.current = origin;

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const panel = panelRef.current;
    const overlay = overlayRef.current;
    const content = contentRef.current;
    if (!panel || !overlay) {
      onClosed();
      return;
    }
    // Re-measure the original trigger in case the page scrolled.
    const key = originKey.startsWith("cover:") ? `[data-show-cover="${show.id}"]` : `[data-show-open="${show.id}"]`;
    const live = document.querySelector(key);
    const first = live ? live.getBoundingClientRect() : originRef.current;
    const dest = panel.getBoundingClientRect();
    const dx = first.left - dest.left;
    const dy = first.top - dest.top;
    const sx = Math.max(0.08, first.width / dest.width);
    const sy = Math.max(0.08, first.height / dest.height);
    const contentMs = duration(CONTENT_MS * 0.75);
    const closeMs = duration(CLOSE_MS);

    const finish = () => onClosed();

    const shrink = () => {
      overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: closeMs, easing: "ease-in", fill: "forwards" });
      const shrinkAnim = panel.animate(
        [
          { transform: "translate(0, 0) scale(1, 1)", borderRadius: "16px" },
          { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, borderRadius: "10px" },
        ],
        { duration: closeMs, easing: EASE, fill: "forwards" },
      );
      shrinkAnim.onfinish = finish;
      shrinkAnim.oncancel = finish;
    };

    if (content && !prefersReducedMotion()) {
      const hide = content.animate(
        [
          { opacity: 1, transform: "translateY(0)" },
          { opacity: 0, transform: "translateY(6px)" },
        ],
        { duration: contentMs, easing: "ease-in", fill: "forwards" },
      );
      hide.onfinish = shrink;
      hide.oncancel = shrink;
    } else {
      shrink();
    }
  }, [onClosed, originKey, show.id]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const overlay = overlayRef.current;
    const content = contentRef.current;
    if (!panel || !overlay) return;
    // Measure the final box before any invert transform is applied.
    const dest = panel.getBoundingClientRect();
    const first = originRef.current;
    const dx = first.left - dest.left;
    const dy = first.top - dest.top;
    const sx = Math.max(0.08, first.width / dest.width);
    const sy = Math.max(0.08, first.height / dest.height);
    const start = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    panel.style.transformOrigin = "top left";
    panel.style.transform = start;
    overlay.style.opacity = "0";
    panel.dataset.ready = "true";
    const ms = duration(OPEN_MS);
    const id = requestAnimationFrame(() => {
      overlay.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: duration(280),
        easing: "ease-out",
        fill: "forwards",
      });
      panel.animate(
        [
          { transform: start, borderRadius: "10px" },
          { transform: "translate(0, 0) scale(1, 1)", borderRadius: "16px" },
        ],
        { duration: ms, easing: EASE, fill: "forwards" },
      );
      if (content) {
        content.animate(
          [
            { opacity: 0, transform: "translateY(8px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          {
            duration: duration(CONTENT_MS),
            delay: prefersReducedMotion() ? 0 : Math.round(ms * 0.45),
            easing: "ease-out",
            fill: "forwards",
          },
        );
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [close]);

  const playable = !show.isCatalogOnly && show.episodeCount > 0;

  return (
    <div className="admin-show-layer" role="presentation">
      <div
        ref={overlayRef}
        className="admin-show-overlay"
        onClick={close}
        style={{ opacity: 0 }}
      />
      <article
        ref={panelRef}
        className="admin-show-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
      >
        <div ref={contentRef} className="admin-show-panel-inner" style={{ opacity: 0 }}>
          <button type="button" className="admin-show-panel-close" onClick={close} aria-label="关闭详情">
            关闭
          </button>
          <div className="admin-show-panel-grid">
            <div className="admin-show-panel-poster">
              <SafeCover src={show.coverUrl} alt={`${show.title} 封面`} className="h-full w-full object-cover" />
            </div>
            <div className="admin-show-panel-body">
              <p className="admin-show-panel-kicker">{show.genre}</p>
              <h2 id={labelId} className="admin-show-panel-title">
                {show.title}
              </h2>
              <p className="admin-show-slug">/{show.slug}</p>
              {show.hook ? <p className="admin-show-panel-hook">{show.hook}</p> : null}
              {show.synopsis ? <p className="admin-show-panel-synopsis">{show.synopsis}</p> : null}
              <ul className="admin-show-panel-meta">
                <li>{statusLabel(show)}</li>
                <li>{show.isPaid ? "付费" : "免费"}</li>
                <li>{show.updateStatus === "ongoing" ? "更新中" : "已完结"}</li>
                <li>
                  {show.totalEpisodes} 集 / {show.freeEpisodeCount} 集免费
                </li>
                <li>{playable ? `${show.episodeCount} 集正片` : "仅目录 · 无正片"}</li>
                {show.isFeatured ? <li>推荐</li> : null}
                {show.isTrending ? <li>热门</li> : null}
                {show.isNew ? <li>新片</li> : null}
              </ul>
              <div className="admin-show-panel-actions">
                <Link href={`/admin/shows/${show.id}`} className="btn btn-gold btn-md">
                  完整编辑
                </Link>
                <Link href={`/admin/shows/${show.id}/episodes`} className="btn btn-outline-gold btn-md">
                  分集
                </Link>
                <Link href={`/shows/${show.slug}`} className="btn btn-ghost btn-md">
                  前台
                </Link>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
