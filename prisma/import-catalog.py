#!/usr/bin/env python3
"""Idempotent LumeReel catalog import (keyed on 剧集ID / externalId).

Does not create Episode rows and does not download cover images.
Re-runs update catalog fields but never overwrite homepage flags or a
stable slug, and never flip a show back to catalog-only if it already
has Episode rows.

Usage:
  python3 prisma/import-catalog.py
  python3 prisma/import-catalog.py --xlsx /path/to.xlsx --db prisma/dev.db
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
import unicodedata
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlparse

import openpyxl

SHANGHAI = timezone(timedelta(hours=8))
DEFAULT_XLSX = Path("/workspace/lumereel-imports/english-short-dramas.xlsx")
ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / "prisma" / "dev.db"
RESULT_PATH = ROOT / "test-results" / "catalog-import.json"
BATCH = "english-short-dramas-2026"
UNMAPPED_GENRE = "catalog"
PAGE_SORT_BASE = 10000

COL = {
    "pk": "主键id",
    "ext": "剧集ID",
    "trade": "剧集交易ID",
    "title": "剧集标题",
    "original": "原剧集标题",
    "type": "短剧类型",
    "subject": "短剧题材",
    "site": "目标站点",
    "listed": "是否上架(0:上架,1:下架)",
    "source": "短剧来源",
    "cover": "剧集封面图片URL",
    "desc": "剧集特别描述",
    "lang": "语言",
    "update": "更新状态(1:更新中,0:已完结)",
    "preview": "是否预览",
    "views": "阅读计数",
    "favs": "收藏计数",
    "chapters": "总章节数",
    "paid": "是否付费(1:付费,0:免费)",
    "created": "创建时间",
}


def slugify(title: str) -> str:
    text = unicodedata.normalize("NFKD", title or "")
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text[:60] or "series"


def hook_from(synopsis: str, title: str) -> str:
    raw = (synopsis or "").strip()
    if not raw:
        return title.strip()[:180]
    # first sentence, or first 160 chars
    m = re.split(r"(?<=[.!?])\s+", raw, maxsplit=1)
    first = m[0].strip() if m else raw
    if len(first) > 180:
        first = first[:177].rstrip() + "..."
    return first or title.strip()[:180]


def as_int(val, default=0) -> int:
    if val is None or val == "":
        return default
    try:
        return int(float(str(val).strip()))
    except (TypeError, ValueError):
        return default


def is_listed(val) -> bool:
    s = str(val).strip().lower() if val is not None else ""
    if s in {"1", "下架", "off", "unpublished", "archived"}:
        return False
    return True  # 0, 上架, or anything else treated as listed


def is_paid(val) -> bool:
    s = str(val).strip() if val is not None else ""
    if s in {"0", "免费", "free", "Free"}:
        return False
    return True  # 1, 付费, default paid


def update_status(val) -> str:
    s = str(val).strip() if val is not None else ""
    if s in {"1", "更新中", "ongoing", "updating"}:
        return "ongoing"
    return "ended"


def parse_created(val) -> str:
    """Store UTC ISO that Prisma SQLite DateTime can read."""
    if isinstance(val, datetime):
        dt = val
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=SHANGHAI)
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    if val is None or val == "":
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    s = str(val).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y/%m/%d %H:%M:%S", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(s[:19] if fmt != "%Y-%m-%d" else s[:10], fmt).replace(tzinfo=SHANGHAI)
            return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        except ValueError:
            continue
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def year_of(iso: str) -> int:
    try:
        return int(iso[:4])
    except Exception:
        return 2026


def genre_for(subject) -> str:
    # Never map 未定义 / 本土 / AI / null onto the five public tropes.
    return UNMAPPED_GENRE


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--xlsx", type=Path, default=DEFAULT_XLSX)
    ap.add_argument("--db", type=Path, default=DEFAULT_DB)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not args.xlsx.is_file():
        print(f"missing workbook: {args.xlsx}", file=sys.stderr)
        return 2
    if not args.db.is_file():
        print(f"missing sqlite db: {args.db}", file=sys.stderr)
        return 2

    print(f"loading {args.xlsx} ...")
    wb = openpyxl.load_workbook(args.xlsx, read_only=True, data_only=True)
    if "数据" not in wb.sheetnames:
        print(f"sheet 数据 not found: {wb.sheetnames}", file=sys.stderr)
        return 2
    ws = wb["数据"]
    rows = ws.iter_rows(values_only=True)
    header = [str(h).strip() if h is not None else "" for h in next(rows)]
    idx = {name: i for i, name in enumerate(header)}
    missing = [c for c in COL.values() if c not in idx]
    if missing:
        print(f"missing columns: {missing}\nheader={header}", file=sys.stderr)
        return 2

    conn = sqlite3.connect(str(args.db))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL")
    cur.execute("PRAGMA synchronous=NORMAL")
    cur.execute("PRAGMA foreign_keys=ON")

    existing = {
        r["externalId"]: dict(r)
        for r in cur.execute(
            'SELECT id, slug, externalId, isFeatured, isTrending, isNew, sortOrder FROM Series WHERE externalId IS NOT NULL'
        )
    }
    used_slugs = {r[0] for r in cur.execute("SELECT slug FROM Series")}
    episode_owners = {
        r[0]
        for r in cur.execute("SELECT DISTINCT seriesId FROM Episode")
    }

    inserted = updated = skipped = failed = 0
    failures: list[dict] = []
    pending: list[tuple] = []

    insert_sql = """
    INSERT INTO Series (
      id, slug, title, hook, synopsis, coverUrl, backdropUrl, trailerUrl,
      genre, tags, rating, ratingCount, viewCount, freeEpisodeCount, status,
      isTrending, isFeatured, isNew, totalEpisodes, releaseYear, language,
      seoTitle, seoDescription, sortOrder, originalTitle, externalId,
      externalTradeId, externalPk, source, sourceSubject, favoriteCount,
      isCatalogOnly, isPaid, updateStatus, createdAt, updatedAt
    ) VALUES (
      ?,?,?,?,?,?,NULL,NULL,
      ?,?,0,0,?,?,?,
      0,0,0,?,?,?,
      ?,?,?,?,?,
      ?,?,?,?,?,
      ?,?,?,?,?
    )
    """
    update_sql = """
    UPDATE Series SET
      title=?, hook=?, synopsis=?, coverUrl=?, genre=?, tags=?,
      viewCount=?, freeEpisodeCount=?, status=?, totalEpisodes=?,
      releaseYear=?, language=?, seoTitle=?, seoDescription=?,
      originalTitle=?, externalTradeId=?, externalPk=?, source=?,
      sourceSubject=?, favoriteCount=?, isCatalogOnly=?, isPaid=?,
      updateStatus=?, createdAt=?, updatedAt=?
    WHERE externalId=?
    """

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")

    def flush():
        if args.dry_run or not pending:
            pending.clear()
            return
        conn.executemany(pending[0][0], [p[1] for p in pending])  # mixed types, can't
        pending.clear()

    # We will buffer inserts and updates separately
    ins_rows: list[tuple] = []
    upd_rows: list[tuple] = []

    def commit_batches(force=False):
        nonlocal ins_rows, upd_rows
        if args.dry_run:
            ins_rows, upd_rows = [], []
            return
        if force or len(ins_rows) >= 400:
            if ins_rows:
                cur.executemany(insert_sql, ins_rows)
                ins_rows = []
            if upd_rows:
                cur.executemany(update_sql, upd_rows)
                upd_rows = []
            conn.commit()
        elif force is False and len(upd_rows) >= 400:
            if ins_rows:
                cur.executemany(insert_sql, ins_rows)
                ins_rows = []
            if upd_rows:
                cur.executemany(update_sql, upd_rows)
                upd_rows = []
            conn.commit()

    seen_ext: set[str] = set()
    n = 0
    for raw in rows:
        n += 1
        try:
            ext = str(raw[idx[COL["ext"]]] or "").strip()
            title = str(raw[idx[COL["title"]]] or "").strip()
            if not ext or not title:
                skipped += 1
                failures.append({"row": n, "reason": "missing 剧集ID or title", "ext": ext, "title": title})
                continue
            if ext in seen_ext:
                skipped += 1
                failures.append({"row": n, "reason": "duplicate 剧集ID in workbook", "ext": ext})
                continue
            seen_ext.add(ext)

            original = str(raw[idx[COL["original"]]] or "").strip() or None
            synopsis = str(raw[idx[COL["desc"]]] or "").strip()
            cover = str(raw[idx[COL["cover"]]] or "").strip()
            source = str(raw[idx[COL["source"]]] or "").strip() or None
            subject = str(raw[idx[COL["subject"]]] or "").strip() or None
            trade = str(raw[idx[COL["trade"]]] or "").strip() or None
            pk = raw[idx[COL["pk"]]]
            external_pk = str(pk).strip() if pk is not None and str(pk).strip() != "" else None
            total = max(0, as_int(raw[idx[COL["chapters"]]], 0))
            views = max(0, as_int(raw[idx[COL["views"]]], 0))
            favs = max(0, as_int(raw[idx[COL["favs"]]], 0))
            paid = is_paid(raw[idx[COL["paid"]]])
            listed = is_listed(raw[idx[COL["listed"]]])
            upd = update_status(raw[idx[COL["update"]]])
            created = parse_created(raw[idx[COL["created"]]])
            hook = hook_from(synopsis, title)
            genre = genre_for(subject)
            tags_list = ["english", "catalog"]
            if subject and subject not in {"未定义", "null", "None", "NULL"}:
                tags_list.append(subject)
            tags = json.dumps(tags_list, ensure_ascii=False)
            free_count = 0 if paid else min(3, total or 3)
            status = "published" if listed else "archived"
            seo_title = title
            seo_desc = (synopsis or hook)[:160]
            language = "English"
            short = re.sub(r"[^a-zA-Z0-9]", "", ext)[-8:] or ext[-8:]
            base_slug = slugify(title)
            slug = f"{base_slug}-{short.lower()}"
            sid = f"imp_{ext}"
            catalog_only = sid not in episode_owners
            # If an existing row already has episodes, keep playable
            if ext in existing:
                catalog_only = existing[ext]["id"] not in episode_owners

            if ext in existing:
                # preserve slug / flags
                upd_rows.append(
                    (
                        title, hook, synopsis, cover, genre, tags,
                        views, free_count, status, total,
                        year_of(created), language, seo_title, seo_desc,
                        original, trade, external_pk, source,
                        subject, favs, 1 if catalog_only else 0, 1 if paid else 0,
                        upd, created, now_iso, ext,
                    )
                )
                updated += 1
            else:
                # unique slug
                candidate = slug
                i = 2
                while candidate in used_slugs:
                    candidate = f"{slug}-{i}"
                    i += 1
                used_slugs.add(candidate)
                ins_rows.append(
                    (
                        sid, candidate, title, hook, synopsis, cover,
                        genre, tags, views, free_count, status,
                        total, year_of(created), language,
                        seo_title, seo_desc, PAGE_SORT_BASE,
                        original, ext, trade, external_pk, source, subject, favs,
                        1 if catalog_only else 0, 1 if paid else 0, upd, created, created,
                    )
                )
                inserted += 1
            commit_batches()
        except Exception as exc:  # noqa: BLE001
            failed += 1
            failures.append({"row": n, "reason": str(exc), "ext": str(raw[idx[COL["ext"]]] if raw else "")})

    if not args.dry_run:
        if ins_rows:
            cur.executemany(insert_sql, ins_rows)
        if upd_rows:
            cur.executemany(update_sql, upd_rows)
        conn.commit()

    total_series = cur.execute("SELECT COUNT(*) FROM Series").fetchone()[0]
    imported = cur.execute(
        "SELECT COUNT(*) FROM Series WHERE externalId IS NOT NULL"
    ).fetchone()[0]
    demos = cur.execute(
        "SELECT COUNT(*) FROM Series WHERE externalId IS NULL"
    ).fetchone()[0]
    episodes = cur.execute("SELECT COUNT(*) FROM Episode").fetchone()[0]
    wb.close()
    conn.close()

    result = {
        "xlsx": str(args.xlsx),
        "db": str(args.db),
        "dryRun": args.dry_run,
        "workbookRows": n,
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
        "failed": failed,
        "failures": failures[:50],
        "totalSeries": total_series,
        "importedWithExternalId": imported,
        "demoOrManual": demos,
        "episodeRows": episodes,
        "finishedAtShanghai": datetime.now(SHANGHAI).strftime("%Y-%m-%d %H:%M:%S %z"),
    }
    RESULT_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not args.dry_run:
        RESULT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if failed:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
