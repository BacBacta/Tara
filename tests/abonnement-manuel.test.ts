// Lot 2 — encaissement de l'abonnement à la main.
// L'abonnement est l'unique revenu de Tara : ces tests verrouillent la
// distinction payé / offert, l'idempotence, et la traçabilité.
import { beforeEach, describe, expect, it } from "vitest";
import { Kysely, SqliteDialect } from "kysely";
import SQLite from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DB } from "@/lib/schema";
import { canAddProduct, isPaidActive, FREE_PRODUCT_LIMIT } from "@/lib/plan";
import {
  grantSubscription,
  isRevenue,
  latestSubscriptionByShop,
  nextPeriod,
} from "@/lib/subscriptions";

function memoryDb(): Kysely<DB> {
  const database = new SQLite(":memory:");
  const dir = join(process.cwd(), "migrations");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    database.exec(readFileSync(join(dir, f), "utf8"));
  }
  return new Kysely<DB>({ dialect: new SqliteDialect({ database }) });
}

async function seed(db: Kysely<DB>) {
  await db.insertInto("sellers").values({
    id: "s1", phone: "237691882210", name: "Nadia", lang: "fr",
  }).execute();
  await db.insertInto("shops").values({
    id: "sh1", seller_id: "s1", slug: "nadia", name: "Nadia", city: "Douala",
    momo_enabled: 0, plan: "free", plan_expires_at: null,
  }).execute();
  // pile la limite du palier gratuit
  for (let i = 0; i < FREE_PRODUCT_LIMIT; i++) {
    await db.insertInto("products").values({
      id: `p${i}`, shop_id: "sh1", name: `Article ${i}`,
      price_fcfa: 1000, video_url: null,
    }).execute();
  }
}

const shopRow = (db: Kysely<DB>) =>
  db.selectFrom("shops").selectAll().where("id", "=", "sh1").executeTakeFirstOrThrow();

