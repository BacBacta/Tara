import { z } from "zod";
import type { Kysely } from "kysely";
import type { DB } from "./schema";
import { db as defaultDb } from "./db";

export const ORDER_STATUSES = [
  "initiated",
  "pending_payment",
  "payment_announced",
  "paid",
  "to_deliver",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Transitions autorisées de la machine à états des commandes. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  initiated: ["pending_payment", "payment_announced", "paid", "to_deliver", "cancelled"],
  pending_payment: ["paid", "cancelled"],
  // Mode direct : l'acheteuse annonce son envoi, la vendeuse seule confirme.
  payment_announced: ["paid", "cancelled"],
  paid: ["to_deliver", "delivered", "cancelled"],
  to_deliver: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Numéro court B-XXXX (chiffres). Collision → nouvel essai. */
export function genOrderId(rand: () => number = Math.random): string {
  const n = Math.floor(1000 + rand() * 9000);
  return `B-${n}`;
}

export const createOrderInput = z.object({
  productId: z.string().min(6).max(64),
  variant: z.string().max(60).optional(),
  qty: z.coerce.number().int().min(1).max(20).default(1),
  source: z.string().max(60).optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderInput>;

export async function createOrder(
  shopId: string,
  input: CreateOrderInput,
  db: Kysely<DB> = defaultDb
): Promise<{ id: string; amountFcfa: number; productName: string } | null> {
  const product = await db
    .selectFrom("products")
    .select(["id", "name", "price_fcfa", "stock_state", "stock_qty"])
    .where("id", "=", input.productId)
    .where("shop_id", "=", shopId)
    .where("removed", "=", 0)
    .executeTakeFirst();
  if (!product || product.stock_state === "out") return null;

  // Stock chiffré (drops) : décrément ATOMIQUE — la garde SQL empêche la
  // survente même sous requêtes concurrentes.
  if (product.stock_qty !== null) {
    const dec = await db
      .updateTable("products")
      .set((eb) => ({ stock_qty: eb("stock_qty", "-", input.qty) }))
      .where("id", "=", product.id)
      .where("stock_qty", ">=", input.qty)
      .executeTakeFirst();
    if (Number(dec.numUpdatedRows) === 0) return null; // épuisé
    // passage automatique en rupture quand le stock atteint zéro
    await db
      .updateTable("products")
      .set({ stock_state: "out" })
      .where("id", "=", product.id)
      .where("stock_qty", "<=", 0)
      .execute();
  }

  const amount = product.price_fcfa * input.qty;
  // 5 essais en cas de collision d'identifiant court
  for (let i = 0; i < 5; i++) {
    const id = genOrderId();
    try {
      await db
        .insertInto("orders")
        .values({
          id,
          shop_id: shopId,
          product_id: product.id,
          variant: input.variant ?? null,
          qty: input.qty,
          amount_fcfa: amount,
          buyer_phone: null,
          source: input.source ?? "direct",
          status: "initiated",
        })
        .execute();
      return { id, amountFcfa: amount, productName: product.name };
    } catch {
      // collision d'id — nouvel essai
    }
  }
  return null;
}
