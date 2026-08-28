// Lot 4 — comportement réel sur PostgreSQL.
//
// Un test de concurrence qui ne tourne que sur SQLite ne prouve rien : SQLite
// sérialise les écritures avec un verrou global, PostgreSQL non. Ces tests
// exigent donc un vrai serveur.
//
//   TEST_DATABASE_URL="postgresql://postgres@localhost:5433/tara_test" npm test
//
// Sans cette variable, ils sont ignorés (et le disent), au lieu de donner une
// fausse assurance.
import { beforeEach, describe, expect, it, afterAll } from "vitest";
import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DB } from "@/lib/schema";
import { createOrder } from "@/lib/orders";
import { initiatePayment, processPaymentWebhook } from "@/lib/payments";
import { grantSubscription } from "@/lib/subscriptions";
import { toDialect } from "../scripts/sql-portable.mjs";

const PG_URL = process.env.TEST_DATABASE_URL;

if (!PG_URL) {
  console.warn(
    "\n⚠️  tests PostgreSQL ignorés : TEST_DATABASE_URL n'est pas défini.\n" +
      '   Pour les exécuter : TEST_DATABASE_URL="postgresql://postgres@localhost:5433/tara_test" npm test\n'
  );
}

let db: Kysely<DB>;
let pool: pg.Pool | undefined;

function connect(): Kysely<DB> {
  pool = new pg.Pool({ connectionString: PG_URL, max: 16 });
  return new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
}

/** Applique le schéma traduit, puis vide les tables entre deux tests. */
async function resetSchema() {
  const dir = join(process.cwd(), "migrations");
  const client = new pg.Client({ connectionString: PG_URL });
  await client.connect();
  try {
    await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await client.query(`CREATE TABLE schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
    )`);
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      await client.query(toDialect(readFileSync(join(dir, f), "utf8"), "postgres"));
      // On renseigne le suivi comme le ferait scripts/migrate.mjs : sans lui,
      // un « npm run db:migrate » lancé après les tests tenterait de tout
      // rejouer et échouerait sur un ALTER TABLE déjà appliqué.
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [f]);
    }
  } finally {
    await client.end();
  }
}

async function seed(dbi: Kysely<DB>, stock: number | null) {
  await dbi.insertInto("sellers").values({
    id: "s1", phone: "237691882210", name: "Nadia", lang: "fr",
  }).execute();
  await dbi.insertInto("shops").values({
    id: "sh1", seller_id: "s1", slug: "nadia", name: "Nadia", city: "Douala",
    momo_enabled: 1, plan: "free", plan_expires_at: null,
  }).execute();
  await dbi.insertInto("products").values({
    id: "p1", shop_id: "sh1", name: "Sac cuir", price_fcfa: 6000,
    video_url: null, stock_qty: stock,
  }).execute();
}

