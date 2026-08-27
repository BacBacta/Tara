// Tests d'intégration des flux critiques, sur base SQLite en mémoire :
// commande → paiement → livraison, et abonnement → déblocage du plan.
import { beforeEach, describe, expect, it } from "vitest";
import { Kysely, SqliteDialect } from "kysely";
import SQLite from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DB } from "@/lib/schema";
import { initiatePayment, processPaymentWebhook } from "@/lib/payments";
import { initiateSubscription, processSubscriptionWebhook } from "@/lib/subscriptions";
import { canAddProduct, countActiveProducts, isPaidActive, FREE_PRODUCT_LIMIT } from "@/lib/plan";
import { canTransition } from "@/lib/orders";

function memoryDb(): Kysely<DB> {
  const database = new SQLite(":memory:");
  const dir = join(process.cwd(), "migrations");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    database.exec(readFileSync(join(dir, f), "utf8"));
  }
  return new Kysely<DB>({ dialect: new SqliteDialect({ database }) });
}

async function seed(db: Kysely<DB>, plan = "free") {
  await db.insertInto("sellers").values({
    id: "s1", phone: "237691882210", name: "Nadia", lang: "fr",
  }).execute();
  await db.insertInto("shops").values({
    id: "sh1", seller_id: "s1", slug: "nadia", name: "Nadia", city: "Douala",
    momo_enabled: 1, plan, plan_expires_at: null,
  }).execute();
  await db.insertInto("products").values({
    id: "p1", shop_id: "sh1", name: "Robe", price_fcfa: 8500, video_url: null,
  }).execute();
}

describe("flux critique — commande jusqu'à la livraison", () => {
  let db: Kysely<DB>;
  beforeEach(async () => { db = memoryDb(); await seed(db); });

  it("commande → paiement → payée → à livrer → livrée", async () => {
    await db.insertInto("orders").values({
      id: "B-1000", shop_id: "sh1", product_id: "p1", variant: "M",
      amount_fcfa: 8500, buyer_phone: null, source: "v:721", 
    }).execute();

    const init = await initiatePayment("B-1000", "mtn", "237677123456", db);
    if (!("providerRef" in init)) throw new Error("init");
    await processPaymentWebhook({ provider_ref: init.providerRef, status: "success" }, "{}", db);

    let order = await db.selectFrom("orders").selectAll()
      .where("id", "=", "B-1000").executeTakeFirstOrThrow();
    expect(order.status).toBe("paid");
    expect(order.source).toBe("v:721"); // l'attribution vidéo survit au paiement

    expect(canTransition("paid", "to_deliver")).toBe(true);
    await db.updateTable("orders").set({ status: "to_deliver" }).where("id", "=", "B-1000").execute();
    await db.updateTable("orders").set({ status: "delivered" }).where("id", "=", "B-1000").execute();

    order = await db.selectFrom("orders").selectAll()
      .where("id", "=", "B-1000").executeTakeFirstOrThrow();
    expect(order.status).toBe("delivered");
    expect(canTransition("delivered", "cancelled")).toBe(false);
  });
});

describe("flux critique — abonnement et limite du plan gratuit", () => {
  let db: Kysely<DB>;
  beforeEach(async () => { db = memoryDb(); await seed(db); });

  it("bloque le 11e article en gratuit, débloque après paiement de l'abonnement", async () => {
    for (let i = 2; i <= FREE_PRODUCT_LIMIT; i++) {
      await db.insertInto("products").values({
        id: `p${i}`, shop_id: "sh1", name: `Article ${i}`, price_fcfa: 1000, video_url: null,
      }).execute();
    }
    expect(await countActiveProducts("sh1", db)).toBe(FREE_PRODUCT_LIMIT);

    let shop = await db.selectFrom("shops").selectAll()
      .where("id", "=", "sh1").executeTakeFirstOrThrow();
    expect(await canAddProduct(shop, db)).toBe(false);

    const sub = await initiateSubscription("sh1", "mtn", "237691882210", db);
    await processSubscriptionWebhook({ provider_ref: sub.providerRef, status: "success" }, "{}", db);

    shop = await db.selectFrom("shops").selectAll()
      .where("id", "=", "sh1").executeTakeFirstOrThrow();
    expect(isPaidActive(shop)).toBe(true);
    expect(await canAddProduct(shop, db)).toBe(true);
  });

  it("webhook d'abonnement rejoué → un seul mois crédité", async () => {
    const sub = await initiateSubscription("sh1", "mtn", "237691882210", db);
    const a = await processSubscriptionWebhook({ provider_ref: sub.providerRef, status: "success" }, "{}", db);
    const b = await processSubscriptionWebhook({ provider_ref: sub.providerRef, status: "success" }, "{}", db);
    expect(a.applied).toBe(true);
    expect(b.applied).toBe(false);
    const subs = await db.selectFrom("subscriptions").selectAll().execute();
    expect(subs).toHaveLength(1);
  });

  it("un article retiré libère une place du quota gratuit", async () => {
    for (let i = 2; i <= FREE_PRODUCT_LIMIT; i++) {
      await db.insertInto("products").values({
        id: `p${i}`, shop_id: "sh1", name: `A${i}`, price_fcfa: 1000, video_url: null,
      }).execute();
    }
    await db.updateTable("products").set({ removed: 1 }).where("id", "=", "p2").execute();
    const shop = await db.selectFrom("shops").selectAll()
      .where("id", "=", "sh1").executeTakeFirstOrThrow();
    expect(await canAddProduct(shop, db)).toBe(true);
  });
});
