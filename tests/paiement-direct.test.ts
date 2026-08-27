// Lot 1 — paiement direct vendeuse.
// R1 : Tara n'encaisse jamais. L'acheteuse annonce son envoi, la VENDEUSE
// seule confirme. Ces tests verrouillent ce partage des rôles.
import { beforeEach, describe, expect, it } from "vitest";
import { Kysely, SqliteDialect } from "kysely";
import SQLite from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DB } from "@/lib/schema";
import { canTransition, createOrder, type OrderStatus } from "@/lib/orders";
import {
  announceDirectPayment,
  canAcceptPayment,
  normalizePaymentMode,
} from "@/lib/payments";
import { directPaymentMessage } from "@/lib/whatsapp";

function memoryDb(): Kysely<DB> {
  const database = new SQLite(":memory:");
  const dir = join(process.cwd(), "migrations");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    database.exec(readFileSync(join(dir, f), "utf8"));
  }
  return new Kysely<DB>({ dialect: new SqliteDialect({ database }) });
}

/** Trois boutiques : directe équipée, directe sans numéro, agrégateur. */
async function seed(db: Kysely<DB>) {
  await db.insertInto("sellers").values([
    { id: "s1", phone: "237691882210", name: "Nadia", lang: "fr" },
    { id: "s2", phone: "237677554433", name: "Kevin", lang: "en" },
  ]).execute();

  await db.insertInto("shops").values([
    {
      id: "sh1", seller_id: "s1", slug: "nadia", name: "Nadia", city: "Douala",
      momo_enabled: 0, plan: "paid", plan_expires_at: null,
      payment_mode: "direct", momo_number: "237691882210", momo_operator: "mtn",
    },
    {
      id: "sh2", seller_id: "s1", slug: "sans-numero", name: "Sans numéro",
      city: "Douala", momo_enabled: 0, plan: "free", plan_expires_at: null,
      payment_mode: "direct", momo_number: null, momo_operator: null,
    },
    {
      id: "sh3", seller_id: "s2", slug: "kev", name: "Kev", city: "Yaoundé",
      momo_enabled: 1, plan: "free", plan_expires_at: null,
      payment_mode: "agregateur", momo_number: null, momo_operator: null,
    },
  ]).execute();

  await db.insertInto("products").values([
    { id: "p1", shop_id: "sh1", name: "Sac cuir", price_fcfa: 6000, video_url: null },
    { id: "p2", shop_id: "sh2", name: "Foulard", price_fcfa: 2000, video_url: null },
    { id: "p3", shop_id: "sh3", name: "Air classic", price_fcfa: 22000, video_url: null },
  ]).execute();
}

/** Reproduit ce que fait la vendeuse depuis /app/commandes/update. */
async function sellerSets(db: Kysely<DB>, orderId: string, to: OrderStatus) {
  const order = await db.selectFrom("orders").select(["id", "status"])
    .where("id", "=", orderId).executeTakeFirstOrThrow();
  if (!canTransition(order.status as OrderStatus, to)) return false;
  await db.updateTable("orders").set({ status: to })
    .where("id", "=", orderId).execute();
  return true;
}

