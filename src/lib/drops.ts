// Drops (G7) : ventes programmées, alerte WhatsApp à l'ouverture,
// stock chiffré décrémenté de façon atomique (voir createOrder).
import { z } from "zod";
import type { Kysely } from "kysely";
import type { DB } from "./schema";
import { db as defaultDb, newId } from "./db";
import { sendBulk } from "./notify";

export const dropInput = z.object({
  title: z.string().trim().min(3).max(80),
  opens_at: z.string().min(10).max(40),
  products: z.array(z.string()).default([]),
});

export async function createDrop(
  shopId: string,
  data: { title: string; opens_at: string; products: string[] },
  dbi: Kysely<DB> = defaultDb
): Promise<string> {
  const id = newId();
  await dbi
    .insertInto("drops")
    .values({
      id, shop_id: shopId, title: data.title,
      opens_at: new Date(data.opens_at).toISOString(), status: "scheduled",
    })
    .execute();
  for (const pid of data.products) {
    await dbi.insertInto("drop_products").values({ drop_id: id, product_id: pid }).execute();
  }
  return id;
}

/** Identifiants des articles réservés à un drop non encore ouvert. */
export async function lockedProductIds(
  shopId: string,
  dbi: Kysely<DB> = defaultDb
): Promise<Set<string>> {
  const rows = await dbi
    .selectFrom("drop_products")
    .innerJoin("drops", "drops.id", "drop_products.drop_id")
    .select("drop_products.product_id")
    .where("drops.shop_id", "=", shopId)
    .where("drops.status", "=", "scheduled")
    .where("drops.opens_at", ">", new Date().toISOString())
    .execute();
  return new Set(rows.map((r) => r.product_id));
}

/**
 * Ouvre les drops arrivés à échéance et prévient les inscrits.
 * Appelée paresseusement au rendu (pas de tâche planifiée en V1 du branchement).
 */
export async function openDueDrops(
  shopId: string,
  dbi: Kysely<DB> = defaultDb
): Promise<number> {
  const due = await dbi
    .selectFrom("drops")
    .innerJoin("shops", "shops.id", "drops.shop_id")
    .select(["drops.id", "drops.title", "shops.slug"])
    .where("drops.shop_id", "=", shopId)
    .where("drops.status", "=", "scheduled")
    .where("drops.opens_at", "<=", new Date().toISOString())
    .execute();

  for (const d of due) {
    const updated = await dbi
      .updateTable("drops")
      .set({ status: "open" })
      .where("id", "=", d.id)
      .where("status", "=", "scheduled") // garde : une seule ouverture
      .executeTakeFirst();
    if (Number(updated.numUpdatedRows) === 0) continue;

    const alerts = await dbi
      .selectFrom("drop_alerts").select("phone").where("drop_id", "=", d.id).execute();
    if (alerts.length > 0) {
      const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
      await sendBulk(
        alerts.map((a) => a.phone),
        "drop_open",
        `C'est ouvert : ${d.title} — premiers arrivés, premiers servis !`,
        `${base}/${d.slug}?src=drop`
      );
    }
  }
  return due.length;
}

export async function addAlert(
  dropId: string,
  phone: string,
  dbi: Kysely<DB> = defaultDb
): Promise<void> {
  try {
    await dbi
      .insertInto("drop_alerts")
      .values({ id: newId(), drop_id: dropId, phone })
      .execute();
  } catch {
    // déjà inscrite (contrainte UNIQUE) — sans effet
  }
}
