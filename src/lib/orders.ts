import { z } from "zod";
import { db } from "./db";

export const ORDER_STATUSES = [
  "initiated",
  "pending_payment",
  "paid",
  "to_deliver",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Transitions autorisées de la machine à états des commandes. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  initiated: ["pending_payment", "paid", "to_deliver", "cancelled"],
  pending_payment: ["paid", "cancelled"],
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
  input: CreateOrderInput
): Promise<{ id: string; amountFcfa: number; productName: string } | null> {
  const product = await db
    .selectFrom("products")
    .select(["id", "name", "price_fcfa", "stock_state"])
    .where("id", "=", input.productId)
    .where("shop_id", "=", shopId)
    .where("removed", "=", 0)
    .executeTakeFirst();
  if (!product || product.stock_state === "out") return null;

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
