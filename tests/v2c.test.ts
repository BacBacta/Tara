// V2 — suivi de boutique et annonces (G6), drops et stock (G7).
import { beforeEach, describe, expect, it } from "vitest";
import { Kysely, SqliteDialect } from "kysely";
import SQLite from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DB } from "@/lib/schema";
import {
  activeFollowers, checkUnsubToken, follow, sendAnnouncement,
  unfollow, unsubToken, MAX_ANNOUNCEMENTS_PER_MONTH,
} from "@/lib/followers";
import { addAlert, createDrop, lockedProductIds, openDueDrops } from "@/lib/drops";
import { createOrder } from "@/lib/orders";

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
    momo_enabled: 1, plan: "free", plan_expires_at: null,
  }).execute();
  await db.insertInto("products").values({
    id: "p1", shop_id: "sh1", name: "Robe", price_fcfa: 8500, video_url: null,
  }).execute();
}

describe("suivi de boutique et annonces (G6)", () => {
  let db: Kysely<DB>;
  beforeEach(async () => { db = memoryDb(); await seed(db); });

  it("opt-in, désabonnement et réabonnement", async () => {
    await follow("sh1", "237699112233", db);
    expect(await activeFollowers("sh1", db)).toHaveLength(1);
    await unfollow("sh1", "237699112233", db);
    expect(await activeFollowers("sh1", db)).toHaveLength(0);
    await follow("sh1", "237699112233", db);
    expect(await activeFollowers("sh1", db)).toHaveLength(1);
    // pas de doublon en base
    expect(await db.selectFrom("followers").selectAll().execute()).toHaveLength(1);
  });

  it("jeton de désabonnement : valide pour ce couple, invalide sinon", () => {
    const t = unsubToken("sh1", "237699112233");
    expect(checkUnsubToken("sh1", "237699112233", t)).toBe(true);
    expect(checkUnsubToken("sh1", "237600000000", t)).toBe(false);
    expect(checkUnsubToken("sh2", "237699112233", t)).toBe(false);
    expect(checkUnsubToken("sh1", "237699112233", "faux")).toBe(false);
  });

  it("quota strict de 4 annonces par mois", async () => {
    await follow("sh1", "237699112233", db);
    for (let i = 0; i < MAX_ANNOUNCEMENTS_PER_MONTH; i++) {
      const r = await sendAnnouncement("sh1", `Annonce ${i} de test`, db);
      expect("sent" in r).toBe(true);
    }
    const over = await sendAnnouncement("sh1", "Annonce de trop", db);
    expect("error" in over && over.error).toBe("quota_reached");
    expect(await db.selectFrom("announcements").selectAll().execute())
      .toHaveLength(MAX_ANNOUNCEMENTS_PER_MONTH);
  });

  it("sans abonnée, aucune annonce n'est enregistrée", async () => {
    const r = await sendAnnouncement("sh1", "Personne à qui parler", db);
    expect("error" in r && r.error).toBe("no_followers");
    expect(await db.selectFrom("announcements").selectAll().execute()).toHaveLength(0);
  });
});

describe("drops (G7)", () => {
  let db: Kysely<DB>;
  beforeEach(async () => { db = memoryDb(); await seed(db); });

  it("les articles d'un drop programmé sont verrouillés, puis libérés à l'ouverture", async () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const id = await createDrop("sh1", { title: "Colis", opens_at: future, products: ["p1"] }, db);
    expect([...(await lockedProductIds("sh1", db))]).toEqual(["p1"]);

    await db.updateTable("drops").set({ opens_at: new Date(Date.now() - 1000).toISOString() })
      .where("id", "=", id).execute();
    await openDueDrops("sh1", db);
    expect([...(await lockedProductIds("sh1", db))]).toEqual([]);
    const drop = await db.selectFrom("drops").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
    expect(drop.status).toBe("open");
  });

  it("un drop ne s'ouvre qu'une fois (pas de double alerte)", async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const id = await createDrop("sh1", { title: "Colis", opens_at: past, products: ["p1"] }, db);
    await addAlert(id, "237699112233", db);
    await addAlert(id, "237699112233", db); // doublon ignoré
    expect(await db.selectFrom("drop_alerts").selectAll().execute()).toHaveLength(1);

    await openDueDrops("sh1", db);
    const second = await openDueDrops("sh1", db);
    expect(second).toBe(0); // plus rien à ouvrir
  });
});

describe("stock chiffré — pas de survente", () => {
  let db: Kysely<DB>;
  beforeEach(async () => { db = memoryDb(); await seed(db); });

  it("3 pièces, 10 commandes : exactement 3 acceptées", async () => {
    await db.updateTable("products").set({ stock_qty: 3 }).where("id", "=", "p1").execute();
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        createOrder("sh1", { productId: "p1", qty: 1 }, db)
      )
    );
    expect(results.filter(Boolean)).toHaveLength(3);
    const p = await db.selectFrom("products").selectAll().where("id", "=", "p1").executeTakeFirstOrThrow();
    expect(p.stock_qty).toBe(0);
    expect(p.stock_state).toBe("out");
    expect(await db.selectFrom("orders").selectAll().execute()).toHaveLength(3);
  });

  it("stock NULL = illimité", async () => {
    const r = await Promise.all(
      Array.from({ length: 5 }, () => createOrder("sh1", { productId: "p1", qty: 1 }, db))
    );
    expect(r.filter(Boolean)).toHaveLength(5);
  });

  it("une commande de 2 pièces sur un stock de 1 est refusée", async () => {
    await db.updateTable("products").set({ stock_qty: 1 }).where("id", "=", "p1").execute();
    expect(await createOrder("sh1", { productId: "p1", qty: 2 }, db)).toBeNull();
    const p = await db.selectFrom("products").selectAll().where("id", "=", "p1").executeTakeFirstOrThrow();
    expect(p.stock_qty).toBe(1); // stock intact
  });
});
