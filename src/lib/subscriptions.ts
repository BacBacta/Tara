import type { Kysely } from "kysely";
import type { DB } from "./schema";
import { db as defaultDb, newId } from "./db";
import { getPaymentProvider, type Operator } from "./payments";
import { PAID_PLAN_DAYS, PAID_PLAN_PRICE_FCFA, isPaidActive } from "./plan";

/** Initie le paiement d'un mois d'abonnement. */
export async function initiateSubscription(
  shopId: string,
  operator: Operator,
  phone: string,
  dbi: Kysely<DB> = defaultDb
): Promise<{ subscriptionId: string; providerRef: string }> {
  const shop = await dbi
    .selectFrom("shops")
    .select(["id", "plan", "plan_expires_at"])
    .where("id", "=", shopId)
    .executeTakeFirstOrThrow();

  // prolongation : la nouvelle période démarre à l'expiration si encore active
  const start = isPaidActive(shop)
    ? new Date(shop.plan_expires_at as string)
    : new Date();
  const end = new Date(start.getTime() + PAID_PLAN_DAYS * 86400_000);

  const subscriptionId = newId();
  await dbi
    .insertInto("subscriptions")
    .values({
      id: subscriptionId,
      shop_id: shopId,
      plan: "paid",
      amount: PAID_PLAN_PRICE_FCFA,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      payment_id: null,
    })
    .execute();

  const provider = getPaymentProvider();
  const paymentId = newId();
  const { providerRef } = await provider.initiate({
    paymentId,
    operator,
    phone,
    amount: PAID_PLAN_PRICE_FCFA,
  });
  // préfixe "sub" : distingue les webhooks d'abonnement de ceux des commandes
  const ref = `sub_${providerRef}`;
  await dbi
    .insertInto("sub_payments")
    .values({
      id: paymentId,
      subscription_id: subscriptionId,
      provider: provider.name,
      provider_ref: ref,
      operator,
      amount: PAID_PLAN_PRICE_FCFA,
      status: "pending",
      raw_webhook_json: null,
    })
    .execute();
  return { subscriptionId, providerRef: ref };
}

/** Webhook d'abonnement — idempotent (même garde SQL que les commandes). */
export async function processSubscriptionWebhook(
  input: { provider_ref: string; status: "success" | "failed" | "expired" },
  rawJson: string,
  dbi: Kysely<DB> = defaultDb
): Promise<{ applied: boolean }> {
  const updated = await dbi
    .updateTable("sub_payments")
    .set({ status: input.status, raw_webhook_json: rawJson })
    .where("provider_ref", "=", input.provider_ref)
    .where("status", "=", "pending")
    .executeTakeFirst();
  if (Number(updated.numUpdatedRows) === 0) return { applied: false };

  if (input.status === "success") {
    const pay = await dbi
      .selectFrom("sub_payments")
      .select(["id", "subscription_id"])
      .where("provider_ref", "=", input.provider_ref)
      .executeTakeFirstOrThrow();
    const sub = await dbi
      .selectFrom("subscriptions")
      .select(["id", "shop_id", "period_end"])
      .where("id", "=", pay.subscription_id)
      .executeTakeFirstOrThrow();
    await dbi
      .updateTable("subscriptions")
      .set({ payment_id: pay.id })
      .where("id", "=", sub.id)
      .execute();
    await dbi
      .updateTable("shops")
      .set({ plan: "paid", plan_expires_at: sub.period_end })
      .where("id", "=", sub.shop_id)
      .execute();
  }
  return { applied: true };
}

export async function latestPendingSubPayment(
  shopId: string,
  dbi: Kysely<DB> = defaultDb
) {
  return dbi
    .selectFrom("sub_payments")
    .innerJoin("subscriptions", "subscriptions.id", "sub_payments.subscription_id")
    .select([
      "sub_payments.provider_ref", "sub_payments.status",
      "sub_payments.created_at", "sub_payments.operator",
    ])
    .where("subscriptions.shop_id", "=", shopId)
    .orderBy("sub_payments.created_at", "desc")
    .executeTakeFirst();
}
