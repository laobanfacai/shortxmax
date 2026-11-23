import { savePayments } from "@/app/admin/actions";
import { getPaymentConfig } from "@/lib/payments";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/lib/site";

export default async function PaymentsAdmin() {
  const [settings, methods, pay] = await Promise.all([
    getSettings(),
    prisma.paymentMethod.findMany({ orderBy: { sortOrder: "asc" } }),
    getPaymentConfig(),
  ]);
  const stripeHook = `${siteConfig.url}/api/webhooks/stripe`;
  const paypalHook = `${siteConfig.url}/api/webhooks/paypal`;
  return (
    <div className="max-w-3xl">
      <h1 className="admin-title">支付收款</h1>
      <p className="mt-1 text-sm text-muted">
        可同时启用 PayPal 与 Stripe，并保留 Demo Pay 用于无密钥预览完整订阅漏斗。密钥优先读取环境变量，其次使用本页保存的值。已保存的密钥留空再提交不会被覆盖。
      </p>
      <div className="mt-6 rounded-2xl border bg-surface p-5 text-sm" style={{ borderColor: "var(--admin-border)" }}>
        <p>
          当前：Demo Pay {pay.demoPayEnabled ? "已开启" : "关闭"}；Stripe {pay.stripeReady ? `已就绪（${pay.stripeMode === "live" ? "正式" : "测试"}）` : "未配置完整密钥"}；PayPal {pay.paypalReady ? `已就绪（${pay.paypalMode === "live" ? "正式" : "沙盒"}）` : "未配置完整密钥"}。
        </p>
      </div>

      <form action={savePayments} className="mt-6 space-y-6">
        <section className="space-y-3 rounded-2xl border bg-surface p-5" style={{ borderColor: "var(--admin-border)" }}>
          <h2 className="font-medium">Demo Pay</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="demoPayEnabled" defaultChecked={settings.demoPayEnabled} />
            启用 Demo Pay（不真实扣款，支付后立即开通）
          </label>
        </section>

        <section className="space-y-3 rounded-2xl border bg-surface p-5" style={{ borderColor: "var(--admin-border)" }}>
          <h2 className="font-medium">Stripe</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="stripeEnabled" defaultChecked={settings.stripeEnabled} /> 启用 Stripe
          </label>
          <div>
            <label className="label">模式</label>
            <select name="stripeMode" className="input" defaultValue={settings.stripeMode || "test"}>
              <option value="test">测试（test / pk_test_ / sk_test_）</option>
              <option value="live">正式（live / pk_live_ / sk_live_）</option>
            </select>
          </div>
          <div>
            <label className="label">测试 Publishable Key{settings.stripePublicKey ? "（已保存，留空不改）" : ""}</label>
            <input name="stripePublicKey" className="input" placeholder="pk_test_..." autoComplete="off" />
          </div>
          <div>
            <label className="label">测试 Secret Key{settings.stripeSecretKey ? "（已保存，留空不改）" : ""}</label>
            <input name="stripeSecretKey" type="password" className="input" placeholder="sk_test_..." autoComplete="new-password" />
          </div>
          <div>
            <label className="label">测试 Webhook Secret{settings.stripeWebhookSec ? "（已保存，留空不改）" : ""}</label>
            <input name="stripeWebhookSec" type="password" className="input" placeholder="whsec_..." autoComplete="new-password" />
          </div>
          <div>
            <label className="label">正式 Publishable Key{settings.stripeLivePublicKey ? "（已保存，留空不改）" : ""}</label>
            <input name="stripeLivePublicKey" className="input" placeholder="pk_live_..." autoComplete="off" />
          </div>
          <div>
            <label className="label">正式 Secret Key{settings.stripeLiveSecretKey ? "（已保存，留空不改）" : ""}</label>
            <input name="stripeLiveSecretKey" type="password" className="input" placeholder="sk_live_..." autoComplete="new-password" />
          </div>
          <div>
            <label className="label">正式 Webhook Secret{settings.stripeLiveWebhookSec ? "（已保存，留空不改）" : ""}</label>
            <input name="stripeLiveWebhookSec" type="password" className="input" placeholder="whsec_..." autoComplete="new-password" />
          </div>
          <div className="rounded-xl bg-black/20 p-4 text-sm text-muted">
            <p className="text-ink">Webhook 端点（测试与正式各添加一条，选择对应模式的密钥）</p>
            <code className="mt-1 block break-all text-gold-soft">{stripeHook}</code>
            <p className="mt-2">监听：checkout.session.completed</p>
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border bg-surface p-5" style={{ borderColor: "var(--admin-border)" }}>
          <h2 className="font-medium">PayPal</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="paypalEnabled" defaultChecked={settings.paypalEnabled} /> 启用 PayPal
          </label>
          <div>
            <label className="label">模式</label>
            <select name="paypalMode" className="input" defaultValue={settings.paypalMode || "sandbox"}>
              <option value="sandbox">沙盒（sandbox）</option>
              <option value="live">正式（live）</option>
            </select>
          </div>
          <div>
            <label className="label">Client ID{settings.paypalClientId ? "（已保存，留空不改）" : ""}</label>
            <input name="paypalClientId" className="input" autoComplete="off" />
          </div>
          <div>
            <label className="label">Secret{settings.paypalSecret ? "（已保存，留空不改）" : ""}</label>
            <input name="paypalSecret" type="password" className="input" autoComplete="new-password" />
          </div>
          <div>
            <label className="label">Webhook ID（可选，用于验签）{settings.paypalWebhookId ? "（已保存，留空不改）" : ""}</label>
            <input name="paypalWebhookId" className="input" autoComplete="off" />
          </div>
          <div className="rounded-xl bg-black/20 p-4 text-sm text-muted">
            <p className="text-ink">Webhook 端点</p>
            <code className="mt-1 block break-all text-gold-soft">{paypalHook}</code>
            <p className="mt-2">
              在 PayPal Developer Dashboard 添加 Webhook，监听 PAYMENT.CAPTURE.COMPLETED（建议同时监听 CHECKOUT.ORDER.APPROVED）。用户从 PayPal 返回后站点会立即 capture；Webhook 作为补单。
            </p>
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border bg-surface p-5" style={{ borderColor: "var(--admin-border)" }}>
          <h2 className="font-medium">前台展示的收款方式</h2>
          <div className="space-y-2">
            {methods.map((m) => (
              <label key={m.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--admin-border)" }}>
                <span>
                  {m.name}
                  <span className="ml-2 text-xs text-muted">{m.description}</span>
                </span>
                <span className="flex items-center gap-2">
                  <input type="checkbox" name={`method_${m.id}`} defaultChecked={m.isEnabled} /> 启用
                </span>
              </label>
            ))}
          </div>
        </section>

        <button className="btn btn-gold btn-md" type="submit">
          保存支付设置
        </button>
      </form>
    </div>
  );
}
