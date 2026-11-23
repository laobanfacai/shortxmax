import Link from "next/link";
import { dashboardStats } from "@/lib/admin-stats";
import { formatMoney } from "@/lib/utils";
import { defaultDashboardRange, formatShanghaiInputSec, parseShanghaiInput } from "@/lib/time";

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const fallback = defaultDashboardRange();
  const start = sp.from ? parseShanghaiInput(sp.from) : fallback.start;
  const end = sp.to ? parseShanghaiInput(sp.to) : fallback.end;
  const stats = await dashboardStats(start, end);

  const metrics = [
    { label: "访问次数", value: stats.visits.toLocaleString(), hint: "前台页面浏览，不含后台" },
    { label: "新增用户", value: stats.newUsers.toLocaleString(), hint: "选定时间内的注册" },
    { label: "新增订单", value: stats.newOrders.toLocaleString(), hint: "含待支付与已支付" },
    { label: "GMV", value: formatMoney(stats.gmvCents), hint: `已支付 ${stats.paidCount} 笔` },
    { label: "退款", value: `${stats.refundCount} / ${formatMoney(stats.refundCents)}`, hint: "退款笔数与金额" },
    { label: "新增 VIP", value: stats.newVip.toLocaleString(), hint: "新开通的订阅" },
    { label: "有效 VIP", value: stats.activeVip.toLocaleString(), hint: "当前仍在有效期内" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="admin-title">数据看板</h1>
          <p className="admin-hint">时间按 Asia/Shanghai。前台访问会在刷新后出现在本页。</p>
        </div>
        <form className="admin-card flex flex-wrap items-end gap-3 px-3 py-3" method="get">
          <label className="text-xs text-muted">
            开始
            <input
              type="datetime-local"
              step="1"
              name="from"
              className="input mt-1 h-9 py-1"
              defaultValue={formatShanghaiInputSec(start)}
            />
          </label>
          <label className="text-xs text-muted">
            结束
            <input
              type="datetime-local"
              step="1"
              name="to"
              className="input mt-1 h-9 py-1"
              defaultValue={formatShanghaiInputSec(end)}
            />
          </label>
          <button className="btn btn-gold btn-sm" type="submit">
            查询
          </button>
        </form>
      </div>

      <h2 className="mt-6 text-sm font-medium text-muted">关键指标</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="admin-card admin-card-metric">
            <p className="text-xs tracking-[0.06em] text-muted">{m.label}</p>
            <p className="admin-metric-value mt-2">{m.value}</p>
            <p className="mt-1.5 text-[11px] leading-5 text-muted">{m.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="admin-card overflow-hidden">
          <div className="border-b px-4 py-3 text-sm font-medium" style={{ borderColor: "var(--admin-border)" }}>
            来源统计
          </div>
          {stats.sources.length ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>来源</th>
                  <th>访问</th>
                  <th>注册</th>
                  <th>支付</th>
                  <th>GMV</th>
                </tr>
              </thead>
              <tbody>
                {stats.sources.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td>{r.visits}</td>
                    <td>{r.signups}</td>
                    <td>{r.payments}</td>
                    <td>{formatMoney(r.gmv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="admin-empty">这段时间内还没有访问。打开前台首页后再回到这里刷新即可。</p>
          )}
        </section>
        <section className="admin-card overflow-hidden">
          <div className="border-b px-4 py-3 text-sm font-medium" style={{ borderColor: "var(--admin-border)" }}>
            国家统计
          </div>
          {stats.countries.length ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>国家 / 地区</th>
                  <th>访问</th>
                  <th>注册</th>
                  <th>支付</th>
                  <th>GMV</th>
                </tr>
              </thead>
              <tbody>
                {stats.countries.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td>{r.visits}</td>
                    <td>{r.signups}</td>
                    <td>{r.payments}</td>
                    <td>{formatMoney(r.gmv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="admin-empty">
              暂无地区数据。若站点前接入 Cloudflare，将自动读取访问国家；本机预览可能显示为「未知」。
            </p>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="admin-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">热门剧集</h2>
            <Link href="/admin/shows" className="text-sm text-gold">
              管理
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {stats.popular.map((s) => (
              <li key={s.id} className="flex items-center justify-between">
                <Link href={`/admin/shows/${s.id}`} className="hover:text-gold">
                  {s.title}
                </Link>
                <span className="tabular-nums text-muted">{s.viewCount.toLocaleString()} 次播放</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="admin-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">最近订单</h2>
            <Link href="/admin/orders" className="text-sm text-gold">
              全部
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {stats.recentOrders.map((o) => (
              <li key={o.id} className="flex items-center justify-between">
                <span className="text-muted">
                  {o.user.email} · {o.type} · {o.status}
                </span>
                <span className="tabular-nums">{formatMoney(o.amountCents, o.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
