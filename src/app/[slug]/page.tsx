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
      {/* bannière : la couleur de la vendeuse, éclairée — halos + grain, CSS pur */}
      <div
        className="grain h-36"
        style={{
          background: `radial-gradient(120% 90% at 85% -20%, rgba(255,255,255,.32), transparent 55%), radial-gradient(100% 80% at 0% 100%, rgba(20,25,54,.45), transparent 60%), linear-gradient(150deg, ${shop.banner_color}, #1A2148 130%)`,
        }}
      />
      {/* carte boutique */}
      <section className="card relative mx-3 -mt-14 p-5 shadow-float">
        <div className="absolute -top-9 left-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-br from-[#FFD9A8] to-[#D98A4A] text-[26px] shadow-card ring-4 ring-cream">
          🛍️
        </div>
        <h1 className="mt-7 font-display text-[22px] leading-tight tracking-tight">{shop.name}</h1>
        {identity && (
          <p className="chip mt-1.5 border border-indigo9/15 bg-indigo9/[0.06] font-extrabold text-indigo9">
            ✓ Compte TikTok vérifié · @{identity.username}
          </p>
        )}
        <p className="mt-1.5 text-xs font-semibold text-inkSoft">
          📍 {shop.city}
          <span className="mx-2 text-ink/20">·</span>
          <b className="tabular-nums text-ink">{salesCount}</b> {t(lang, "shop.sales")}
        </p>

        {/* V2 — suivi de boutique (opt-in explicite) */}
        {searchParams.follow === "ok" ? (
          <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-bold text-okgreen">
            ✓ {lang === "en" ? "You will receive new arrivals on WhatsApp." : "Tu recevras les nouveautés sur WhatsApp."}
          </p>
        ) : (
          <details className="mt-3">
            <summary className="chip cursor-pointer border border-ink/10 bg-sand font-extrabold text-indigo9 transition-colors active:bg-ink/5">
              🔔 {lang === "en" ? "Follow this shop" : "Suivre la boutique"}
            </summary>
            <form method="post" action={`/${shop.slug}/suivre`} className="mt-2 flex gap-1.5">
              <input
                name="phone"
                inputMode="tel"
                required
                placeholder="6 77 12 34 56"
                className="min-w-0 flex-1 rounded-xl border border-ink/10 bg-cream px-3 py-2.5 text-xs font-bold shadow-insetHair placeholder:text-ink/30 focus:border-indigo9 focus:outline-none"
              />
              <button className="rounded-xl bg-indigo9 px-3.5 py-2.5 text-[11px] font-extrabold text-white transition-transform active:scale-95">
                {lang === "en" ? "Follow" : "Suivre"}
              </button>
            </form>
            <p className="mt-1 text-[10px] text-gray-400">
              {lang === "en"
                ? "Max 4 messages/month. Unsubscribe in one click."
                : "4 messages par mois maximum. Désabonnement en un clic."}
            </p>
          </details>
        )}
      </section>

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
                className="grain relative h-36 w-[104px] shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[#3B4784] to-indigoNight p-2.5 text-[10px] font-semibold text-white shadow-card transition-transform active:scale-95"
              >
                <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-[9px] backdrop-blur-sm">▶</span>
                <span className="absolute bottom-2 left-2.5 right-2.5 leading-tight [text-shadow:0_1px_6px_rgba(0,0,0,.5)]">
                  {v.product_name}
                </span>
                <span className="absolute bottom-10 left-2.5 text-[9px] tabular-nums opacity-70">
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
                className="grain relative h-36 w-[104px] shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[#3B4784] to-indigoNight p-2.5 text-[10px] font-semibold text-white shadow-card transition-transform active:scale-95"
              >
                <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-[9px] backdrop-blur-sm">▶</span>
                <span className="absolute bottom-2 left-2.5 right-2.5 leading-tight [text-shadow:0_1px_6px_rgba(0,0,0,.5)]">
                  {p.name}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* grille articles */}
      <h2 className="label-micro mx-4 mb-2.5 mt-6">{t(lang, "shop.products")}</h2>
      <div className="grid grid-cols-2 gap-2.5 px-3">
        {products.map((p, i) => (
          <Link
            key={p.id}
            href={`/${shop.slug}/p/${p.id}${attr}`}
            className="card overflow-hidden rounded-2xl transition-transform active:scale-[0.97]"
          >
            {photos.get(p.id) ? (
              // Photo déjà redimensionnée à 800 px en WebP à l'envoi : pas
              // d'optimiseur à interroger, une simple balise <img> suffit et
              // ne coûte aucun JavaScript (R2). width/height réservent la
              // place pour éviter que la grille ne saute en 3G.
              <img
                src={photos.get(p.id)}
                alt={p.name}
                width={400}
                height={400}
                loading="lazy"
                decoding="async"
                className="aspect-square w-full bg-sand object-cover"
              />
            ) : (
              <div
                className={`flex aspect-square items-center justify-center text-4xl ${
                  ["bg-gradient-to-br from-[#FBE3D2] to-[#F2B98F]",
                   "bg-gradient-to-br from-[#D9E6F6] to-[#A9C3E8]",
                   "bg-gradient-to-br from-[#EFE0F6] to-[#CBAAE2]",
                   "bg-gradient-to-br from-[#E0F0E4] to-[#A9D4B4]"][i % 4]
                }`}
              >
                🛍️
              </div>
            )}
            <p className="line-clamp-2 min-h-[2rem] px-3 pt-2.5 text-xs font-bold leading-tight">{p.name}</p>
            <p className="px-3 pb-2 pt-1 font-display text-[15px] tabular-nums tracking-tight text-indigo9">
              {fcfa(p.price_fcfa)}
            </p>
            {p.video_url && (
              <span className="mx-3 mb-2.5 inline-block rounded-full bg-indigo9/[0.07] px-2 py-0.5 text-[9px] font-extrabold text-indigo9">
                ▶ vidéo
              </span>
            )}
            {p.stock_state === "out" && (
              <span className="mx-3 mb-2.5 inline-block rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-extrabold text-red-600">
                {t(lang, "shop.outOfStock")}
              </span>
            )}
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
