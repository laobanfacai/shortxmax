import { ConfirmButton } from "@/components/admin/ConfirmButton";
import Link from "next/link";
import { refundOrder } from "@/app/admin/actions";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/utils";

export default async function OrdersAdmin() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { email: true, name: true } }, plan: true, coinPackage: true },
  });
  return (
    <div>
      <h1 className="admin-title">订单列表</h1>
      <p className="mt-1 text-sm text-muted">Demo 订单可撤销示例权益，无真实扣款。真实支付退款需在支付平台处理并人工核对权益，本站不会假装完成外部退款。</p>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-white/5 text-muted">
            <tr>
              <th className="px-3 py-3 font-medium">时间</th>
              <th className="px-3 py-3 font-medium">用户</th>
              <th className="px-3 py-3 font-medium">类型</th>
              <th className="px-3 py-3 font-medium">渠道</th>
              <th className="px-3 py-3 font-medium">金额</th>
              <th className="px-3 py-3 font-medium">状态</th>
              <th className="px-3 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-white/5">
                <td className="px-3 py-3 text-muted">{o.createdAt.toLocaleString("zh-CN")}</td>
                <td className="px-3 py-3"><Link href={`/admin/users/${o.userId}`} className="text-gold">{o.user.email}</Link></td>
                <td className="px-3 py-3">
                  {o.type}
                  {o.plan ? ` · ${o.plan.name}` : ""}
                  {o.coinPackage ? ` · ${o.coinPackage.name}` : ""}
                </td>
                <td className="px-3 py-3">{o.provider === "demo" ? "Demo 示例（无扣款）" : o.provider}</td>
                <td className="px-3 py-3">{formatMoney(o.amountCents, o.currency)}</td>
                <td className="px-3 py-3">{o.status}</td>
                <td className="px-3 py-3">
                  {o.status === "paid" && o.provider === "demo" ? (
                    <form action={refundOrder}>
                      <input type="hidden" name="id" value={o.id} />
                      <ConfirmButton className="text-gold" message="确认撤销 Demo 订单权益？不执行任何真实资金退款。">撤销示例权益</ConfirmButton>
                    </form>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 ? <p className="p-6 text-sm text-muted">暂无订单。</p> : null}
      </div>
    </div>
  );
}
