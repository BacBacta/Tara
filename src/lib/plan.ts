import type { Kysely } from "kysely";
import type { DB, ShopsTable } from "./schema";
import { db as defaultDb } from "./db";

export const FREE_PRODUCT_LIMIT = 10;
export const PAID_PLAN_PRICE_FCFA = 3000;
export const PAID_PLAN_DAYS = 30;

type ShopPlanInfo = Pick<ShopsTable, never> & {
  plan: string;
  plan_expires_at: string | null;
};

/** Plan payant réellement actif (rétrogradation douce à l'expiration). */
export function isPaidActive(shop: ShopPlanInfo): boolean {
  if (shop.plan !== "paid") return false;
  if (!shop.plan_expires_at) return false;
  return new Date(shop.plan_expires_at).getTime() > Date.now();
}

export async function countActiveProducts(
  shopId: string,
  dbi: Kysely<DB> = defaultDb
): Promise<number> {
  const r = await dbi
    .selectFrom("products")
    .select(dbi.fn.countAll<number>().as("n"))
    .where("shop_id", "=", shopId)
    .where("removed", "=", 0)
    .executeTakeFirst();
  return Number(r?.n ?? 0);
}

/** true si la boutique peut ajouter un article (limite du palier gratuit). */
export async function canAddProduct(
  shop: { id: string } & ShopPlanInfo,
  dbi: Kysely<DB> = defaultDb
): Promise<boolean> {
  if (isPaidActive(shop)) return true;
  return (await countActiveProducts(shop.id, dbi)) < FREE_PRODUCT_LIMIT;
}