describe("abonnement encaissé à la main (lot 2)", () => {
  let db: Kysely<DB>;
  beforeEach(async () => {
    db = memoryDb();
    await seed(db);
  });

  it("l'activation manuelle fait sauter la limite de 10 articles", async () => {
    const before = await shopRow(db);
    expect(await canAddProduct(before, db)).toBe(false); // 10/10 en gratuit

    const res = await grantSubscription({
      shopId: "sh1", months: 1, origin: "manual",
      paymentRef: "MP240827.1432.A12345", note: "reçu MTN",
      actor: "admin@tara.shop",
    }, db);
    expect(res.applied).toBe(true);

    const after = await shopRow(db);
    expect(isPaidActive(after)).toBe(true);
    expect(await canAddProduct(after, db)).toBe(true);
  });

  it("à l'expiration, la limite revient", async () => {
    await grantSubscription({
      shopId: "sh1", months: 1, origin: "manual", paymentRef: "REF-1",
      actor: "admin@tara.shop",
    }, db);

    // on ramène l'expiration dans le passé
    await db.updateTable("shops")
      .set({ plan_expires_at: new Date(Date.now() - 86400_000).toISOString() })
      .where("id", "=", "sh1").execute();

    const expired = await shopRow(db);
    expect(isPaidActive(expired)).toBe(false);
    expect(await canAddProduct(expired, db)).toBe(false);
  });

  it("la même référence de paiement ne crédite jamais deux fois", async () => {
    const first = await grantSubscription({
      shopId: "sh1", months: 1, origin: "manual", paymentRef: "MP-DOUBLON",
      actor: "admin@tara.shop",
    }, db);
    expect(first.applied).toBe(true);
    const expiry = (await shopRow(db)).plan_expires_at;

    const second = await grantSubscription({
      shopId: "sh1", months: 1, origin: "manual", paymentRef: "MP-DOUBLON",
      actor: "admin@tara.shop",
    }, db);
    expect(second).toEqual({ applied: false, reason: "duplicate" });

    // ni la date d'expiration ni le nombre de périodes n'ont bougé
    expect((await shopRow(db)).plan_expires_at).toBe(expiry);
    const subs = await db.selectFrom("subscriptions").selectAll()
      .where("shop_id", "=", "sh1").execute();
    expect(subs).toHaveLength(1);
  });

  it("l'activation est journalisée : qui, quelle boutique, quelle référence", async () => {
    await grantSubscription({
      shopId: "sh1", months: 3, origin: "manual", paymentRef: "MP-AUDIT-7",
      actor: "mike@tara.shop",
    }, db);

    const log = await db.selectFrom("audit_log").selectAll().execute();
    expect(log).toHaveLength(1);
    expect(log[0].actor).toBe("mike@tara.shop");
    expect(log[0].action).toBe("grant_paid");
    expect(log[0].target).toContain("sh1");
    expect(log[0].target).toContain("MP-AUDIT-7");
    expect(log[0].target).toContain("3 mois");
    expect(log[0].at).toBeTruthy(); // quand
  });

  it("une période offerte est distinguée d'une période payée", async () => {
    const res = await grantSubscription({
      shopId: "sh1", months: 1, origin: "offered", note: "vendeuse pilote",
      actor: "mike@tara.shop",
    }, db);
    expect(res.applied).toBe(true);
    if (res.applied) expect(res.amount).toBe(0); // n'entre pas dans le revenu

    const sub = await db.selectFrom("subscriptions").selectAll()
      .where("shop_id", "=", "sh1").executeTakeFirstOrThrow();
    expect(sub.origin).toBe("offered");
    expect(isRevenue(sub.origin)).toBe(false);

    // mais elle débloque bien la boutique
    expect(isPaidActive(await shopRow(db))).toBe(true);

    const log = await db.selectFrom("audit_log").selectAll().executeTakeFirstOrThrow();
    expect(log.action).toBe("grant_offered");
  });

  it("un abonnement payé sans référence est refusé", async () => {
    const res = await grantSubscription({
      shopId: "sh1", months: 1, origin: "manual", paymentRef: "  ",
      actor: "mike@tara.shop",
    }, db);
    expect(res).toEqual({ applied: false, reason: "missing_ref" });
    expect(isPaidActive(await shopRow(db))).toBe(false);
    // rien de journalisé : l'action n'a pas eu lieu
    expect(await db.selectFrom("audit_log").selectAll().execute()).toHaveLength(0);
  });

  it("une boutique inconnue est refusée", async () => {
    const res = await grantSubscription({
      shopId: "inconnue", months: 1, origin: "offered", actor: "mike@tara.shop",
    }, db);
    expect(res).toEqual({ applied: false, reason: "shop_not_found" });
  });

  it("une prolongation part de l'expiration, pas d'aujourd'hui", async () => {
    await grantSubscription({
      shopId: "sh1", months: 1, origin: "manual", paymentRef: "REF-A",
      actor: "mike@tara.shop",
    }, db);
    const first = (await shopRow(db)).plan_expires_at as string;

    await grantSubscription({
      shopId: "sh1", months: 1, origin: "manual", paymentRef: "REF-B",
      actor: "mike@tara.shop",
    }, db);
    const second = (await shopRow(db)).plan_expires_at as string;

    const gap = new Date(second).getTime() - new Date(first).getTime();
    expect(Math.round(gap / 86400_000)).toBe(30); // 30 jours de plus, rien de perdu
  });

  it("nextPeriod : mois multiples et boutique gratuite", () => {
    const free = { plan: "free", plan_expires_at: null };
    const { start, end } = nextPeriod(free, 3);
    expect(Math.round((end.getTime() - start.getTime()) / 86400_000)).toBe(90);
  });

  it("l'écran admin voit la dernière période de chaque boutique", async () => {
    await grantSubscription({
      shopId: "sh1", months: 1, origin: "offered", actor: "mike@tara.shop",
    }, db);
    await grantSubscription({
      shopId: "sh1", months: 1, origin: "manual", paymentRef: "REF-Z",
      actor: "mike@tara.shop",
    }, db);

    const map = await latestSubscriptionByShop(db);
    const sub = map.get("sh1");
    expect(sub?.origin).toBe("manual"); // la plus récente
    expect(sub?.payment_ref).toBe("REF-Z");
  });
});
