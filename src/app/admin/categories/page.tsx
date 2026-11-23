import { deleteGenre, moveGenre, saveGenre } from "@/app/admin/actions";
import { prisma } from "@/lib/prisma";

export default async function CategoriesAdmin() {
  const genres = await prisma.genre.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <div>
      <h1 className="admin-title">分类管理</h1>
      <p className="admin-hint">
        分类名称、钩子和排序会同步到前台 /genres、首页类型栏，以及广告落地页 /go/分类。停用后，前台不再展示该分类（已有剧集不会被删除）。
      </p>

      <form action={saveGenre} className="admin-card mt-6 space-y-3 p-5">
        <h2 className="text-sm font-medium">新增分类</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">名称（英文前台）</label>
            <input name="name" className="input" required placeholder="CEO Romance" />
          </div>
          <div>
            <label className="label">Slug</label>
            <input name="slug" className="input" placeholder="ceo-romance" />
          </div>
          <div className="md:col-span-2">
            <label className="label">钩子（大标题）</label>
            <input name="hook" className="input" placeholder="He hired a wife. She was never supposed to stay." />
          </div>
          <div className="md:col-span-2">
            <label className="label">简介</label>
            <input name="blurb" className="input" />
          </div>
          <div className="md:col-span-2">
            <label className="label">落地页说明</label>
            <input name="offer" className="input" />
          </div>
          <div>
            <label className="label">排序</label>
            <input name="sortOrder" type="number" className="input" defaultValue={genres.length} />
          </div>
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" name="isEnabled" defaultChecked /> 前台展示
          </label>
        </div>
        <button className="btn btn-gold btn-md" type="submit">添加分类</button>
      </form>

      <div className="mt-6 space-y-4">
        {genres.length === 0 ? <p className="admin-card admin-empty">还没有分类，请先添加。</p> : null}
        {genres.map((g, idx) => (
          <form key={g.id} action={saveGenre} className="admin-card space-y-3 p-4">
            <input type="hidden" name="id" value={g.id} />
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">名称</label>
                <input name="name" className="input" defaultValue={g.name} />
              </div>
              <div>
                <label className="label">Slug</label>
                <input name="slug" className="input" defaultValue={g.slug} />
              </div>
              <div className="md:col-span-2">
                <label className="label">钩子</label>
                <input name="hook" className="input" defaultValue={g.hook} />
              </div>
              <div className="md:col-span-2">
                <label className="label">简介</label>
                <input name="blurb" className="input" defaultValue={g.blurb} />
              </div>
              <div className="md:col-span-2">
                <label className="label">落地页说明</label>
                <input name="offer" className="input" defaultValue={g.offer} />
              </div>
              <input type="hidden" name="proof" value={g.proof} />
              <input type="hidden" name="sortOrder" value={g.sortOrder} />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isEnabled" defaultChecked={g.isEnabled} /> 前台展示
              </label>
              <button className="btn btn-gold btn-sm" type="submit">保存</button>
              <button formAction={moveGenre} name="dir" value="up" className="btn btn-ghost btn-sm" type="submit" disabled={idx === 0}>上移</button>
              <button formAction={moveGenre} name="dir" value="down" className="btn btn-ghost btn-sm" type="submit" disabled={idx === genres.length - 1}>下移</button>
              <button formAction={deleteGenre} className="btn btn-ghost btn-sm text-danger" type="submit">删除</button>
            </div>
          </form>
        ))}
      </div>
    </div>
  );
}
