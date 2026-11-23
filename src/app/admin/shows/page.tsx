import Link from "next/link";
import { adminShowSearch, distinctSources } from "@/lib/admin-shows";
import { syncGenreName } from "@/lib/genres";
import { queryHref } from "@/lib/pagination";
import { AdminShowsTable, type AdminShowRow } from "@/components/admin/AdminShowsTable";

export default async function AdminShows({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    source?: string;
    video?: string;
    paid?: string;
    status?: string;
    update?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const [{ shows, total, page, pages }, sources] = await Promise.all([
    adminShowSearch(sp),
    distinctSources(),
  ]);
  const rows: AdminShowRow[] = shows.map((s) => ({
    id: s.id,
    title: s.title,
    slug: s.slug,
    hook: s.hook,
    synopsis: s.synopsis,
    coverUrl: s.coverUrl,
    genre: syncGenreName(s.genre),
    status: s.status,
    isFeatured: s.isFeatured,
    isTrending: s.isTrending,
    isNew: s.isNew,
    isPaid: s.isPaid,
    isCatalogOnly: s.isCatalogOnly,
    totalEpisodes: s.totalEpisodes,
    freeEpisodeCount: s.freeEpisodeCount,
    updateStatus: s.updateStatus,
    source: s.source,
    externalId: s.externalId,
    episodeCount: s._count.episodes,
  }));
  const hrefFor = (p: number) =>
    queryHref(
      "/admin/shows",
      {
        q: sp.q,
        source: sp.source,
        video: sp.video,
        paid: sp.paid,
        status: sp.status,
        update: sp.update,
      },
      p,
    );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="admin-title">剧集管理</h1>
          <p className="admin-hint">
            「推荐 / 热门 / 新片 / 上架」会立刻影响首页栏目和前台目录。导入剧默认不会进入首页。列表已分页，请用搜索和筛选查找。
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/catalog" className="btn btn-outline-gold btn-md">
            目录导入
          </Link>
          <Link href="/admin/shows/new" className="btn btn-gold btn-md">
            新建剧集
          </Link>
        </div>
      </div>

      <form className="admin-card admin-filters mt-6" method="get">
        <label>
          搜索
          <input
            className="input"
            name="q"
            defaultValue={sp.q}
            placeholder="标题 / Slug / 外部ID / 来源"
          />
        </label>
        <label>
          来源
          <select name="source" className="input" defaultValue={sp.source || ""}>
            <option value="">全部来源</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          正片
          <select name="video" className="input" defaultValue={sp.video || ""}>
            <option value="">全部</option>
            <option value="playable">有正片（可播放）</option>
            <option value="catalog">仅目录（无视频）</option>
          </select>
        </label>
        <label>
          付费
          <select name="paid" className="input" defaultValue={sp.paid || ""}>
            <option value="">全部</option>
            <option value="paid">付费</option>
            <option value="free">免费</option>
          </select>
        </label>
        <label>
          上架
          <select name="status" className="input" defaultValue={sp.status || ""}>
            <option value="">全部状态</option>
            <option value="published">已上架</option>
            <option value="archived">已下架</option>
            <option value="draft">草稿</option>
          </select>
        </label>
        <label>
          更新
          <select name="update" className="input" defaultValue={sp.update || ""}>
            <option value="">全部</option>
            <option value="ongoing">更新中</option>
            <option value="ended">已完结</option>
          </select>
        </label>
        <div className="flex items-center gap-3 pb-0.5">
          <button className="btn btn-gold btn-md">查询</button>
          <Link href="/admin/shows" className="text-gold">
            重置
          </Link>
        </div>
      </form>

      <AdminShowsTable shows={rows} />

      <div className="mt-4 flex gap-4 text-sm">
        <span>
          共 {total.toLocaleString()} 部 · 第 {page} / {pages} 页
        </span>
        {page > 1 && (
          <Link className="text-gold" href={hrefFor(page - 1)}>
            上一页
          </Link>
        )}
        {page < pages && (
          <Link className="text-gold" href={hrefFor(page + 1)}>
            下一页
          </Link>
        )}
      </div>
    </div>
  );
}
