import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { t, normalizeLang, type Lang } from "@/lib/i18n";
import { fcfa } from "@/lib/format";
import { parseSource, recordVisit, keepAttribution } from "@/lib/track";
import { tiktokVideoId } from "@/lib/whatsapp";
import TikTokEmbed from "@/components/TikTokEmbed";

export const dynamic = "force-dynamic";

type SP = { v?: string; src?: string; variant?: string };
type Props = { params: { slug: string; id: string }; searchParams: SP };

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
      "shops.suspended", "sellers.lang as seller_lang", "sellers.phone as seller_phone",
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
  return { shop, product, variants };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getData(params.slug, params.id);
  if (!data) return {};
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  return {
    title: `${data.product.name} — ${data.shop.name}`,
    description: `${fcfa(data.product.price_fcfa)} · ${data.shop.name}`,
    openGraph: {
      title: data.product.name,
      description: `${fcfa(data.product.price_fcfa)} · ${data.shop.name} · Bio-Shop`,
      url: `${base}/${data.shop.slug}/p/${data.product.id}`,
      type: "website",
    },
  };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const data = await getData(params.slug, params.id);
  if (!data || data.shop.suspended === 1) notFound();
  const { shop, product, variants } = data;
  const lang: Lang = normalizeLang(shop.seller_lang);
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const attribution = keepAttribution(searchParams);

  // tracking de la visite produit
  await recordVisit({
    shopId: shop.id,
    productId: product.id,
    source: parseSource(searchParams),
    userAgent: headers().get("user-agent"),
  });

  // variantes groupées par label ; sélection portée par ?variant=
  const groups = new Map<string, string[]>();
  for (const v of variants) {
    groups.set(v.label, [...(groups.get(v.label) ?? []), v.value]);
  }
  const selected = typeof searchParams.variant === "string" ? searchParams.variant : null;

  const source = parseSource(searchParams);
  const videoId = product.video_url ? tiktokVideoId(product.video_url) : null;
  const out = product.stock_state === "out";

  const variantHref = (value: string) => {
    const p = new URLSearchParams();
    if (typeof searchParams.v === "string") p.set("v", searchParams.v);
    if (typeof searchParams.src === "string") p.set("src", searchParams.src);
    p.set("variant", value);
    return `/${shop.slug}/p/${product.id}?${p.toString()}`;
  };

  return (
    <main className="mx-auto max-w-md pb-10">
      {/* barre retour */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-sand px-4 py-3">
        <Link
          href={`/${shop.slug}${attribution}`}
          aria-label="Retour"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white"
        >
          ←
        </Link>
        <b className="truncate text-sm">{product.name}</b>
      </div>

      {/* visuel */}
      <div
        className={`flex h-56 items-center justify-center bg-gradient-to-br text-6xl ${GRADS[product.position % 4]}`}
      >
        🛍️
      </div>

      <section className="-mt-4 rounded-t-3xl border border-gray-200 bg-white px-4 pb-8 pt-5">
        <h1 className="text-lg font-extrabold leading-snug">{product.name}</h1>
        <p className="mt-1 text-xl font-extrabold text-indigo9">
          {fcfa(product.price_fcfa)}
        </p>
        {product.description && (
          <p className="mt-2 text-sm text-gray-600">{product.description}</p>
        )}
        {product.stock_state === "low" && (
          <p className="mt-2 inline-block rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
            {t(lang, "shop.lowStock")}
          </p>
        )}

        {/* variantes */}
        {[...groups.entries()].map(([label, values]) => (
          <div key={label} className="mt-4">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
              {label}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {values.map((value) => (
                <Link
                  key={value}
                  href={variantHref(value)}
                  replace
                  className={`rounded-xl border px-3.5 py-2 text-sm font-bold ${
                    selected === value
                      ? "border-indigo9 bg-indigo-50 text-indigo9"
                      : "border-gray-200 bg-white text-ink"
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
              caption={
                lang === "en"
                  ? "TikTok video embedded via the public oEmbed API."
                  : "Vidéo TikTok intégrée via l'API oEmbed publique."
              }
            />
          </div>
        )}

        {/* CTA */}
        <div className="mt-6 flex flex-col gap-2.5">
          {!out && (
            <form method="post" action={`/${shop.slug}/commander`}>
              <input type="hidden" name="product" value={product.id} />
              {selected && <input type="hidden" name="variant" value={selected} />}
              <input type="hidden" name="qty" value="1" />
              <input type="hidden" name="source" value={source} />
              <button
                type="submit"
                className="w-full rounded-2xl bg-wagreen px-5 py-4 text-center text-sm font-extrabold text-[#053B1D]"
              >
                💬 {t(lang, "shop.orderWhatsApp")}
              </button>
            </form>
          )}
          {!out && shop.momo_enabled === 1 && (
            <span className="rounded-2xl bg-mango/40 px-5 py-4 text-center text-sm font-extrabold text-[#3A2A00] opacity-70">
              💰 {t(lang, "shop.payMomo")} — Phase 3
            </span>
          )}
          {out && (
            <span className="rounded-2xl bg-gray-100 px-5 py-4 text-center text-sm font-extrabold text-gray-400">
              {t(lang, "shop.outOfStock")}
            </span>
          )}
        </div>
        <p className="mt-3 text-center text-[11px] text-gray-500">
          🔒 {t(lang, "shop.securePayment")}
        </p>
      </section>
    </main>
  );
}
