import type { Kysely } from "kysely";
import type { DB } from "./schema";
import { db as defaultDb, newId } from "./db";
import { getPaymentProvider, type Operator } from "./payments";
import { PAID_PLAN_DAYS, PAID_PLAN_PRICE_FCFA, isPaidActive } from "./plan";
import { writeAudit } from "./audit";

/** Provenance d'une période d'abonnement. */
export const SUB_ORIGINS = ["aggregator", "manual", "offered"] as const;
export type SubOrigin = (typeof SUB_ORIGINS)[number];

/** Une période « offerte » n'est pas du revenu. */
export function isRevenue(origin: string): boolean {
  return origin === "aggregator" || origin === "manual";
}

/**
 * Période suivante : une prolongation démarre à l'expiration en cours,
 * pas à aujourd'hui — sinon la vendeuse perdrait les jours déjà payés.
 * Chemin unique, partagé par l'agrégateur et l'activation manuelle.
 */
export function nextPeriod(
  shop: { plan: string; plan_expires_at: string | null },
  months = 1
): { start: Date; end: Date } {
  const start = isPaidActive(shop)
    ? new Date(shop.plan_expires_at as string)
    : new Date();
  const end = new Date(start.getTime() + months * PAID_PLAN_DAYS * 86400_000);
  return { start, end };
}

/** Applique une période à la boutique. Seul endroit qui touche shops.plan. */
async function applyPeriodToShop(
  shopId: string,
  periodEnd: string,
  dbi: Kysely<DB>
): Promise<void> {
  await dbi
    .updateTable("shops")
    .set({ plan: "paid", plan_expires_at: periodEnd })
    .where("id", "=", shopId)
    .execute();
}

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

  const { start, end } = nextPeriod(shop);

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
    await applyPeriodToShop(sub.shop_id, sub.period_end, dbi);
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

/**
 * Lot 2 — activation manuelle depuis le back-office.
 *
 * MIKE reçoit les 3 000 F sur son MoMo personnel et active ici, en saisissant
 * la référence de la transaction. Réutilise exactement le même calcul de
 * période et la même écriture sur shops que le chemin agrégateur.
 *
 * Idempotence : une même référence de paiement ne crédite jamais deux fois
 * la même boutique (index unique partiel sur shop_id + payment_ref).
 * Une période « offerte » ne compte pas comme revenu et vaut 0 F.
 */
export async function grantSubscription(
  opts: {
    shopId: string;
    months: number;
    origin: Exclude<SubOrigin, "aggregator">;
    paymentRef?: string | null;
    note?: string | null;
    actor: string;
  },
  dbi: Kysely<DB> = defaultDb
): Promise<
  | { applied: true; expiresAt: string; amount: number }
  | { applied: false; reason: "duplicate" | "shop_not_found" | "missing_ref" }
> {
  const { shopId, months, origin, actor } = opts;
  const paymentRef = opts.paymentRef?.trim() || null;

  // Un encaissement manuel sans référence serait intraçable.
  if (origin === "manual" && !paymentRef) {
    return { applied: false, reason: "missing_ref" };
  }

  const shop = await dbi
    .selectFrom("shops")
    .select(["id", "plan", "plan_expires_at"])
    .where("id", "=", shopId)
    .executeTakeFirst();
  if (!shop) return { applied: false, reason: "shop_not_found" };

  if (paymentRef) {
    const seen = await dbi
      .selectFrom("subscriptions")
      .select("id")
      .where("shop_id", "=", shopId)
      .where("payment_ref", "=", paymentRef)
      .executeTakeFirst();
    if (seen) return { applied: false, reason: "duplicate" };
  }

  const { start, end } = nextPeriod(shop, months);
  const amount = origin === "offered" ? 0 : PAID_PLAN_PRICE_FCFA * months;
  const periodEnd = end.toISOString();

  try {
    await dbi
      .insertInto("subscriptions")
      .values({
        id: newId(),
        shop_id: shopId,
        plan: "paid",
        amount,
        period_start: start.toISOString(),
        period_end: periodEnd,
        payment_id: null,
        origin,
        payment_ref: paymentRef,
        note: opts.note?.trim() || null,
        activated_by: actor,
      })
      .execute();
  } catch (e) {
    // Course : deux activations simultanées avec la même référence passent
    // toutes deux le SELECT ci-dessus, et l'index unique arrête la seconde.
    // C'est la base qui garde, pas le code — on se contente de traduire.
    // (Hors transaction explicite : sur PostgreSQL, une violation à
    // l'intérieur d'une transaction l'avorterait et ce SELECT échouerait.)
    if (paymentRef) {
      const seen = await dbi
        .selectFrom("subscriptions")
        .select("id")
        .where("shop_id", "=", shopId)
        .where("payment_ref", "=", paymentRef)
        .executeTakeFirst();
      if (seen) return { applied: false, reason: "duplicate" };
    }
    throw e;
  }

  await applyPeriodToShop(shopId, periodEnd, dbi);

  // Traçabilité : qui, quand (at), quelle boutique, quelle référence.
  await writeAudit(
    actor,
    origin === "offered" ? "grant_offered" : "grant_paid",
    `${shopId} · ${months} mois · ${paymentRef ?? "sans référence"}`,
    dbi
  );

  return { applied: true, expiresAt: periodEnd, amount };
}

/** Dernière période connue de chaque boutique (pour l'écran admin). */
export async function latestSubscriptionByShop(
  dbi: Kysely<DB> = defaultDb
): Promise<Map<string, { origin: string; period_end: string; payment_ref: string | null }>> {
  const rows = await dbi
    .selectFrom("subscriptions")
    .select(["shop_id", "origin", "period_end", "payment_ref"])
    .orderBy("period_end", "desc")
    .execute();
  const map = new Map<string, { origin: string; period_end: string; payment_ref: string | null }>();
  for (const r of rows) {
    if (!map.has(r.shop_id)) {
      map.set(r.shop_id, {
        origin: r.origin,
        period_end: r.period_end,
        payment_ref: r.payment_ref,
      });
    }
  }
  return map;
}
