// Photos d'articles à afficher.
//
// Les photos étaient stockées (lib/storage.ts) mais lues nulle part : la
// vitrine montrait un dégradé à la place. Ce module fournit la lecture, en
// UNE requête pour toute une vitrine — pas une par article.
import type { Kysely } from "kysely";
import type { DB } from "./schema";
import { db as defaultDb } from "./db";

/**
 * Première photo de chaque article demandé (la plus petite `position`).
 * Les articles sans photo sont simplement absents de la map : l'appelant
 * retombe alors sur le dégradé.
 */
export async function photosByProduct(
  productIds: string[],
  dbi: Kysely<DB> = defaultDb
): Promise<Map<string, string>> {
  if (productIds.length === 0) return new Map();
  const rows = await dbi
    .selectFrom("product_media")
    .select(["product_id", "url_webp"])
    .where("product_id", "in", productIds)
    .orderBy("position", "asc")
    .execute();

  const parArticle = new Map<string, string>();
  for (const r of rows) {
    if (!parArticle.has(r.product_id)) parArticle.set(r.product_id, r.url_webp);
  }
  return parArticle;
}
