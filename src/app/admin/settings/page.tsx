import { saveSettings } from "@/app/admin/actions";
import { getSettings, socialLinksOf } from "@/lib/settings";

export default async function SettingsAdmin() {
  const settings = await getSettings();
  const social = socialLinksOf(settings);
  return (
    <div className="max-w-3xl">
      <h1 className="admin-title">站点与广告像素</h1>
      <p className="mt-1 text-sm text-muted">
        默认标题、描述、OG 图与社交链接。前台品牌名仍可通过环境变量 NEXT_PUBLIC_SITE_NAME / SITE_URL 覆盖。
      </p>
      <form action={saveSettings} className="admin-card admin-form-stack mt-6 p-5 md:p-7">
        <div>
          <label className="label">站点名称</label>
          <input name="siteName" className="input" defaultValue={settings.siteName} />
        </div>
        <div>
          <label className="label">标语</label>
          <input name="tagline" className="input" defaultValue={settings.tagline} />
        </div>
        <div>
          <label className="label">默认 SEO 标题</label>
          <input name="seoTitle" className="input" defaultValue={settings.seoTitle} />
        </div>
        <div>
          <label className="label">默认 SEO / Meta 描述</label>
          <textarea name="seoDescription" className="input min-h-24" defaultValue={settings.seoDescription} />
        </div>
        <div>
          <label className="label">默认 OG 图片路径</label>
          <input name="ogImage" className="input" defaultValue={settings.ogImage} />
        </div>
        <div>
          <label className="label">客服邮箱</label>
          <input name="supportEmail" className="input" defaultValue={settings.supportEmail} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Twitter / X</label>
            <input name="twitter" className="input" defaultValue={social.twitter} />
          </div>
          <div>
            <label className="label">Instagram</label>
            <input name="instagram" className="input" defaultValue={social.instagram} />
          </div>
          <div>
            <label className="label">YouTube</label>
            <input name="youtube" className="input" defaultValue={social.youtube} />
          </div>
          <div>
            <label className="label">TikTok</label>
            <input name="tiktok" className="input" defaultValue={social.tiktok} />
          </div>
        </div>
        <h2 className="pt-4 font-medium">广告像素（选填，不要填写虚构 ID）</h2>
        <p className="text-xs text-muted">填写后前台会注入对应脚本，并在剧集页、定价/落地页、支付成功页分别发送 ViewContent、InitiateCheckout、Purchase。</p>
        <div>
          <label className="label">Meta Pixel ID</label>
          <input name="metaPixelId" className="input" defaultValue={settings.metaPixelId} placeholder="例如从 Events Manager 复制" />
        </div>
        <div>
          <label className="label">TikTok Pixel ID</label>
          <input name="tiktokPixelId" className="input" defaultValue={settings.tiktokPixelId} />
        </div>
        <div>
          <label className="label">Google tag (gtag) ID</label>
          <input name="googleTagId" className="input" defaultValue={settings.googleTagId} placeholder="G- 或 AW-" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Google Ads ID</label>
            <input name="googleAdsId" className="input" defaultValue={settings.googleAdsId} placeholder="AW-..." />
          </div>
          <div>
            <label className="label">Google Ads 转化标签</label>
            <input name="googleAdsLabel" className="input" defaultValue={settings.googleAdsLabel} />
          </div>
        </div>
        <button className="btn btn-gold btn-md" type="submit">
          保存设置
        </button>
      </form>
    </div>
  );
}
