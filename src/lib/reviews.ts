// Avis vérifiés (G5) : seule une commande livrée ouvre un droit d'avis, une fois.
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Kysely } from "kysely";
import type { DB } from "./schema";
import { db as defaultDb, newId } from "./db";
import { getNotifyProvider } from "./notify";

export const reviewInput = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(400).optional().or(z.literal("").transform(() => undefined)),
});

/**
 * Crée le droit d'avis d'une commande livrée et envoie le lien à usage unique.
 * Idempotent : une commande n'ouvre qu'un seul avis (contrainte UNIQUE).
 */
export async function openReview(
  orderId: string,
  dbi: Kysely<DB> = defaultDb
): Promise<{ created: boolean; token?: string }> {
  const order = await dbi
    .selectFrom("orders")
    .select(["id", "shop_id", "product_id", "status", "buyer_phone"])
    .where("id", "=", orderId)
    .executeTakeFirst();
  if (!order || order.status !== "delivered") return { created: false };

  const existing = await dbi
    .selectFrom("reviews")
    .select("token")
    .where("order_id", "=", orderId)
    .executeTakeFirst();
  if (existing) return { created: false, token: existing.token };

  const token = randomBytes(16).toString("base64url");
  await dbi
    .insertInto("reviews")
    .values({
      id: newId(),
      order_id: order.id,
      shop_id: order.shop_id,
      product_id: order.product_id,
      token,
      rating: null,
      comment: null,
      status: "pending",
      reply: null,
      submitted_at: null,
    })
    .execute();

  if (order.buyer_phone) {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    await getNotifyProvider().send({
      phone: order.buyer_phone,
      template: "review_request",
      body: `Ta commande ${order.id} est livrée — donne ton avis en 10 secondes.`,
      link: `${base}/avis/${token}`,
    });
  }
  return { created: true, token };
}

/** Dépôt de l'avis. Refusé si le jeton est inconnu ou déjà utilisé. */
export async function submitReview(
  token: string,
  data: z.infer<typeof reviewInput>,
  dbi: Kysely<DB> = defaultDb
): Promise<boolean> {
  const r = await dbi
    .updateTable("reviews")
    .set({
      rating: data.rating,
      comment: data.comment ?? null,
      status: "published",
      submitted_at: new Date().toISOString(),
    })
    .where("token", "=", token)
    .where("status", "=", "pending") // ← usage unique
    .executeTakeFirst();
  return Number(r.numUpdatedRows) > 0;
}

export async function getReviewByToken(token: string, dbi: Kysely<DB> = defaultDb) {
  return dbi
    .selectFrom("reviews")
    .innerJoin("products", "products.id", "reviews.product_id")
    .innerJoin("shops", "shops.id", "reviews.shop_id")
    .select([
      "reviews.token", "reviews.status", "reviews.order_id",
      "products.name as product_name", "shops.name as shop_name", "shops.slug",
    ])
    .where("reviews.token", "=", token)
    .executeTakeFirst();
}
