import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { t, normalizeLang, type Lang } from "@/lib/i18n";
import { fcfa } from "@/lib/format";
import { parseSource, recordVisit, keepAttribution } from "@/lib/track";
import { tiktokVideoId } from "@/lib/whatsapp";
import { canAcceptPayment } from "@/lib/payments";
import { photosByProduct } from "@/lib/photos";
import TikTokEmbed from "@/components/TikTokEmbed";
import TikTokPixel from "@/components/TikTokPixel";

export const dynamic = "force-dynamic";

type SP = { v?: string; src?: string; variant?: string };
type Props = { params: Promise<{ slug: string; id: string }>; searchParams: SP };

const GRADS = [
  "from-[#FBE3D2] to-[#F2B98F]",
  "from-[#D9E6F6] to-[#A9C3E8]",
  "from-[#EFE0F6] to-[#CBAAE2]",
  "from-[#E0F0E4] to-[#A9D4B4]",
];

async function getData(slug: string, id: string) {
  const shop = await db
    .selectFrom("shops")
    .innerJoin("sellers", "sellers.id", "shops.seller_id")
    .select([
      "shops.id", "shops.slug", "shops.name", "shops.momo_enabled",
      "shops.suspended", "shops.payment_mode", "shops.momo_number",
      "sellers.lang as seller_lang", "sellers.phone as seller_phone",
    ])
    .where("shops.slug", "=", slug)
    .executeTakeFirst();
  if (!shop) return null;
  const product = await db
    .selectFrom("products")
    .selectAll()
    .where("id", "=", id)
    .where("shop_id", "=", shop.id)
    .where("removed", "=", 0)
    .executeTakeFirst();
  if (!product) return null;
  const variants = await db
    .selectFrom("variants")
    .selectAll()
    .where("product_id", "=", product.id)
    .execute();

  // V2 : vidéo synchronisée taguée sur cet article (prioritaire sur video_url)
  const taggedVideo = await db
    .selectFrom("video_products")
    .innerJoin("videos", "videos.id", "video_products.video_id")
    .select(["videos.tiktok_video_id", "videos.title", "videos.views"])
    .where("video_products.product_id", "=", product.id)
    .where("videos.shop_id", "=", shop.id)
    .orderBy("videos.published_at", "desc")
    .executeTakeFirst();

  // avis vérifiés publiés
  const reviews = await db
    .selectFrom("reviews")
    .select(["id", "rating", "comment", "reply", "submitted_at"])
    .where("product_id", "=", product.id)
    .where("status", "=", "published")
    .orderBy("submitted_at", "desc")
    .limit(5)
    .execute();
  const ratingAgg = await db
    .selectFrom("reviews")
    .select([db.fn.avg<number>("rating").as("avg"), db.fn.countAll<number>().as("n")])
    .where("product_id", "=", product.id)
    .where("status", "=", "published")
    .executeTakeFirst();

  const photo = (await photosByProduct([product.id])).get(product.id) ?? null;

  return { shop, product, photo, variants, taggedVideo, reviews, ratingAgg };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const data = await getData(params.slug, params.id);
  if (!data) return {};
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  return {
    title: `${data.product.name} — ${data.shop.name}`,
    description: `${fcfa(data.product.price_fcfa)} · ${data.shop.name}`,
    openGraph: {
      title: data.product.name,
      description: `${fcfa(data.product.price_fcfa)} · ${data.shop.name} · Tara`,
      url: `${base}/${data.shop.slug}/p/${data.product.id}`,
      type: "website",
      siteName: "Tara",
      images: [
        {
          url: `${base}/${data.shop.slug}/og?p=${data.product.id}`,
          width: 1200,
          height: 630,
          alt: data.product.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: data.product.name,
      description: `${fcfa(data.product.price_fcfa)} · ${data.shop.name} · Tara`,
      images: [`${base}/${data.shop.slug}/og?p=${data.product.id}`],
    },
  };
}

export default async function ProductPage(props: Props) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const data = await getData(params.slug, params.id);
  if (!data || data.shop.suspended === 1) notFound();
  const { shop, product, photo, variants, taggedVideo, reviews, ratingAgg } = data;
  const lang: Lang = normalizeLang(shop.seller_lang);
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const attribution = keepAttribution(searchParams);

  // tracking de la visite produit
  await recordVisit({
    shopId: shop.id,
    productId: product.id,
    source: parseSource(searchParams),
    userAgent: (await headers()).get("user-agent"),
  });

  // variantes groupées par label ; sélection portée par ?variant=
  const groups = new Map<string, string[]>();
  for (const v of variants) {
    groups.set(v.label, [...(groups.get(v.label) ?? []), v.value]);
  }
  const selected = typeof searchParams.variant === "string" ? searchParams.variant : null;

  const source = parseSource(searchParams);
  // V2 (vidéo synchronisée) prioritaire, sinon V1 (URL collée à la main)
  const videoId = taggedVideo
    ? taggedVideo.tiktok_video_id
    : product.video_url
      ? tiktokVideoId(product.video_url)
      : null;
  const videoCaption = taggedVideo
    ? `« ${taggedVideo.title} » — ${taggedVideo.views.toLocaleString("fr-FR")} vues · synchronisée via l'API officielle`
    : lang === "en"
      ? "TikTok video embedded via the public oEmbed API."
      : "Vidéo TikTok intégrée via l'API oEmbed publique.";
  const out = product.stock_state === "out";
  const canPay = canAcceptPayment(shop);

  const variantHref = (value: string) => {
    const p = new URLSearchParams();
    if (typeof searchParams.v === "string") p.set("v", searchParams.v);
    if (typeof searchParams.src === "string") p.set("src", searchParams.src);
    p.set("variant", value);
    return `/${shop.slug}/p/${product.id}?${p.toString()}`;
  };

  return (
    <main className="mx-auto max-w-md pb-10">
      <TikTokPixel />
      {/* barre retour */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-ink/[0.06] bg-sand/90 px-4 py-3 backdrop-blur-md">
        <Link
          href={`/${shop.slug}${attribution}`}
          aria-label="Retour"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/10 bg-cream shadow-insetHair transition-transform active:scale-90"
        >
          ←
        </Link>
        <b className="truncate text-sm">{product.name}</b>
      </div>

      {/* visuel : la photo de la vendeuse si elle en a mis une */}
      {photo ? (
        // Image déjà en WebP 800 px : pas d'optimiseur, pas de JavaScript
        // (R2). Chargement immédiat — c'est le visuel principal, celui qui
        // décide de l'achat.
        <img
          src={photo}
          alt={product.name}
          width={800}
          height={1000}
          decoding="async"
          className="aspect-[4/5] w-full bg-sand object-cover"
        />
      ) : (
        <div
          className={`flex aspect-[4/5] items-center justify-center bg-gradient-to-br text-6xl ${GRADS[product.position % 4]}`}
        >
          🛍️
        </div>
      )}

      <section className="relative -mt-5 rounded-t-[28px] border-t border-ink/[0.06] bg-cream px-5 pb-6 pt-5 shadow-[0_-12px_32px_-18px_rgba(37,47,104,.25)]">
        <div aria-hidden className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-ink/10" />
        <p className="text-[10.5px] font-extrabold uppercase tracking-micro text-inkSoft">
          {shop.name}
        </p>
        <h1 className="mt-1 font-display text-[21px] leading-snug tracking-tight">{product.name}</h1>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <p className="font-display text-[26px] tabular-nums tracking-tight">
            {fcfa(product.price_fcfa)}
          </p>
          {!out && (
            <p
              className={`chip shrink-0 font-extrabold ${
                product.stock_state === "low"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-emerald-50 text-okgreen"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {product.stock_state === "low" ? t(lang, "shop.lowStock") : t(lang, "shop.inStock")}
            </p>
          )}
        </div>

        {/* variantes */}
        {[...groups.entries()].map(([label, values]) => (
          <div key={label} className="mt-4">
            <p className="label-micro">{label}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {values.map((value) => (
                <Link
                  key={value}
                  href={variantHref(value)}
                  replace
                  className={`min-w-[52px] rounded-full border px-4 py-2 text-center text-sm font-bold transition-transform active:scale-95 ${
                    selected === value
                      ? "border-indigo9 bg-indigo9 text-white shadow-card"
                      : "border-ink/10 bg-cream text-ink shadow-insetHair"
                  }`}
                >
                  {value}
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* vidéo TikTok (click-to-load) */}
        {videoId && (
          <div className="mt-5">
            <TikTokEmbed
              videoId={videoId}
              label={t(lang, "shop.seenInVideos")}
              caption={videoCaption}
            />
          </div>
        )}

        {/* Accordéons natifs <details> : le geste e-commerce, sans JavaScript */}
        <div className="mt-6">
          {product.description && (
            <details className="acc" open>
              <summary>{t(lang, "pdp.description")}</summary>
              <p className="-mt-1 pb-4 text-sm leading-relaxed text-inkSoft">
                {product.description}
              </p>
            </details>
          )}
          <details className="acc">
            <summary>{t(lang, "pdp.payDelivery")}</summary>
            <p className="-mt-1 pb-4 text-sm leading-relaxed text-inkSoft">
              🔒 {t(lang, "shop.securePayment")}
            </p>
          </details>
        </div>

        {reviews.length > 0 && (
          <div className="mt-6 border-t border-ink/[0.07] pt-4">
            <p className="text-sm font-extrabold">
              {lang === "en" ? "Verified reviews" : "Avis vérifiés"} ({Number(ratingAgg?.n ?? 0)}){" "}
              <span className="text-[#E8A413]">
                {"★".repeat(Math.round(Number(ratingAgg?.avg ?? 0)))} {Number(ratingAgg?.avg ?? 0).toFixed(1)}
              </span>
            </p>
            <div className="mt-2 flex flex-col gap-2">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-2xl border border-ink/[0.06] bg-sand/60 p-3 text-xs">
                  <p className="text-[#E8A413]">{"★".repeat(r.rating ?? 0)}</p>
                  {r.comment && <p className="text-gray-600">« {r.comment} »</p>}
                  <p className="text-[10px] font-bold text-okgreen">
                    ✓ {lang === "en" ? "Verified purchase" : "Achat vérifié"}
                  </p>
                  {r.reply && (
                    <p className="mt-1 rounded-lg bg-sand px-2 py-1 text-[11px] text-gray-600">
                      ↳ {shop.name} : {r.reply}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Barre d'achat COLLANTE : les boutons ne passent plus jamais sous la
          ligne de flottaison, quel que soit l'écran. Formulaires POST natifs,
          position:sticky — zéro JavaScript (R2). */}
      <div className="sticky bottom-0 z-10 border-t border-ink/[0.06] bg-cream/95 px-4 pb-[max(0.9rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
        <div className="flex flex-col gap-2">
          {!out && (
            <form method="post" action={`/${shop.slug}/commander`}>
              <input type="hidden" name="product" value={product.id} />
              {selected && <input type="hidden" name="variant" value={selected} />}
              <input type="hidden" name="qty" value="1" />
              <input type="hidden" name="source" value={source} />
              <button type="submit" className="btn-wa py-3.5 text-sm">
                💬 {t(lang, "shop.orderWhatsApp")}
              </button>
            </form>
          )}
          {!out && canPay && (
            <form method="post" action={`/${shop.slug}/commander`}>
              <input type="hidden" name="product" value={product.id} />
              {selected && <input type="hidden" name="variant" value={selected} />}
              <input type="hidden" name="qty" value="1" />
              <input type="hidden" name="source" value={source} />
              <input type="hidden" name="action" value="pay" />
              <button type="submit" className="btn-mango py-3.5 text-sm">
                💰 {t(lang, "shop.payMomo")}
              </button>
            </form>
          )}
          {out && (
            <span className="btn bg-ink/5 py-3.5 text-sm text-ink/40">
              {t(lang, "shop.outOfStock")}
            </span>
          )}
        </div>
        <p className="mt-2 text-center text-[10.5px] text-inkSoft">
          🔒 {t(lang, "shop.securePayment")}
        </p>
      </div>
    </main>
  );
}