describe.skipIf(!PG_URL)("PostgreSQL — invariants R3 et R4 (lot 4)", () => {
  beforeEach(async () => {
    await resetSchema();
    db = connect();
  });

  afterAll(async () => {
    await db?.destroy().catch(() => {});
  });

  it("R4 — 10 commandes SIMULTANÉES sur un stock de 3 : exactement 3 passent", async () => {
    await seed(db, 3);

    // Vraie concurrence : 10 connexions distinctes du pool, en parallèle.
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        createOrder("sh1", { productId: "p1", qty: 1 }, db)
      )
    );

    const ok = results.filter((r) => r !== null);
    const refused = results.filter((r) => r === null);
    expect(ok).toHaveLength(3);
    expect(refused).toHaveLength(7);

    const product = await db.selectFrom("products").selectAll()
      .where("id", "=", "p1").executeTakeFirstOrThrow();
    expect(product.stock_qty).toBe(0);
    expect(product.stock_state).toBe("out");

    // 3 commandes distinctes en base, pas une de plus
    const orders = await db.selectFrom("orders").selectAll().execute();
    expect(orders).toHaveLength(3);
  });

  it("R4 — un stock NULL reste illimité, même en concurrence", async () => {
    await seed(db, null);
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        createOrder("sh1", { productId: "p1", qty: 1 }, db)
      )
    );
    expect(results.filter((r) => r !== null)).toHaveLength(10);
  });

  it("R3 — le webhook de paiement rejoué 3 fois n'a qu'un seul effet", async () => {
    await seed(db, null);
    const order = await createOrder("sh1", { productId: "p1", qty: 1 }, db);
    const init = await initiatePayment(order!.id, "mtn", "237677123456", db);
    expect("providerRef" in init).toBe(true);
    const ref = (init as { providerRef: string }).providerRef;

    const first = await processPaymentWebhook({ provider_ref: ref, status: "success" }, "{}", db);
    const second = await processPaymentWebhook({ provider_ref: ref, status: "success" }, "{}", db);
    const third = await processPaymentWebhook({ provider_ref: ref, status: "success" }, "{}", db);

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(third.applied).toBe(false);

    const row = await db.selectFrom("orders").select(["status"])
      .where("id", "=", order!.id).executeTakeFirstOrThrow();
    expect(row.status).toBe("paid");
  });

  it("R3 — le webhook rejoué EN PARALLÈLE n'a toujours qu'un seul effet", async () => {
    await seed(db, null);
    const order = await createOrder("sh1", { productId: "p1", qty: 1 }, db);
    const init = await initiatePayment(order!.id, "mtn", "237677123456", db);
    const ref = (init as { providerRef: string }).providerRef;

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        processPaymentWebhook({ provider_ref: ref, status: "success" }, "{}", db)
      )
    );
    expect(results.filter((r) => r.applied)).toHaveLength(1);
  });

  it("R3 — dedup_key UNIQUE : la violation ne casse pas la connexion suivante", async () => {
    await seed(db, null);
    const values = {
      provider: "tiktok", type: "video.new", dedup_key: "tiktok:evt-1",
      payload: "{}", processed_at: null,
    };
    await db.insertInto("webhook_events").values({ id: "w1", ...values }).execute();

    // Sur PostgreSQL, une violation d'unicité DANS une transaction avorte
    // toute la transaction. Hors transaction — le cas du code de Tara —
    // seule l'instruction échoue, et la connexion reste utilisable.
    await expect(
      db.insertInto("webhook_events").values({ id: "w2", ...values }).execute()
    ).rejects.toThrow();

    // preuve que la connexion vit toujours après l'échec
    const rows = await db.selectFrom("webhook_events").selectAll().execute();
    expect(rows).toHaveLength(1);
  });

  it("lot 2 — deux activations simultanées, même référence : une seule crédite", async () => {
    await seed(db, null);

    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        grantSubscription({
          shopId: "sh1", months: 1, origin: "manual",
          paymentRef: "MP-COURSE-1", actor: "mike@tara.shop",
        }, db)
      )
    );

    expect(results.filter((r) => r.applied)).toHaveLength(1);
    expect(results.filter((r) => !r.applied)).toHaveLength(3);

    const subs = await db.selectFrom("subscriptions").selectAll().execute();
    expect(subs).toHaveLength(1);
  });

  it("le format des dates est celui attendu par le code métier", async () => {
    await seed(db, null);
    const seller = await db.selectFrom("sellers").selectAll()
      .where("id", "=", "s1").executeTakeFirstOrThrow();
    // « 2026-08-27 23:15:44 » — identique à datetime('now') de SQLite,
    // sinon les comparaisons de dates en chaîne du code métier casseraient.
    expect(seller.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("les agrégats renvoient des nombres exploitables", async () => {
    await seed(db, null);
    await createOrder("sh1", { productId: "p1", qty: 2 }, db);
    // PostgreSQL renvoie count() en int8 et sum() en numeric, que le pilote
    // sérialise en chaîne : le code métier enveloppe tout dans Number().
    const r = await db.selectFrom("orders")
      .select((eb) => [eb.fn.countAll<number>().as("n"), eb.fn.sum<number>("amount_fcfa").as("s")])
      .executeTakeFirstOrThrow();
    expect(Number(r.n)).toBe(1);
    expect(Number(r.s)).toBe(12000);
  });
});
