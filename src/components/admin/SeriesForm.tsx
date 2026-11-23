import { saveSeries, deleteSeries } from "@/app/admin/actions";
import { UploadField } from "./UploadField";

import { parseJsonArray } from "@/lib/utils";
import type { Series } from "@prisma/client";

export function SeriesForm({
  series,
  genres,
}: {
  series?: Series | null;
  genres: { slug: string; name: string }[];
}) {
  return (
    <form action={saveSeries} className="max-w-3xl space-y-4">
      <input type="hidden" name="id" value={series?.id || ""} />
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">标题（英文前台展示）</label>
          <input name="title" className="input" required defaultValue={series?.title} />
        </div>
        <div>
          <label className="label">Slug（URL）</label>
          <input name="slug" className="input" defaultValue={series?.slug} placeholder="auto-from-title" />
        </div>
      </div>
      <div>
        <label className="label">一句话钩子</label>
        <input name="hook" className="input" defaultValue={series?.hook} />
      </div>
      <div>
        <label className="label">剧情简介</label>
        <textarea name="synopsis" className="input min-h-32" defaultValue={series?.synopsis} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">类型</label>
          <select name="genre" className="input" defaultValue={series?.genre || "ceo-romance"}>
            {genres.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">标签（逗号分隔）</label>
          <input
            name="tags"
            className="input"
            defaultValue={series ? parseJsonArray(series.tags).join(", ") : ""}
          />
        </div>
      </div>
      <UploadField name="coverUrl" label="封面海报" kind="cover" defaultValue={series?.coverUrl} />
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">横版背景（可选）</label>
          <input name="backdropUrl" className="input" defaultValue={series?.backdropUrl || ""} />
        </div>
        <div>
          <label className="label">预告片地址（可选）</label>
          <input name="trailerUrl" className="input" defaultValue={series?.trailerUrl || ""} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <label className="label">评分</label>
          <input name="rating" type="number" step="0.1" className="input" defaultValue={series?.rating ?? 4.6} />
        </div>
        <div>
          <label className="label">评分数</label>
          <input name="ratingCount" type="number" className="input" defaultValue={series?.ratingCount ?? 0} />
        </div>
        <div>
          <label className="label">播放量</label>
          <input name="viewCount" type="number" className="input" defaultValue={series ? Number(series.viewCount) : 0} />
        </div>
        <div>
          <label className="label">免费集数</label>
          <input name="freeEpisodeCount" type="number" className="input" defaultValue={series?.freeEpisodeCount ?? 3} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="label">状态</label>
          <select name="status" className="input" defaultValue={series?.status || "published"}>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="archived">已下架</option>
          </select>
        </div>
        <div>
          <label className="label">年份</label>
          <input name="releaseYear" type="number" className="input" defaultValue={series?.releaseYear ?? 2026} />
        </div>
        <div>
          <label className="label">语言</label>
          <input name="language" className="input" defaultValue={series?.language || "English"} />
        </div>
      </div>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isFeatured" defaultChecked={series?.isFeatured} /> 推荐（首页推荐栏）
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isTrending" defaultChecked={series?.isTrending} /> 热门
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isNew" defaultChecked={series?.isNew} /> 新片
        </label>
      </div>
      <div>
        <label className="label">SEO 标题</label>
        <input name="seoTitle" className="input" defaultValue={series?.seoTitle || ""} />
      </div>
      <div>
        <label className="label">SEO 描述</label>
        <textarea name="seoDescription" className="input min-h-20" defaultValue={series?.seoDescription || ""} />
      </div>
      <div>
        <label className="label">排序（越小越靠前）</label>
        <input name="sortOrder" type="number" className="input" defaultValue={series?.sortOrder ?? 0} />
      </div>
      <div className="flex gap-3">
        <button className="btn btn-gold btn-md" type="submit">
          保存剧集
        </button>
        {series ? (
          <button formAction={deleteSeries} className="btn btn-ghost btn-md text-danger" type="submit">
            删除
          </button>
        ) : null}
      </div>
    </form>
  );
}
