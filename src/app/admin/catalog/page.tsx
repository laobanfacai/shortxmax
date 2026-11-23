import Link from "next/link";
import { catalogImportStats } from "@/lib/admin-shows";

export default async function CatalogImportPage() {
  const s = await catalogImportStats();
  return (
    <div>
      <h1 className="admin-title">目录导入</h1>
      <p className="admin-hint">
        按「剧集ID」幂等导入英文短剧目录。重跑只会更新目录字段，不会重复插入，也不会为无视频的导入剧创建分集行，不会下载封面。
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["剧集总数", s.total],
          ["已导入（有外部ID）", s.imported],
          ["有正片可播放", s.playable],
          ["仅目录（无视频）", s.catalogOnly],
          ["导入剧 · 付费", s.paid],
          ["导入剧 · 免费", s.free],
          ["导入剧 · 更新中", s.ongoing],
          ["导入剧 · 已完结", s.ended],
        ].map(([label, n]) => (
          <div key={String(label)} className="admin-card p-4">
            <p className="text-xs text-muted">{label}</p>
            <p className="admin-metric-value mt-1">{Number(n).toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="admin-card mt-6 p-5">
        <h2 className="text-lg font-medium">来源分布</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {s.sources.map((row) => (
            <li key={row.source || "空"}>
              <Link className="text-gold" href={`/admin/shows?source=${encodeURIComponent(row.source || "")}`}>
                {row.source || "（空）"}
              </Link>
              <span className="text-muted"> · {row._count._all.toLocaleString()} 部</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="admin-card mt-6 space-y-3 p-5 text-sm leading-relaxed">
        <h2 className="text-lg font-medium">如何重复导入</h2>
        <p>在项目根目录执行（不要用后台按钮直接跑 1.3 万行，以免拖垮当前请求）：</p>
        <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 text-[13px]">
npm run db:import-catalog{"\n"}
# 或指定文件{"\n"}
python3 prisma/import-catalog.py --xlsx /workspace/lumereel-imports/english-short-dramas.xlsx
        </pre>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>幂等键是工作表中的「剧集ID」，写入 Series.externalId。</li>
          <li>已有分集视频的剧不会被改回「仅目录」。</li>
          <li>不会改推荐 / 热门 / 新片开关，也不会覆盖已有 slug。</li>
          <li>导入剧默认不进入首页轮播和推荐栏，需在剧集管理里手动打开标签。</li>
          <li>封面保存为远程 URL，不会下载到本地。</li>
        </ul>
        <p>
          快捷筛选：
          <Link className="ml-2 text-gold" href="/admin/shows?video=catalog">
            仅目录
          </Link>
          <Link className="ml-3 text-gold" href="/admin/shows?video=playable">
            有正片
          </Link>
          <Link className="ml-3 text-gold" href="/admin/shows?paid=free">
            免费导入剧
          </Link>
        </p>
      </div>
    </div>
  );
}
