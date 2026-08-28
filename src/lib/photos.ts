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

/** Largeurs générées à l'envoi (src/lib/products.ts et scripts/seed.mjs). */
export const PHOTO_WIDTHS = [320, 560, 800] as const;

/** URL d'une variante : insère « -560 » avant l'extension. 800 = l'original. */
export function photoVariant(url: string, width: number): string {
  if (width >= 800) return url;
  return url.replace(/\.webp$/, `-${width}.webp`);
}

/**
 * srcset complet d'une photo. Fonctionne pour les URL relatives (disque) et
 * absolues (Vercel Blob) : les variantes sont des fichiers sœurs, nommés par
 * convention, écrits ensemble à l'envoi.
 */
export function photoSrcSet(url: string): string {
  return PHOTO_WIDTHS.map((w) => `${photoVariant(url, w)} ${w}w`).join(", ");
}
