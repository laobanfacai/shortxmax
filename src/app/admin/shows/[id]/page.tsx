import Link from "next/link";
import { notFound } from "next/navigation";
import { SeriesForm } from "@/components/admin/SeriesForm";
import { prisma } from "@/lib/prisma";
import { getAllGenres } from "@/lib/genres";

export default async function EditShowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [series, genres] = await Promise.all([
    prisma.series.findUnique({ where: { id } }),
    getAllGenres(),
  ]);
  if (!series) notFound();
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="admin-title">编辑：{series.title}</h1>
        <Link href={`/admin/shows/${series.id}/episodes`} className="btn btn-outline-gold btn-md">
          分集 / 视频上传
        </Link>
      </div>
      {series.externalId || series.isCatalogOnly ? (
        <div className="admin-card mb-6 p-4 text-sm">
          <p className="font-medium">导入目录信息</p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">来源</dt>
              <dd>{series.source || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">外部剧集ID</dt>
              <dd className="break-all">{series.externalId || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">交易ID / 主键</dt>
              <dd className="break-all">
                {series.externalTradeId || "—"} / {series.externalPk || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">正片</dt>
              <dd>{series.isCatalogOnly ? "仅目录，尚无正片视频" : "已有正片"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted">
            请不要为没有视频地址的导入剧手工创建空分集。等有正片后再在「分集 / 视频上传」里添加。
          </p>
        </div>
      ) : null}
      <SeriesForm series={series} genres={genres} />
    </div>
  );
}
