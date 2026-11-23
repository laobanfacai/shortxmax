import { saveCoinPack } from "@/app/admin/actions";
import { prisma } from "@/lib/prisma";

export default async function CoinsAdmin() {
  const packs = await prisma.coinPackage.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <div>
      <h1 className="admin-title">金币套餐</h1>
      <p className="admin-hint">价格与启用状态会同步到前台 /pricing。用户可用金币解锁单集。</p>
      {packs.length === 0 ? <p className="admin-card admin-empty mt-6">还没有金币包。</p> : null}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {packs.map((pack) => (
          <form key={pack.id} action={saveCoinPack} className="admin-card p-5">
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
            <input type="hidden" name="sortOrder" value={pack.sortOrder} />
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" name="isEnabled" defaultChecked={pack.isEnabled} /> 启用（前台可见）
            </label>
            <button className="btn btn-gold btn-sm mt-3" type="submit">保存</button>
          </form>
        ))}
      </div>
    </div>
  );
}
