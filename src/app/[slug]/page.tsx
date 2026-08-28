import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { t, normalizeLang, type Lang } from "@/lib/i18n";
import { fcfa } from "@/lib/format";
import { photosByProduct } from "@/lib/photos";
import { parseSource, recordVisit, keepAttribution } from "@/lib/track";
import TikTokPixel from "@/components/TikTokPixel";
import { getShopIdentity } from "@/lib/identities";
import { lockedProductIds, openDueDrops } from "@/lib/drops";

// Vitrine publique — SSR, zéro JS client.

export const dynamic = "force-dynamic";

type SP = { v?: string; src?: string; follow?: string };
type Props = { params: Promise<{ slug: string }>; searchParams: SP };

async function getShop(slug: string) {
  const shop = await db
    .selectFrom("shops")
    .innerJoin("sellers", "sellers.id", "shops.seller_id")
    .select([
      "shops.id", "shops.slug", "shops.name", "shops.city",
      "shops.banner_color", "shops.momo_enabled", "shops.suspended",
      "sellers.lang as seller_lang",
    ])
    .where("shops.slug", "=", slug)
    .executeTakeFirst();
  if (!shop) return null;

  const products = await db
    .selectFrom("products")
    .selectAll()
    .where("shop_id", "=", shop.id)
    .where("removed", "=", 0)
    .orderBy("position", "asc")
    .execute();

  // Photos des articles : une seule requête pour toute la vitrine.
  const photos = await photosByProduct(products.map((p) => p.id));

  // V2 : vidéos synchronisées avec au moins un article tagué
  const taggedVideos = await db
    .selectFrom("videos")
    .innerJoin("video_products", "video_products.video_id", "videos.id")
    .innerJoin("products", "products.id", "video_products.product_id")
    .select([
      "videos.id as video_id", "videos.title", "videos.views",
      "products.id as product_id", "products.name as product_name",
    ])
    .where("videos.shop_id", "=", shop.id)
    .where("products.removed", "=", 0)
    .orderBy("videos.published_at", "desc")
    .execute();

  const identity = await getShopIdentity(shop.id);

  // V2 — drops : ouvre ceux arrivés à échéance, masque les articles réservés
  await openDueDrops(shop.id);
  const locked = await lockedProductIds(shop.id);
  const nextDrop = await db
    .selectFrom("drops")
    .select(["id", "title", "opens_at"])
    .where("shop_id", "=", shop.id)
    .where("status", "=", "scheduled")
    .orderBy("opens_at", "asc")
    .executeTakeFirst();

  const sales = await db
    .selectFrom("orders")
    .select(db.fn.countAll<number>().as("n"))
    .where("shop_id", "=", shop.id)
    .where("status", "in", ["paid", "delivered"])
    .executeTakeFirst();

  return {
    shop,
    // les articles réservés à un drop non ouvert sont masqués partout
    products: products.filter((p) => !locked.has(p.id)),
    photos,
    taggedVideos: taggedVideos.filter((v) => !locked.has(v.product_id)),
    identity, nextDrop,
    salesCount: Number(sales?.n ?? 0),
  };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const data = await getShop(params.slug);
  if (!data) return {};
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  return {
    title: `${data.shop.name} — Tara`,
    description: `${data.shop.city} · ${data.products.length} articles · Commande WhatsApp, paiement Mobile Money.`,
    openGraph: {
      title: data.shop.name,
      description: `${data.shop.city} · Commande en 2 clics sur WhatsApp`,
      url: `${base}/${data.shop.slug}`,
      type: "website",
      siteName: "Tara",
      // aperçu généré à la volée : aucune vendeuse n'a de fichier à fournir
      images: [
        {
          url: `${base}/${data.shop.slug}/og`,
          width: 1200,
          height: 630,
          alt: data.shop.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: data.shop.name,
      description: `${data.shop.city} · Commande en 2 clics sur WhatsApp`,
      images: [`${base}/${data.shop.slug}/og`],
    },
  };
}

export default async function ShopPage(props: Props) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const data = await getShop(params.slug);
  if (!data || data.shop.suspended === 1) notFound();
  const { shop, products, photos, taggedVideos, identity, nextDrop, salesCount } = data;
  const lang: Lang = normalizeLang(shop.seller_lang);
  // V2 prioritaire : vidéos synchronisées + articles tagués ; sinon V1 (oEmbed manuel)
  const v2Videos = taggedVideos;
  const videos = v2Videos.length > 0 ? [] : products.filter((p) => p.video_url);
  const attr = keepAttribution(searchParams);

  await recordVisit({
    shopId: shop.id,
    source: parseSource(searchParams),
    userAgent: (await headers()).get("user-agent"),
  });

  return (
    <main className="mx-auto max-w-md pb-8">
      <TikTokPixel />
      {/* Ruban : la couleur de la vendeuse, réduite à une signature.
          Le reste de l'en-tête est clair — le produit est roi. */}
      <div className="h-1.5" style={{ background: shop.banner_color }} />
      <header className="px-5 pb-2 pt-6">
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl shadow-card ring-1 ring-ink/[0.06]"
            style={{ background: `linear-gradient(135deg, ${shop.banner_color}40, ${shop.banner_color}14)` }}
          >
            🛍️
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-display text-[22px] leading-tight tracking-tight">
              {shop.name}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] font-medium text-inkSoft">
              <span>📍 {shop.city}</span>
              <span className="text-ink/20">·</span>
              <span><b className="tabular-nums text-ink">{salesCount}</b> {t(lang, "shop.sales")}</span>
              {identity && (
                <>
                  <span className="text-ink/20">·</span>
                  <span className="font-bold text-indigo9">✓ @{identity.username}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* V2 — suivi de boutique (opt-in explicite) */}
        {searchParams.follow === "ok" ? (
          <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-bold text-okgreen">
            ✓ {lang === "en" ? "You will receive new arrivals on WhatsApp." : "Tu recevras les nouveautés sur WhatsApp."}
          </p>
        ) : (
          <details className="mt-4">
            <summary className="chip cursor-pointer border border-ink/10 bg-cream font-extrabold text-ink shadow-insetHair transition-colors active:bg-ink/5">
              🔔 {lang === "en" ? "Follow this shop" : "Suivre la boutique"}
            </summary>
            <form method="post" action={`/${shop.slug}/suivre`} className="mt-2.5 flex gap-1.5">
              <input
                name="phone"
                inputMode="tel"
                required
                placeholder="6 77 12 34 56"
                className="min-w-0 flex-1 rounded-xl border border-ink/10 bg-cream px-3 py-2.5 text-xs font-bold shadow-insetHair placeholder:text-ink/30 focus:border-indigo9 focus:outline-none"
              />
              <button className="rounded-xl bg-ink px-3.5 py-2.5 text-[11px] font-extrabold text-white transition-transform active:scale-95">
                {lang === "en" ? "Follow" : "Suivre"}
              </button>
            </form>
            <p className="mt-1.5 text-[10px] text-ink/40">
              {lang === "en"
                ? "Max 4 messages/month. Unsubscribe in one click."
                : "4 messages par mois maximum. Désabonnement en un clic."}
            </p>
          </details>
        )}
      </header>

      {/* V2 — prochain drop */}
      {nextDrop && (
        <Link
          href={`/${shop.slug}/drop/${nextDrop.id}`}
          className="grain mx-3 mt-3 flex items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-indigo9 via-indigoDeep to-indigoNight px-4 py-3.5 text-white shadow-card"
        >
          <span className="text-xl">📦</span>
          <span className="flex-1">
            <b className="block text-xs">DROP — {nextDrop.title}</b>
            <span className="text-[11px] opacity-80">
              {new Date(nextDrop.opens_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
            </span>
          </span>
          <span className="rounded-full bg-mango px-3 py-1.5 text-[11px] font-extrabold text-[#3A2A00]">Voir →</span>
        </Link>
      )}

      {/* vidéos taguées */}
      {v2Videos.length > 0 && (
        <>
          <h2 className="label-micro mx-4 mb-2.5 mt-6">{t(lang, "shop.seenInVideos")}</h2>
          <div className="rail flex gap-2.5 overflow-x-auto px-3 pb-1">
            {v2Videos.map((v) => (
              <Link
                key={`${v.video_id}-${v.product_id}`}
                href={`/${shop.slug}/p/${v.product_id}${attr ? attr + "&" : "?"}v=${v.video_id}`}
                className="relative h-40 w-[112px] shrink-0 overflow-hidden rounded-2xl bg-indigoNight text-[10px] font-semibold text-white shadow-card transition-transform active:scale-95"
              >
                {photos.get(v.product_id) && (
                  <img
                    src={photos.get(v.product_id)}
                    alt=""
                    width={224}
                    height={320}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-ink/20" />
                <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink/40 text-[9px] backdrop-blur-sm">▶</span>
                <span className="absolute bottom-2 left-2.5 right-2.5 leading-tight [text-shadow:0_1px_6px_rgba(0,0,0,.6)]">
                  {v.product_name}
                </span>
                <span className="absolute bottom-11 left-2.5 text-[9px] tabular-nums opacity-75">
                  {v.views.toLocaleString("fr-FR")} vues
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
      {videos.length > 0 && (
        <>
          <h2 className="label-micro mx-4 mb-2.5 mt-6">{t(lang, "shop.seenInVideos")}</h2>
          <div className="rail flex gap-2.5 overflow-x-auto px-3 pb-1">
            {videos.map((p) => (
              <Link
                key={p.id}
                href={`/${shop.slug}/p/${p.id}${attr}`}
                className="relative h-40 w-[112px] shrink-0 overflow-hidden rounded-2xl bg-indigoNight text-[10px] font-semibold text-white shadow-card transition-transform active:scale-95"
              >
                {photos.get(p.id) && (
                  <img
                    src={photos.get(p.id)}
                    alt=""
                    width={224}
                    height={320}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-ink/20" />
                <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink/40 text-[9px] backdrop-blur-sm">▶</span>
                <span className="absolute bottom-2 left-2.5 right-2.5 leading-tight [text-shadow:0_1px_6px_rgba(0,0,0,.6)]">
                  {p.name}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* grille articles */}
      <h2 className="label-micro mx-4 mb-2.5 mt-6">{t(lang, "shop.products")}</h2>
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 px-4">
        {products.map((p, i) => (
          <Link
            key={p.id}
            href={`/${shop.slug}/p/${p.id}${attr}`}
            className="group transition-transform active:scale-[0.98]"
          >
            <div className="relative overflow-hidden rounded-2xl bg-sand shadow-insetHair">
              {photos.get(p.id) ? (
                // Photo déjà redimensionnée en WebP à l'envoi : pas
                // d'optimiseur, aucune coût JavaScript (R2). width/height
                // réservent la place — la grille ne saute pas en 3G.
                <img
                  src={photos.get(p.id)}
                  alt={p.name}
                  width={600}
                  height={800}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[3/4] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[3/4] items-center justify-center bg-gradient-to-b from-sand to-ink/[0.04] text-3xl opacity-60">
                  🛍️
                </div>
              )}
              {p.video_url && (
                <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink/45 text-[10px] text-white backdrop-blur-sm">
                  ▶
                </span>
              )}
              {p.stock_state === "out" && (
                <span className="absolute inset-x-0 bottom-0 bg-ink/60 py-1.5 text-center text-[10px] font-extrabold uppercase tracking-micro text-white backdrop-blur-sm">
                  {t(lang, "shop.outOfStock")}
                </span>
              )}
            </div>
            <p className="mt-2 line-clamp-2 text-[12.5px] font-medium leading-snug text-ink">
              {p.name}
            </p>
            <p className="mt-0.5 text-[13.5px] font-bold tabular-nums tracking-tight">
              {fcfa(p.price_fcfa)}
              {p.stock_state === "low" && (
                <span className="ml-2 text-[10px] font-extrabold text-amber-600">
                  {t(lang, "shop.lowStock")}
                </span>
              )}
            </p>
          </Link>
        ))}
      </div>

      {/* pied de page viral */}
      <footer className="mt-10 px-6 text-center text-[11px] text-inkSoft">
        <div className="label-micro justify-center before:h-px before:flex-1 before:bg-ink/10 before:content-['']">
          {t(lang, "shop.createdWith")}
          <span className="font-display normal-case tracking-tight text-indigo9">tara<span className="text-mango">.</span></span>
        </div>
        <div className="mt-4">
          <Link
            href="/creer"
            className="inline-block rounded-full border border-indigo9/25 bg-cream px-5 py-2 text-[11px] font-extrabold text-indigo9 shadow-insetHair transition-transform active:scale-95"
          >
            ✨ {t(lang, "shop.createYours")} →
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-3 text-[10px] text-gray-400">
          <Link href="/cgu" className="underline">{t(lang, "legal.terms")}</Link>
          <Link href="/confidentialite" className="underline">{t(lang, "legal.privacy")}</Link>
          <Link href="/mentions-legales" className="underline">{t(lang, "legal.notice")}</Link>
        </div>
      </footer>
    </main>
  );
}
