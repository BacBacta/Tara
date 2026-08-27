// Test critique de la phase 3 : le webhook reçu deux fois = un seul effet.
import { beforeEach, describe, expect, it } from "vitest";
import { Kysely, SqliteDialect } from "kysely";
import SQLite from "better-sqlite3";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DB } from "@/lib/schema";
import { initiatePayment, processPaymentWebhook } from "@/lib/payments";

function memoryDb(): Kysely<DB> {
  const database = new SQLite(":memory:");
  database.exec(
    readFileSync(join(process.cwd(), "migrations/001_init.sql"), "utf8")
  );
  return new Kysely<DB>({ dialect: new SqliteDialect({ database }) });
}

async function fixtures(db: Kysely<DB>) {
  await db.insertInto("sellers").values({
    id: "s1", phone: "237691882210", name: "Nadia", lang: "fr",
  }).execute();
  await db.insertInto("shops").values({
    id: "sh1", seller_id: "s1", slug: "nadia", name: "Nadia", city: "Douala",
    momo_enabled: 1, plan: "paid", plan_expires_at: null,
  }).execute();
  await db.insertInto("products").values({
    id: "p1", shop_id: "sh1", name: "Robe", price_fcfa: 8500,
    video_url: null,
  }).execute();
  await db.insertInto("orders").values({
    id: "B-1000", shop_id: "sh1", product_id: "p1", variant: null,
    amount_fcfa: 8500, buyer_phone: null, source: "direct",
  }).execute();
}

describe("paiement MoMo — idempotence du webhook", () => {
  let db: Kysely<DB>;
  beforeEach(async () => {
    db = memoryDb();
    await fixtures(db);
  });

  it("initiate crée un paiement pending et passe la commande en pending_payment", async () => {
    const r = await initiatePayment("B-1000", "mtn", "237677123456", db);
    expect("providerRef" in r).toBe(true);
    const order = await db.selectFrom("orders").selectAll()
      .where("id", "=", "B-1000").executeTakeFirstOrThrow();
    expect(order.status).toBe("pending_payment");
    expect(order.buyer_phone).toBe("237677123456");
  });

  it("webhook success reçu DEUX fois → un seul paiement success, commande paid", async () => {
    const r = await initiatePayment("B-1000", "mtn", "237677123456", db);
    if (!("providerRef" in r)) throw new Error("init failed");

    const first = await processPaymentWebhook(
      { provider_ref: r.providerRef, status: "success" }, "{}", db);
    const second = await processPaymentWebhook(
      { provider_ref: r.providerRef, status: "success" }, "{}", db);

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false); // ← doublon ignoré

    const payments = await db.selectFrom("payments").selectAll().execute();
    expect(payments).toHaveLength(1);
    expect(payments[0].status).toBe("success");

    const order = await db.selectFrom("orders").selectAll()
      .where("id", "=", "B-1000").executeTakeFirstOrThrow();
    expect(order.status).toBe("paid");
  });

  it("webhook failed ne paie pas la commande, et un success tardif est ignoré", async () => {
    const r = await initiatePayment("B-1000", "mtn", "237677123456", db);
    if (!("providerRef" in r)) throw new Error("init failed");

    await processPaymentWebhook(
      { provider_ref: r.providerRef, status: "failed" }, "{}", db);
    const late = await processPaymentWebhook(
      { provider_ref: r.providerRef, status: "success" }, "{}", db);

    expect(late.applied).toBe(false);
    const order = await db.selectFrom("orders").selectAll()
      .where("id", "=", "B-1000").executeTakeFirstOrThrow();
    expect(order.status).toBe("pending_payment"); // jamais paid
  });

  it("référence inconnue → no-op", async () => {
    const r = await processPaymentWebhook(
      { provider_ref: "mock_inconnu", status: "success" }, "{}", db);
    expect(r.applied).toBe(false);
  });

  it("commande déjà payée : nouvel initiate refusé", async () => {
    const r = await initiatePayment("B-1000", "mtn", "237677123456", db);
    if (!("providerRef" in r)) throw new Error("init failed");
    await processPaymentWebhook(
      { provider_ref: r.providerRef, status: "success" }, "{}", db);
    const again = await initiatePayment("B-1000", "orange", "237699000000", db);
    expect("error" in again && again.error).toBe("order_not_payable");
  });
});
