// Données publiques du site : boutiques visibles par un moteur de recherche
// ou un aperçu de partage. Une boutique suspendue n'apparaît nulle part.
import type { Kysely } from "kysely";
import type { DB } from "./schema";
import { db as defaultDb } from "./db";

export type PublicShop = {
  slug: string;
  name: string;
  city: string;
  created_at: string;
};

/** Boutiques publiques actives : ni suspendues, ni vides. */
export async function listPublicShops(
  dbi: Kysely<DB> = defaultDb
): Promise<PublicShop[]> {
  const rows = await dbi
    .selectFrom("shops")
    .innerJoin("products", "products.shop_id", "shops.id")
    .select(["shops.slug", "shops.name", "shops.city", "shops.created_at"])
    .where("shops.suspended", "=", 0)
    .where("products.removed", "=", 0)
    .groupBy(["shops.id", "shops.slug", "shops.name", "shops.city", "shops.created_at"])
    .orderBy("shops.created_at", "desc")
    .execute();
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    city: r.city,
    created_at: r.created_at,
  }));
}

/** Phrase d'accroche de l'aperçu de partage (WhatsApp, TikTok). */
export function shareTagline(
  shop: { city: string },
  productCount: number,
  lang: "fr" | "en" = "fr"
): string {
  if (lang === "en") {
    return `${shop.city} · ${productCount} item${productCount > 1 ? "s" : ""} · Order on WhatsApp`;
  }
  return `${shop.city} · ${productCount} article${productCount > 1 ? "s" : ""} · Commande sur WhatsApp`;
}
