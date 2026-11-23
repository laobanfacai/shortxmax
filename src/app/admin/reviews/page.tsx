import { toggleReviewHidden } from "@/app/admin/actions";
import { prisma } from "@/lib/prisma";
import { formatShanghaiDisplay } from "@/lib/time";

export default async function ReviewsAdmin() {
  const reviews = await prisma.review.findMany({
    orderBy: { createdAt: "desc" },
    include: { series: { select: { title: true, slug: true } }, user: { select: { email: true } } },
    take: 200,
  });
  return (
    <div>
      <h1 className="admin-title">评论管理</h1>
      <p className="admin-hint">隐藏后，该评论会从英文剧集页立即消失，不会删除记录。</p>
      <div className="admin-card mt-6 overflow-x-auto">
        {reviews.length === 0 ? (
          <p className="admin-empty">暂无评论。</p>
        ) : (
          <table className="admin-table min-w-[720px]">
            <thead>
              <tr>
                <th>剧集</th>
                <th>评分 / 内容</th>
                <th>用户</th>
                <th>时间</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <tr key={r.id}>
                  <td>
                    <a className="text-gold" href={`/shows/${r.series.slug}`} target="_blank" rel="noreferrer">
                      {r.series.title}
                    </a>
                  </td>
                  <td>
                    <p>★ {r.rating} · {r.displayName}</p>
                    <p className="max-w-md text-xs text-muted">{r.body}</p>
                  </td>
                  <td className="text-xs text-muted">{r.user.email}</td>
                  <td className="text-xs text-muted">{formatShanghaiDisplay(r.createdAt)}</td>
                  <td>
                    <form action={toggleReviewHidden}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="text-gold" type="submit">
                        {r.isHidden ? "已隐藏 · 恢复" : "隐藏"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
