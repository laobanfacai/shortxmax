import { deleteStorageEndpoint, testAndSaveR2 } from "@/app/admin/actions";
import { getUploadTarget } from "@/lib/storage";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { formatShanghaiDisplay } from "@/lib/time";
import { resolveR2Studio, toPublicStatus } from "@/lib/r2-studio";
import { R2StudioPanel } from "@/components/admin/R2StudioPanel";

export default async function StorageAdmin({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; msg?: string }>;
}) {
  const sp = await searchParams;
  const [settings, endpoints, studio, target] = await Promise.all([
    getSettings(),
    prisma.storageEndpoint.findMany({ orderBy: { sortOrder: "asc" } }),
    resolveR2Studio(),
    getUploadTarget(),
  ]);
  const primary = endpoints[0];
  const modeLabel =
    target.target === "r2studio"
      ? "R2 Studio"
      : "R2 Studio（尚未就绪）";

  return (
    <div className="max-w-3xl">
      <h1 className="admin-title">存储设置</h1>
      <p className="admin-hint">
        封面和分集视频一律经 R2 Studio（r2.open-traffic.com）上传：本站服务端代为调用 Studio API，由 Studio 写入它管理的存储池。不要把已导入的官方桶凭证接到网站里当直传目标。没有 r2s_ Key 时不会回退本机磁盘，也不会悄悄改走官方 R2。
      </p>

      <div className="admin-card mt-6 p-5">
        <p className="text-sm">
          当前上传通道：<strong>{modeLabel}</strong>
          {target.target === "r2studio" ? " · 成功后会把 Studio 返回的公开地址写入封面/视频字段，前台可显示或播放" : null}
          {target.target === "none" ? " · 请在下方填写以 r2s_ 开头的 API Key 并测试连接。不要改选已导入的官方桶作为上传目标。" : null}
        </p>
        <p className="mt-3 text-xs text-muted">
          站点上已有的本机演示封面和视频仍可播放，这些旧文件不会删除。只是新的上传不再写入本地磁盘。
        </p>
      </div>

      <R2StudioPanel
        initial={{
          ...toPublicStatus(studio),
          activeTarget: target.target,
          ready: target.target !== "none",
        }}
      />

      <h2 className="mt-8 text-base font-medium">已导入的官方桶 / VPS 记录</h2>
      <p className="mt-2 text-xs text-muted">
        这些记录仅供查阅或测试连通性，不是网站的上传通道。新文件一律走上方的 R2 Studio。不要把官方桶 Access Key 再用于直传。
      </p>

      {sp.msg ? (
        <div
          className="admin-card mt-4 p-4 text-sm"
          style={{ borderColor: sp.ok === "1" ? "var(--color-gold)" : undefined }}
        >
          {sp.ok === "1" ? "测试成功：" : "测试未通过："}
          {sp.msg}
        </div>
      ) : null}

      <form action={testAndSaveR2} className="admin-card mt-4 space-y-3 p-5">
        {primary ? <input type="hidden" name="id" value={primary.id} /> : null}
        <input type="hidden" name="label" value={primary?.label || "正式 R2 桶"} />
        <div>
          <label className="label">1. 账户 ID</label>
          <input name="accountId" className="input" defaultValue={primary?.accountId} placeholder="Cloudflare 右上角复制" />
        </div>
        <div>
          <label className="label">2. 桶名</label>
          <input name="bucket" className="input" defaultValue={primary?.bucket} placeholder="例如 lumereel-media" />
        </div>
        <div>
          <label className="label">3. Access Key{primary?.accessKey ? "（已保存，留空则不修改）" : ""}</label>
          <input name="accessKey" className="input" autoComplete="off" />
        </div>
        <div>
          <label className="label">4. Secret Key{primary?.secretKey ? "（已保存，留空则不修改）" : ""}</label>
          <input name="secretKey" type="password" className="input" autoComplete="new-password" />
        </div>
        <div>
          <label className="label">5. 公开访问地址或自定义域名</label>
          <input name="publicBaseUrl" className="input" defaultValue={primary?.publicBaseUrl} placeholder="https://media.yourdomain.com" />
        </div>
        <details className="rounded-md border p-3 text-sm" style={{ borderColor: "var(--admin-border)" }}>
          <summary className="cursor-pointer text-muted">高级设置 / 再加一个存储节点</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">名称</label>
              <input name="label" className="input" defaultValue={primary?.label || "正式 R2 桶"} />
            </div>
            <div>
              <label className="label">S3 Endpoint（一般不用填，会按账户 ID 自动生成）</label>
              <input name="endpoint" className="input" defaultValue={primary?.endpoint} placeholder="https://<账户ID>.r2.cloudflarestorage.com" />
            </div>
            <div>
              <label className="label">Region</label>
              <input name="region" className="input" defaultValue={primary?.region || "auto"} />
            </div>
            <div>
              <label className="label">权重（轮询，越大越常被选中）</label>
              <input name="weight" type="number" className="input" defaultValue={primary?.weight ?? 1} />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            若要增加第二个备份桶，请先保存当前节点，再在下方「再加一个节点」中填写另一组密钥。
          </p>
        </details>
        <div className="flex flex-wrap gap-3">
          <button className="btn btn-outline-gold btn-md" type="submit">测试连接并保存记录</button>
        </div>
        <p className="text-xs text-muted">测试只会检查这张记录是否还能连通，不会把它设为上传目标，也不会改走官方桶直传。</p>
      </form>

      {endpoints.length > 0 ? (
        <div className="mt-6">
          <h2 className="text-sm font-medium">已保存的记录（不参与上传）</h2>
          <div className="mt-3 space-y-3">
            {endpoints.map((ep, i) => {
              const kind =
                ep.provider === "r2"
                  ? "Cloudflare R2"
                  : ep.provider === "garage" || ep.provider === "s3"
                    ? "Garage/VPS"
                    : ep.provider || "存储节点";
              const status = ep.lastError ? "连接失败" : ep.lastOkAt ? "连接成功" : "未测试";
              return (
              <div key={ep.id} className="admin-card flex flex-wrap items-center justify-between gap-3 p-4 text-sm" data-storage-node={ep.label || `节点 ${i + 1}`}>
                <div>
                  <p className="font-medium">{ep.label || `节点 ${i + 1}`}</p>
                  <p className="text-xs text-muted">
                    {kind} · 桶 {ep.bucket || "未填"} · {ep.isEnabled ? "启用" : "停用"} · {status}
                    {ep.lastOkAt ? ` · 最近成功 ${formatShanghaiDisplay(ep.lastOkAt)}` : ""}
                  </p>
                  {ep.publicBaseUrl ? (
                    <p className="mt-1 text-xs text-muted">公开地址 {ep.publicBaseUrl.replace(/\/$/, "")}</p>
                  ) : null}
                  {ep.lastError ? <p className="mt-1 text-xs text-danger">{ep.lastError}</p> : null}
                </div>
                <form action={deleteStorageEndpoint}>
                  <input type="hidden" name="id" value={ep.id} />
                  <button className="btn btn-ghost btn-sm text-danger" type="submit">删除</button>
                </form>
              </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <form action={testAndSaveR2} className="admin-card mt-6 space-y-3 p-5">
        <h2 className="text-sm font-medium">再加一条记录（可选）</h2>
        <p className="text-xs text-muted">仅作为查阅记录保存。填好后点测试连接，成功才会写入；它不会成为上传目标。</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">名称</label>
            <input name="label" className="input" placeholder="备份桶" />
          </div>
          <div>
            <label className="label">账户 ID</label>
            <input name="accountId" className="input" />
          </div>
          <div>
            <label className="label">桶名</label>
            <input name="bucket" className="input" />
          </div>
          <div>
            <label className="label">公开访问地址</label>
            <input name="publicBaseUrl" className="input" placeholder="https://media-backup.yourdomain.com" />
          </div>
          <div>
            <label className="label">Access Key</label>
            <input name="accessKey" className="input" autoComplete="off" />
          </div>
          <div>
            <label className="label">Secret Key</label>
            <input name="secretKey" type="password" className="input" autoComplete="new-password" />
          </div>
        </div>
        <button className="btn btn-outline-gold btn-sm" type="submit">测试并保存此节点</button>
      </form>
    </div>
  );
}
