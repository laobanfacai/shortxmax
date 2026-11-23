import { deletePromo, savePromo } from "@/app/admin/actions";
import { prisma } from "@/lib/prisma";
import { formatShanghaiDisplay, formatShanghaiInput } from "@/lib/time";
import { formatMoney } from "@/lib/utils";

export default async function PromosAdmin() {
  const [campaigns, plans, packs] = await Promise.all([
    prisma.promoCampaign.findMany({ orderBy: { startsAt: "desc" } }),
    prisma.plan.findMany({ where: { isEnabled: true }, orderBy: { sortOrder: "asc" } }),
    prisma.coinPackage.findMany({ where: { isEnabled: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const now = new Date();

  function priceMap(raw: string) {
    try {
      const arr = JSON.parse(raw) as { id: string; promoCents: number }[];
      return Object.fromEntries(arr.map((r) => [r.id, r.promoCents]));
    } catch {
      return {} as Record<string, number>;
    }
  }

  return (
    <div>
      <h1 className="admin-title">优惠活动</h1>
      <p className="mt-1 text-sm text-muted">
        配置活动名称、角标、适用套餐/金币包的促销价，以及开始/结束时间（Asia/Shanghai，UTC+8）。开启倒计时后，前台顶栏、定价页、广告落地页与付费墙会实时倒数，无需刷新整页。
      </p>

      <form action={savePromo} className="mt-8 space-y-4 rounded-2xl border bg-surface p-5" style={{ borderColor: "var(--admin-border)" }}>
        <h2 className="font-medium">新建活动</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">活动名称（后台识别）</label>
            <input name="name" className="input" required placeholder="例如：7 天开播特惠" />
          </div>
          <div>
            <label className="label">角标（英文前台，如 7-DAY LAUNCH SALE）</label>
            <input name="badge" className="input" />
          </div>
        </div>
        <div>
          <label className="label">前台标题</label>
          <input name="headline" className="input" placeholder="Finish the story at a launch price." />
        </div>
        <div>
          <label className="label">前台说明</label>
          <textarea name="description" className="input min-h-20" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">开始时间（上海）</label>
            <input name="startsAt" type="datetime-local" className="input" required />
          </div>
          <div>
            <label className="label">结束时间（上海）</label>
            <input name="endsAt" type="datetime-local" className="input" required />
          </div>
        </div>
        <p className="text-xs text-muted">勾选要参与活动的套餐，并填写促销价（美元）。原价来自套餐设置。</p>
        <div className="grid gap-3 md:grid-cols-3">
          {plans.map((plan) => (
            <label key={plan.id} className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--admin-border)" }}>
              <span className="flex items-center gap-2">
                <input type="checkbox" name="planId" value={plan.id} defaultChecked={plan.slug !== "weekly"} />
                {plan.name}（原价 {formatMoney(plan.priceCents, plan.currency)}）
              </span>
              <input
                name={`planPrice_${plan.id}`}
                type="number"
                step="0.01"
                className="input mt-2"
                defaultValue={(plan.priceCents / 200).toFixed(2)}
              />
            </label>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          {packs.map((pack) => (
            <label key={pack.id} className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--admin-border)" }}>
              <span className="flex items-center gap-2">
                <input type="checkbox" name="coinId" value={pack.id} />
                {pack.name}（{formatMoney(pack.priceCents)}）
              </span>
              <input name={`coinPrice_${pack.id}`} type="number" step="0.01" className="input mt-2" defaultValue={(pack.priceCents / 100).toFixed(2)} />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="showCountdown" defaultChecked /> 显示倒计时
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isEnabled" defaultChecked /> 启用
          </label>
        </div>
        <button className="btn btn-gold btn-md" type="submit">
          创建活动
        </button>
      </form>

      <div className="mt-10 space-y-5">
        {campaigns.length === 0 ? <p className="text-sm text-muted">暂无活动。</p> : null}
        {campaigns.map((c) => {
          const pm = priceMap(c.planPrices);
          const cm = priceMap(c.coinPrices);
          const live = c.isEnabled && c.startsAt <= now && c.endsAt > now;
          const upcoming = c.isEnabled && c.startsAt > now;
          return (
            <form key={c.id} action={savePromo} className="space-y-4 rounded-2xl border bg-surface p-5" style={{ borderColor: "var(--admin-border)" }}>
              <input type="hidden" name="id" value={c.id} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {c.name}{" "}
                  <span className="text-xs text-muted">
                    {live ? "● 进行中" : upcoming ? "○ 未开始" : "— 已结束或关闭"}
                    {" · "}
                    {formatShanghaiDisplay(c.startsAt)} ~ {formatShanghaiDisplay(c.endsAt)}（上海）
                  </span>
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="label">名称</label>
                  <input name="name" className="input" defaultValue={c.name} />
                </div>
                <div>
                  <label className="label">角标</label>
                  <input name="badge" className="input" defaultValue={c.badge} />
                </div>
              </div>
              <div>
                <label className="label">前台标题</label>
                <input name="headline" className="input" defaultValue={c.headline} />
              </div>
              <div>
                <label className="label">说明</label>
                <textarea name="description" className="input min-h-16" defaultValue={c.description} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="label">开始（上海）</label>
                  <input name="startsAt" type="datetime-local" className="input" defaultValue={formatShanghaiInput(c.startsAt)} />
                </div>
                <div>
                  <label className="label">结束（上海）</label>
                  <input name="endsAt" type="datetime-local" className="input" defaultValue={formatShanghaiInput(c.endsAt)} />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {plans.map((plan) => (
                  <label key={plan.id} className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--admin-border)" }}>
                    <span className="flex items-center gap-2">
                      <input type="checkbox" name="planId" value={plan.id} defaultChecked={plan.id in pm} />
                      {plan.name}（原价 {formatMoney(plan.priceCents)}）
                    </span>
                    <input
                      name={`planPrice_${plan.id}`}
                      type="number"
                      step="0.01"
                      className="input mt-2"
                      defaultValue={((pm[plan.id] ?? plan.priceCents) / 100).toFixed(2)}
                    />
                  </label>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                {packs.map((pack) => (
                  <label key={pack.id} className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--admin-border)" }}>
                    <span className="flex items-center gap-2">
                      <input type="checkbox" name="coinId" value={pack.id} defaultChecked={pack.id in cm} />
                      {pack.name}
                    </span>
                    <input
                      name={`coinPrice_${pack.id}`}
                      type="number"
                      step="0.01"
                      className="input mt-2"
                      defaultValue={((cm[pack.id] ?? pack.priceCents) / 100).toFixed(2)}
                    />
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-5 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="showCountdown" defaultChecked={c.showCountdown} /> 倒计时
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="isEnabled" defaultChecked={c.isEnabled} /> 启用
                </label>
                <button className="btn btn-gold btn-sm" type="submit">
                  保存
                </button>
                <button formAction={deletePromo} className="btn btn-ghost btn-sm text-danger" type="submit">
                  删除
                </button>
              </div>
            </form>
          );
        })}
      </div>
    </div>
  );
}
