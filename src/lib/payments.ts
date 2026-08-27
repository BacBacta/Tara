import { z } from "zod";
import type { Kysely } from "kysely";
import type { DB } from "./schema";
import { db as defaultDb, newId } from "./db";
import { canTransition, type OrderStatus } from "./orders";

export const OPERATORS = ["mtn", "orange"] as const;
export type Operator = (typeof OPERATORS)[number];

export const phoneCm = z
  .string()
  .transform((s) => s.replace(/[^0-9]/g, ""))
  .refine((s) => /^(237)?6\d{8}$/.test(s), "numéro camerounais invalide")
  .transform((s) => (s.startsWith("237") ? s : `237${s}`));

export interface InitiateResult {
  providerRef: string;
}

/**
 * Interface d'agrégateur de paiement. La V1 n'embarque que le mock ;
 * l'implémentation réelle (Simiz/CamerPay…) respectera ce contrat.
 */
export interface PaymentProvider {
  readonly name: string;
  initiate(opts: {
    paymentId: string;
    operator: Operator;
    phone: string;
    amount: number;
  }): Promise<InitiateResult>;
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  async initiate(opts: { paymentId: string }): Promise<InitiateResult> {
    // Le vrai agrégateur renverrait sa référence ; le mock en fabrique une.
    return { providerRef: `mock_${opts.paymentId}` };
  }
}

export function getPaymentProvider(): PaymentProvider {
  // PAYMENT_PROVIDER=simiz|camerpay → à implémenter au branchement réel.
  return new MockPaymentProvider();
}

/** Crée le paiement (pending) et passe la commande en pending_payment. */
export async function initiatePayment(
  orderId: string,
  operator: Operator,
  phone: string,
  dbi: Kysely<DB> = defaultDb
): Promise<{ paymentId: string; providerRef: string } | { error: string }> {
  const order = await dbi
    .selectFrom("orders")
    .select(["id", "amount_fcfa", "status"])
    .where("id", "=", orderId)
    .executeTakeFirst();
  if (!order) return { error: "order_not_found" };
  if (!["initiated", "pending_payment"].includes(order.status)) {
    return { error: "order_not_payable" };
  }

  const provider = getPaymentProvider();
  const paymentId = newId();
  const { providerRef } = await provider.initiate({
    paymentId,
    operator,
    phone,
    amount: order.amount_fcfa,
  });

  await dbi
    .insertInto("payments")
    .values({
      id: paymentId,
      order_id: order.id,
      provider: provider.name,
      provider_ref: providerRef,
      operator,
      amount: order.amount_fcfa,
      status: "pending",
      raw_webhook_json: null,
    })
    .execute();

  await dbi
    .updateTable("orders")
    .set({ status: "pending_payment", buyer_phone: phone })
    .where("id", "=", order.id)
    .where("status", "=", "initiated")
    .execute();

  return { paymentId, providerRef };
}

export const webhookInput = z.object({
  provider_ref: z.string().min(4).max(120),
  status: z.enum(["success", "failed", "expired"]),
});
export type WebhookInput = z.infer<typeof webhookInput>;

/**
 * Traitement idempotent du webhook de paiement.
 * Reçu deux fois → un seul effet : la mise à jour ne s'applique que si le
 * paiement est encore "pending" (garde SQL), et la commande ne transite que
 * via la machine à états.
 */
export async function processPaymentWebhook(
  input: WebhookInput,
  rawJson: string,
  dbi: Kysely<DB> = defaultDb
): Promise<{ applied: boolean; orderStatus?: string }> {
  const updated = await dbi
    .updateTable("payments")
    .set({ status: input.status, raw_webhook_json: rawJson })
    .where("provider_ref", "=", input.provider_ref)
    .where("status", "=", "pending") // ← clé de l'idempotence
    .executeTakeFirst();

  if (Number(updated.numUpdatedRows) === 0) {
    return { applied: false }; // déjà traité ou référence inconnue → no-op
  }

  if (input.status === "success") {
    const payment = await dbi
      .selectFrom("payments")
      .select(["order_id"])
      .where("provider_ref", "=", input.provider_ref)
      .executeTakeFirst();
    if (payment) {
      const order = await dbi
        .selectFrom("orders")
        .select(["id", "status"])
        .where("id", "=", payment.order_id)
        .executeTakeFirst();
      if (order && canTransition(order.status as OrderStatus, "paid")) {
        await dbi
          .updateTable("orders")
          .set({ status: "paid" })
          .where("id", "=", order.id)
          .execute();
        return { applied: true, orderStatus: "paid" };
      }
    }
  }
  return { applied: true };
}

/** Statut courant d'un paiement pour la page d'attente. */
export async function getPaymentStatus(
  orderId: string,
  dbi: Kysely<DB> = defaultDb
) {
  return dbi
    .selectFrom("payments")
    .select(["id", "provider_ref", "status", "operator", "amount", "created_at"])
    .where("order_id", "=", orderId)
    .orderBy("created_at", "desc")
    .executeTakeFirst();
}
