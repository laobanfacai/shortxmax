import { deleteSlide, moveSlide, saveSlide, toggleSlide } from "@/app/admin/actions";
import { UploadField } from "@/components/admin/UploadField";
import { prisma } from "@/lib/prisma";
import { formatShanghaiDisplay, formatShanghaiInput } from "@/lib/time";

export default async function HomeCarouselAdmin() {
  const [slides, shows] = await Promise.all([
    prisma.heroSlide.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.series.findMany({ where: { status: "published", isCatalogOnly: false }, orderBy: { title: "asc" }, select: { id: true, title: true, slug: true, coverUrl: true, backdropUrl: true, hook: true } }),
  ]);
  const now = new Date();

  return (
    <div>
      <h1 className="admin-title">首页与轮播</h1>
      <p className="admin-hint">
        这里的幻灯片会直接显示在英文前台首页顶部。保存、上下移动或停用后，打开前台首页即可看到结果（可能需刷新）。
        若不启用任何幻灯片，前台会回退到热门剧的单张封面。下拉列表只显示有正片的剧，避免把 1.3 万部仅目录剧塞进本页。
      </p>

      <form action={saveSlide} className="admin-card mt-6 space-y-4 p-5">
        <h2 className="text-sm font-medium">添加幻灯片</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">选用已有剧集海报（可选）</label>
            <select name="seriesId" className="input">
              <option value="">不关联，稍后自己上传</option>
              {shows.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted">若标题或图片留空，会自动使用该剧的海报、钩子和播放链接。</p>
          </div>
          <div>
            <label className="label">跳转链接</label>
            <input name="href" className="input" placeholder="/watch/velvet-contract/1 或 /pricing 或 /go" />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">标题（英文前台）</label>
            <input name="title" className="input" placeholder="The Velvet Contract" />
          </div>
          <div>
            <label className="label">副标题 / 钩子</label>
            <input name="subtitle" className="input" placeholder="He hired a wife. She was never supposed to stay." />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">按钮文字</label>
            <input name="ctaLabel" className="input" defaultValue="Play Episode 1 free" />
          </div>
          <div>
            <label className="label">排序（越小越靠前）</label>
            <input name="sortOrder" type="number" className="input" defaultValue={slides.length} />
          </div>
        </div>
        <UploadField name="imageUrl" label="轮播图（横版更佳）" kind="cover" />
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">开始时间（上海，可空）</label>
            <input type="datetime-local" name="startsAt" className="input" />
          </div>
          <div>
            <label className="label">结束时间（上海，可空）</label>
            <input type="datetime-local" name="endsAt" className="input" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isEnabled" defaultChecked /> 启用并在首页展示
        </label>
        <button className="btn btn-gold btn-md" type="submit">
          添加幻灯片
        </button>
      </form>

      <div className="mt-6 space-y-4">
        {slides.length === 0 ? (
          <p className="admin-empty admin-card">还没有幻灯片。上面添加 3–5 张后，首页英雄区就会轮播。</p>
        ) : null}
        {slides.map((s, idx) => {
          const live =
            s.isEnabled &&
            (!s.startsAt || s.startsAt <= now) &&
            (!s.endsAt || s.endsAt >= now);
          return (
            <form key={s.id} action={saveSlide} className="admin-card p-4">
              <input type="hidden" name="id" value={s.id} />
              <div className="flex flex-wrap items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.imageUrl} alt="" className="h-28 w-48 rounded-[10px] object-cover" />
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={live ? "text-gold" : "text-muted"}>{live ? "首页展示中" : "未展示"}</span>
                    {s.startsAt || s.endsAt ? (
                      <span className="text-muted">
                        {s.startsAt ? formatShanghaiDisplay(s.startsAt) : "立即"} — {s.endsAt ? formatShanghaiDisplay(s.endsAt) : "长期"}
                      </span>
                    ) : null}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input name="title" className="input" defaultValue={s.title} />
                    <input name="subtitle" className="input" defaultValue={s.subtitle} />
                    <input name="ctaLabel" className="input" defaultValue={s.ctaLabel} />
                    <input name="href" className="input" defaultValue={s.href} />
                    <input name="imageUrl" className="input" defaultValue={s.imageUrl} />
                    <select name="seriesId" className="input" defaultValue={s.seriesId || ""}>
                      <option value="">不关联剧集</option>
                      {shows.map((sh) => (
                        <option key={sh.id} value={sh.id}>
                          {sh.title}
                        </option>
                      ))}
                    </select>
                    <input type="datetime-local" name="startsAt" className="input" defaultValue={s.startsAt ? formatShanghaiInput(s.startsAt) : ""} />
                    <input type="datetime-local" name="endsAt" className="input" defaultValue={s.endsAt ? formatShanghaiInput(s.endsAt) : ""} />
                  </div>
                  <input type="hidden" name="sortOrder" value={s.sortOrder} />
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="isEnabled" defaultChecked={s.isEnabled} /> 启用
                    </label>
                    <button className="btn btn-gold btn-sm" type="submit">保存</button>
                    <button formAction={toggleSlide} className="btn btn-ghost btn-sm" type="submit">{s.isEnabled ? "停用" : "启用"}</button>
                    <button formAction={moveSlide} name="dir" value="up" className="btn btn-ghost btn-sm" type="submit" disabled={idx === 0}>上移</button>
                    <button formAction={moveSlide} name="dir" value="down" className="btn btn-ghost btn-sm" type="submit" disabled={idx === slides.length - 1}>下移</button>
                    <button formAction={deleteSlide} className="btn btn-ghost btn-sm text-danger" type="submit">删除</button>
                  </div>
                </div>
              </div>
            </form>
          );
        })}
      </div>
    </div>
  );
}
