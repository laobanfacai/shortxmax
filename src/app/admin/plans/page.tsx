import { saveCoinPack, savePlan } from "@/app/admin/actions";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";

export default async function PlansAdmin() {
  const [plans, packs] = await Promise.all([
    prisma.plan.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.coinPackage.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <div>
      <h1 className="admin-title">订阅套餐</h1>
      <p className="mt-1 text-sm text-muted">设置 VIP 周期、价格、权益与金币包。价格以美元填写。</p>
      <div className="mt-6 space-y-5">
        {plans.map((plan) => (
          <form key={plan.id} action={savePlan} className="rounded-2xl border border-white/10 bg-surface p-5">
            <input type="hidden" name="id" value={plan.id} />
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <label className="label">名称</label>
                <input name="name" className="input" defaultValue={plan.name} />
              </div>
              <div>
                <label className="label">Slug</label>
                <input name="slug" className="input" defaultValue={plan.slug} />
              </div>
              <div>
                <label className="label">周期</label>
                <select name="period" className="input" defaultValue={plan.period}>
                  <option value="weekly">每周</option>
                  <option value="monthly">每月</option>
                  <option value="yearly">每年</option>
                </select>
              </div>
              <div>
                <label className="label">价格（美元）</label>
                <input name="price" type="number" step="0.01" className="input" defaultValue={plan.priceCents / 100} />
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">权益（每行一条，英文前台展示）</label>
                <textarea name="perks" className="input min-h-24" defaultValue={parseJsonArray(plan.perks).join("\n")} />
              </div>
              <div>
                <label className="label">角标</label>
                <input name="badge" className="input" defaultValue={plan.badge || ""} />
                <label className="label mt-3">Stripe Price ID（可选）</label>
                <input name="stripePriceId" className="input" defaultValue={plan.stripePriceId || ""} />
                <input type="hidden" name="currency" value={plan.currency} />
                <input type="hidden" name="sortOrder" value={plan.sortOrder} />
              </div>
            </div>
            <div className="mt-3 flex gap-5 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isPopular" defaultChecked={plan.isPopular} /> 推荐
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isEnabled" defaultChecked={plan.isEnabled} /> 启用
              </label>
              <button className="btn btn-gold btn-sm" type="submit">
                保存套餐
              </button>
            </div>
          </form>
        ))}
      </div>

      <h2 className="mt-12 text-lg font-medium">金币包（也可在左侧「金币套餐」中单独管理）</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {packs.map((pack) => (
          <form key={pack.id} action={saveCoinPack} className="rounded-2xl border border-white/10 bg-surface p-5">
            <input type="hidden" name="id" value={pack.id} />
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">名称</label>
                <input name="name" className="input" defaultValue={pack.name} />
              </div>
              <div>
                <label className="label">价格（美元）</label>
                <input name="price" type="number" step="0.01" className="input" defaultValue={pack.priceCents / 100} />
              </div>
              <div>
                <label className="label">金币</label>
                <input name="coins" type="number" className="input" defaultValue={pack.coins} />
              </div>
              <div>
                <label className="label">赠送金币</label>
                <input name="bonusCoins" type="number" className="input" defaultValue={pack.bonusCoins} />
              </div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" name="isEnabled" defaultChecked={pack.isEnabled} /> 启用
            </label>
            <button className="btn btn-gold btn-sm mt-3" type="submit">
              保存
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
