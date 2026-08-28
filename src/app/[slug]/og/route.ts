// GET /{slug}/og — image d'aperçu de partage (PNG 1200×630).
// Sert la boutique par défaut, un article si ?p=<id> est fourni.
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { renderOgPng } from "@/lib/ogimage";
import { shareTagline } from "@/lib/public";
import { fcfa } from "@/lib/format";
import { normalizeLang } from "@/lib/i18n";

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const shop = await db
    .selectFrom("shops")
    .innerJoin("sellers", "sellers.id", "shops.seller_id")
    .select([
      "shops.id", "shops.name", "shops.city", "shops.banner_color",
      "shops.suspended", "sellers.lang",
    ])
    .where("shops.slug", "=", params.slug)
    .executeTakeFirst();
  if (!shop || shop.suspended === 1) {
    return new Response("not found", { status: 404 });
  }
  const lang = normalizeLang(shop.lang);

  const count = await db
    .selectFrom("products")
    .select(db.fn.countAll<number>().as("n"))
    .where("shop_id", "=", shop.id)
    .where("removed", "=", 0)
    .executeTakeFirst();

  let title = shop.name;
  let badge: string | null = null;
  const productId = req.nextUrl.searchParams.get("p");
  if (productId) {
    const product = await db
      .selectFrom("products")
      .select(["name", "price_fcfa"])
      .where("id", "=", productId)
      .where("shop_id", "=", shop.id)
      .where("removed", "=", 0)
      .executeTakeFirst();
    if (product) {
      title = product.name;
      badge = `${fcfa(product.price_fcfa)} · ${shop.name}`;
    }
  }

  const png = await renderOgPng({
    title,
    subtitle: shareTagline(shop, Number(count?.n ?? 0), lang),
    badge,
    color: shop.banner_color,
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      // l'aperçu change rarement ; on épargne le serveur et la 3G
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