describe("paiement direct vendeuse (lot 1)", () => {
  let db: Kysely<DB>;
  beforeEach(async () => {
    db = memoryDb();
    await seed(db);
  });

  it("le mode direct est le défaut d'une boutique", async () => {
    const shop = await db.selectFrom("shops").selectAll()
      .where("id", "=", "sh1").executeTakeFirstOrThrow();
    expect(normalizePaymentMode(shop.payment_mode)).toBe("direct");
    // même une valeur absente retombe sur "direct" : jamais d'agrégateur par accident
    expect(normalizePaymentMode(null)).toBe("direct");
    expect(normalizePaymentMode("n'importe quoi")).toBe("direct");
  });

  it("parcours complet : commande → annonce → la vendeuse confirme", async () => {
    const order = await createOrder("sh1", { productId: "p1", qty: 1 }, db);
    expect(order).not.toBeNull();
    const id = order!.id;
    expect(order!.amountFcfa).toBe(6000);

    // L'acheteuse annonce son envoi.
    expect(await announceDirectPayment(id, "sh1", db)).toEqual({ ok: true });
    let row = await db.selectFrom("orders").select(["status"])
      .where("id", "=", id).executeTakeFirstOrThrow();
    expect(row.status).toBe("payment_announced");

    // L'annonce ne vaut PAS paiement : seule la vendeuse confirme.
    expect(await sellerSets(db, id, "paid")).toBe(true);
    row = await db.selectFrom("orders").select(["status"])
      .where("id", "=", id).executeTakeFirstOrThrow();
    expect(row.status).toBe("paid");
  });

  it("annoncer deux fois ne produit qu'un seul effet", async () => {
    const order = await createOrder("sh1", { productId: "p1", qty: 1 }, db);
    const id = order!.id;
    expect(await announceDirectPayment(id, "sh1", db)).toEqual({ ok: true });
    expect(await announceDirectPayment(id, "sh1", db)).toEqual({ ok: true });
    const row = await db.selectFrom("orders").select(["status"])
      .where("id", "=", id).executeTakeFirstOrThrow();
    expect(row.status).toBe("payment_announced");
  });

  it("refuse une transition illégale : une commande livrée ne se ré-annonce pas", async () => {
    const order = await createOrder("sh1", { productId: "p1", qty: 1 }, db);
    const id = order!.id;
    await announceDirectPayment(id, "sh1", db);
    await sellerSets(db, id, "paid");
    await sellerSets(db, id, "delivered");

    const res = await announceDirectPayment(id, "sh1", db);
    expect(res).toEqual({ ok: false, error: "invalid_transition" });
    const row = await db.selectFrom("orders").select(["status"])
      .where("id", "=", id).executeTakeFirstOrThrow();
    expect(row.status).toBe("delivered"); // inchangée
    expect(canTransition("delivered", "payment_announced")).toBe(false);
    expect(canTransition("payment_announced", "delivered")).toBe(false);
  });

  it("une commande d'une autre boutique n'est pas annonçable", async () => {
    const order = await createOrder("sh1", { productId: "p1", qty: 1 }, db);
    const res = await announceDirectPayment(order!.id, "sh3", db);
    expect(res).toEqual({ ok: false, error: "order_not_found" });
  });

  it("boutique en mode direct sans numéro MoMo : aucun bouton, pas de plantage", async () => {
    const shop = await db.selectFrom("shops").selectAll()
      .where("id", "=", "sh2").executeTakeFirstOrThrow();
    // Le bouton de paiement n'est pas proposé : pas d'impasse pour l'acheteuse.
    expect(canAcceptPayment(shop)).toBe(false);
    // La commande WhatsApp, elle, reste possible.
    const order = await createOrder("sh2", { productId: "p2", qty: 1 }, db);
    expect(order).not.toBeNull();
    expect(order!.amountFcfa).toBe(2000);
  });

  it("les deux modes coexistent sur la même base", async () => {
    const direct = await db.selectFrom("shops").selectAll()
      .where("id", "=", "sh1").executeTakeFirstOrThrow();
    const agregateur = await db.selectFrom("shops").selectAll()
      .where("id", "=", "sh3").executeTakeFirstOrThrow();

    expect(canAcceptPayment(direct)).toBe(true);
    expect(canAcceptPayment(agregateur)).toBe(true);

    // Le mode agrégateur ne passe pas par l'annonce acheteuse.
    const order = await createOrder("sh3", { productId: "p3", qty: 1 }, db);
    const res = await announceDirectPayment(order!.id, "sh3", db);
    expect(res.ok).toBe(true); // la lib ne juge pas le mode…
    // …c'est la route qui refuse : elle exige mode direct + numéro renseigné.
    expect(normalizePaymentMode(agregateur.payment_mode)).toBe("agregateur");
    expect(agregateur.momo_number).toBeNull();
  });

  it("une passerelle activée sans numéro reste payable, un direct sans numéro non", () => {
    expect(canAcceptPayment({ payment_mode: "agregateur", momo_enabled: 1, momo_number: null })).toBe(true);
    expect(canAcceptPayment({ payment_mode: "agregateur", momo_enabled: 0, momo_number: null })).toBe(false);
    expect(canAcceptPayment({ payment_mode: "direct", momo_enabled: 1, momo_number: null })).toBe(false);
    expect(canAcceptPayment({ payment_mode: "direct", momo_enabled: 0, momo_number: "237691882210" })).toBe(true);
  });

  it("le message WhatsApp d'annonce ne promet aucune garantie (R1)", () => {
    const msg = directPaymentMessage({
      productName: "Sac cuir", variant: null, qty: 1, priceLabel: "6 000 F",
      orderId: "B-1234", momoNumber: "237691882210",
      operatorLabel: "MTN MoMo", lang: "fr",
    });
    expect(msg).toContain("237691882210");
    expect(msg).toContain("6 000 F");
    expect(msg).toContain("B-1234");
    for (const interdit of [/garanti/i, /rembours/i, /sécurisé/i, /séquestre/i, /Tara/i]) {
      expect(msg).not.toMatch(interdit);
    }
  });
});
