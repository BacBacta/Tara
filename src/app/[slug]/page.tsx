import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { t, normalizeLang, type Lang } from "@/lib/i18n";
import { fcfa } from "@/lib/format";
import { parseSource, recordVisit, keepAttribution } from "@/lib/track";
import TikTokPixel from "@/components/TikTokPixel";
import { getShopIdentity } from "@/lib/identities";

// Vitrine publique — SSR, zéro JS client.

export const dynamic = "force-dynamic";

type SP = { v?: string; src?: string };
type Props = { params: { slug: string }; searchParams: SP };

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

  const sales = await db
    .selectFrom("orders")
    .select(db.fn.countAll<number>().as("n"))
    .where("shop_id", "=", shop.id)
    .where("status", "in", ["paid", "delivered"])
    .executeTakeFirst();

  return { shop, products, taggedVideos, identity, salesCount: Number(sales?.n ?? 0) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getShop(params.slug);
  if (!data) return {};
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  return {
    title: `${data.shop.name} — Bio-Shop`,
    description: `${data.shop.city} · ${data.products.length} articles · Commande WhatsApp, paiement Mobile Money.`,
    openGraph: {
      title: data.shop.name,
      description: `${data.shop.city} · Commande en 2 clics sur WhatsApp`,
      url: `${base}/${data.shop.slug}`,
      type: "website",
    },
  };
}

export default async function ShopPage({ params, searchParams }: Props) {
  const data = await getShop(params.slug);
  if (!data || data.shop.suspended === 1) notFound();
  const { shop, products, taggedVideos, identity, salesCount } = data;
  const lang: Lang = normalizeLang(shop.seller_lang);
  // V2 prioritaire : vidéos synchronisées + articles tagués ; sinon V1 (oEmbed manuel)
  const v2Videos = taggedVideos;
  const videos = v2Videos.length > 0 ? [] : products.filter((p) => p.video_url);
  const attr = keepAttribution(searchParams);

  await recordVisit({
    shopId: shop.id,
    source: parseSource(searchParams),
    userAgent: headers().get("user-agent"),
  });

  return (
    <main className="mx-auto max-w-md pb-8">
      <TikTokPixel />
      {/* bannière */}
      <div
        className="h-28"
        style={{
          background: `repeating-linear-gradient(135deg, ${shop.banner_color} 0 18px, #252F68 18px 26px, ${shop.banner_color} 26px 44px, #4A58A8 44px 52px)`,
        }}
      />
      {/* carte boutique */}
      <section className="relative mx-3 -mt-11 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="absolute -top-8 left-4 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-[#FFD9A8] to-[#D98A4A] text-2xl">
          🛍️
        </div>
        <h1 className="mt-6 text-lg font-extrabold">{shop.name}</h1>
        {identity && (
          <p className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-extrabold text-indigo9">
            ✓ Compte TikTok vérifié · @{identity.username}
          </p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          📍 {shop.city} · <b className="text-ink">{salesCount}</b> {t(lang, "shop.sales")}
        </p>
      </section>

      {/* vidéos taguées */}
      {v2Videos.length > 0 && (
        <>
          <h2 className="mx-4 mb-2 mt-5 text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
            {t(lang, "shop.seenInVideos")}
          </h2>
          <div className="flex gap-2 overflow-x-auto px-3">
            {v2Videos.map((v) => (
              <Link
                key={`${v.video_id}-${v.product_id}`}
                href={`/${shop.slug}/p/${v.product_id}${attr ? attr + "&" : "?"}v=${v.video_id}`}
                className="relative h-32 w-24 shrink-0 rounded-xl bg-gradient-to-br from-[#3B4784] to-[#222848] p-2 text-[10px] font-semibold text-white"
              >
                <span className="absolute right-2 top-2">▶</span>
                <span className="absolute bottom-2 left-2 right-2 leading-tight">
                  {v.product_name}
                </span>
                <span className="absolute bottom-9 left-2 text-[9px] opacity-70">
                  {v.views.toLocaleString("fr-FR")} vues
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
      {videos.length > 0 && (
        <>
          <h2 className="mx-4 mb-2 mt-5 text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
            {t(lang, "shop.seenInVideos")}
          </h2>
          <div className="flex gap-2 overflow-x-auto px-3">
            {videos.map((p) => (
              <Link
                key={p.id}
                href={`/${shop.slug}/p/${p.id}${attr}`}
                className="relative h-32 w-24 shrink-0 rounded-xl bg-gradient-to-br from-[#3B4784] to-[#222848] p-2 text-[10px] font-semibold text-white"
              >
                <span className="absolute right-2 top-2">▶</span>
                <span className="absolute bottom-2 left-2 right-2 leading-tight">
                  {p.name}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* grille articles */}
      <h2 className="mx-4 mb-2 mt-5 text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
        {t(lang, "shop.products")}
      </h2>
      <div className="grid grid-cols-2 gap-2.5 px-3">
        {products.map((p, i) => (
          <Link
            key={p.id}
            href={`/${shop.slug}/p/${p.id}${attr}`}
            className="overflow-hidden rounded-2xl border border-gray-200 bg-white"
          >
            <div
              className={`flex h-28 items-center justify-center text-4xl ${
                ["bg-gradient-to-br from-[#FBE3D2] to-[#F2B98F]",
                 "bg-gradient-to-br from-[#D9E6F6] to-[#A9C3E8]",
                 "bg-gradient-to-br from-[#EFE0F6] to-[#CBAAE2]",
                 "bg-gradient-to-br from-[#E0F0E4] to-[#A9D4B4]"][i % 4]
              }`}
            >
              🛍️
            </div>
            <p className="px-2.5 pt-2 text-xs font-bold leading-tight">{p.name}</p>
            <p className="px-2.5 pb-1 pt-0.5 text-sm font-extrabold text-indigo9">
              {fcfa(p.price_fcfa)}
            </p>
            {p.video_url && (
              <span className="mx-2.5 mb-2 inline-block rounded-full bg-purple-50 px-2 py-0.5 text-[9px] font-bold text-purple-700">
                ▶ vidéo
              </span>
            )}
            {p.stock_state === "out" && (
              <span className="mx-2.5 mb-2 inline-block rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-bold text-red-600">
                {t(lang, "shop.outOfStock")}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* pied de page viral */}
      <footer className="mt-8 text-center text-[11px] text-gray-500">
        {t(lang, "shop.createdWith")} <b className="text-indigo9">Bio·Shop</b>
        <div className="mt-2">
          <Link
            href="/creer"
            className="inline-block rounded-full border border-indigo9 px-4 py-1.5 text-[11px] font-extrabold text-indigo9"
          >
            ✨ {t(lang, "shop.createYours")} →
          </Link>
        </div>
      </footer>
    </main>
  );
}
