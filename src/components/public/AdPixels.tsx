import { pixelIds } from "@/lib/settings";
import { getSettings } from "@/lib/settings";
import { TrackInit } from "./TrackInit";

export async function AdPixels() {
  const settings = await getSettings();
  const ids = pixelIds(settings);
  const hasAny = ids.metaPixelId || ids.tiktokPixelId || ids.googleTagId || ids.googleAdsId;
  if (!hasAny) return <TrackInit ids={ids} />;

  return (
    <>
      {ids.metaPixelId ? (
        <script
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${ids.metaPixelId}');fbq('track','PageView');`,
          }}
        />
      ) : null}
      {ids.tiktokPixelId ? (
        <script
          dangerouslySetInnerHTML={{
            __html: `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){var e=ttq._i[t]||[];for(var n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i='https://analytics.tiktok.com/i18n/pixel/events.js';ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=d.createElement('script');o.type='text/javascript';o.async=!0;o.src=i+'?sdkid='+e+'&lib='+t;var a=d.getElementsByTagName('script')[0];a.parentNode.insertBefore(o,a)};ttq.load('${ids.tiktokPixelId}');ttq.page();}(window,document,'ttq');`,
          }}
        />
      ) : null}
      {ids.googleTagId || ids.googleAdsId ? (
        <>
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${ids.googleTagId || ids.googleAdsId}`} />
          <script
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());${ids.googleTagId ? `gtag('config','${ids.googleTagId}');` : ""}${ids.googleAdsId ? `gtag('config','${ids.googleAdsId}');` : ""}`,
            }}
          />
        </>
      ) : null}
      <TrackInit ids={ids} />
    </>
  );
}
