// Pixel TikTok — posé dès la V1 sur les pages publiques, sans exploitation
// fonctionnelle (les données de conversion s'accumulent pour la V3).
// Inactif tant que NEXT_PUBLIC_TIKTOK_PIXEL_ID est vide.
import Script from "next/script";

export default function TikTokPixel({
  event = "PageView",
  value,
}: {
  event?: "PageView" | "Purchase";
  value?: number;
}) {
  const id = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;
  if (!id) return null;

  const payload =
    event === "Purchase"
      ? `ttq.track('CompletePayment',{value:${Number(value ?? 0)},currency:'XAF'});`
      : `ttq.page();`;

  return (
    <Script id="ttq" strategy="lazyOnload">
      {`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=r+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${id}');${payload}}(window,document,'ttq');`}
    </Script>
  );
}
