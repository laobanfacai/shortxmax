import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteEpisode, saveEpisode } from "@/app/admin/actions";
import { UploadField } from "@/components/admin/UploadField";
import { BatchEpisodeUploader } from "@/components/admin/BatchEpisodeUploader";
import { prisma } from "@/lib/prisma";

export default async function EpisodesAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const series = await prisma.series.findUnique({
    where: { id },
    include: { episodes: { orderBy: { number: "asc" } } },
  });
  if (!series) notFound();
  const nextNumber = (series.episodes.at(-1)?.number || 0) + 1;

  return (
    <div>
      <p className="text-sm text-muted">
        <Link href={`/admin/shows/${series.id}`} className="hover:text-gold">
          ← {series.title}
        </Link>
      </p>
      <h1 className="admin-title mt-2">分集 / 视频上传</h1>
      <p className="mt-1 text-sm text-muted">
        可批量或单集上传视频、调整顺序（集号）、发布/下架，以及标记免费或付费。保存剧集时会按「免费集数」同步前几集的免费状态。新视频上传到当前默认存储通道，不会写入本机磁盘。
      </p>

      <BatchEpisodeUploader
        seriesId={series.id}
        freeEpisodeCount={series.freeEpisodeCount}
        episodes={series.episodes.map((ep) => ({
          id: ep.id,
          number: ep.number,
          title: ep.title,
          videoUrl: ep.videoUrl,
          durationSec: ep.durationSec,
          isFree: ep.isFree,
          isPublished: ep.isPublished,
          coinPrice: ep.coinPrice,
        }))}
      />

      <form action={saveEpisode} className="mt-8 rounded-2xl border border-white/10 bg-surface p-5">
        <h2 className="font-medium">新增一集</h2>
        <input type="hidden" name="seriesId" value={series.id} />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label className="label">集号</label>
            <input name="number" type="number" className="input" defaultValue={nextNumber} required />
          </div>
          <div className="md:col-span-2">
            <label className="label">标题（英文）</label>
            <input name="title" className="input" required placeholder="Episode title" />
          </div>
        </div>
        <div className="mt-3">
          <label className="label">简介</label>
          <input name="synopsis" className="input" />
        </div>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <UploadField name="videoUrl" label="视频文件" kind="video" />
          <div>
            <label className="label">时长（秒）</label>
            <input name="durationSec" type="number" className="input" defaultValue={90} />
            <label className="label mt-3">金币解锁价格</label>
            <input name="coinPrice" type="number" className="input" defaultValue={49} />
          </div>
        </div>
        <div className="mt-3 flex gap-5 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isFree" defaultChecked={nextNumber <= series.freeEpisodeCount} /> 免费
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isPublished" defaultChecked /> 已发布
          </label>
        </div>
        <button className="btn btn-gold btn-md mt-4" type="submit">
          添加分集
        </button>
      </form>

      <div className="mt-8 space-y-4">
        {series.episodes.length === 0 ? (
          <p className="text-sm text-muted">还没有分集。请在上方添加。</p>
        ) : null}
        {series.episodes.map((ep) => (
          <form
            key={ep.id}
            action={saveEpisode}
            className="rounded-2xl border border-white/10 bg-surface p-5"
          >
            <input type="hidden" name="id" value={ep.id} />
            <input type="hidden" name="seriesId" value={series.id} />
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <label className="label">集号</label>
                <input name="number" type="number" className="input" defaultValue={ep.number} />
              </div>
              <div className="md:col-span-3">
                <label className="label">标题</label>
                <input name="title" className="input" defaultValue={ep.title} />
              </div>
            </div>
            <div className="mt-3">
              <label className="label">简介</label>
              <input name="synopsis" className="input" defaultValue={ep.synopsis || ""} />
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <UploadField name="videoUrl" label="视频" kind="video" defaultValue={ep.videoUrl} />
              <div>
                <label className="label">时长（秒）</label>
                <input name="durationSec" type="number" className="input" defaultValue={ep.durationSec} />
                <label className="label mt-3">金币价格</label>
                <input name="coinPrice" type="number" className="input" defaultValue={ep.coinPrice} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-5 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isFree" defaultChecked={ep.isFree} /> 免费
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isPublished" defaultChecked={ep.isPublished} /> 已发布
              </label>
              <button className="btn btn-gold btn-sm" type="submit">
                保存
              </button>
              <button formAction={deleteEpisode} className="btn btn-ghost btn-sm text-danger" type="submit">
                删除
              </button>
            </div>
          </form>
        ))}
      </div>
    </div>
  );
}
