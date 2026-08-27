// Suivi de boutique et annonces (G6).
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Kysely } from "kysely";
import type { DB } from "./schema";
import { db as defaultDb, newId } from "./db";
import { sendBulk } from "./notify";

export const MAX_ANNOUNCEMENTS_PER_MONTH = 4;

export const announcementInput = z.object({
  body: z.string().trim().min(10).max(500),
});

/** Jeton de désabonnement signé (aucun compte requis côté cliente). */
export function unsubToken(shopId: string, phone: string): string {
  const secret = process.env.SESSION_SECRET ?? "dev";
  return createHmac("sha256", secret).update(`${shopId}:${phone}`).digest("base64url").slice(0, 22);
}

export function checkUnsubToken(shopId: string, phone: string, token: string): boolean {
  const a = Buffer.from(unsubToken(shopId, phone));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function follow(
  shopId: string,
  phone: string,
  dbi: Kysely<DB> = defaultDb
): Promise<void> {
  const existing = await dbi
    .selectFrom("followers").select("id")
    .where("shop_id", "=", shopId).where("phone", "=", phone)
    .executeTakeFirst();
  if (existing) {
    await dbi.updateTable("followers").set({ opted_out_at: null })
      .where("id", "=", existing.id).execute();
    return;
  }
  await dbi.insertInto("followers")
    .values({ id: newId(), shop_id: shopId, phone, opted_out_at: null })
    .execute();
}

export async function unfollow(
  shopId: string,
  phone: string,
  dbi: Kysely<DB> = defaultDb
): Promise<void> {
  await dbi
    .updateTable("followers")
    .set({ opted_out_at: new Date().toISOString() })
    .where("shop_id", "=", shopId)
    .where("phone", "=", phone)
    .execute();
}

export async function activeFollowers(
  shopId: string,
  dbi: Kysely<DB> = defaultDb
): Promise<string[]> {
  const rows = await dbi
    .selectFrom("followers").select("phone")
    .where("shop_id", "=", shopId)
    .where("opted_out_at", "is", null)
    .execute();
  return rows.map((r) => r.phone);
}

export async function announcementsThisMonth(
  shopId: string,
  dbi: Kysely<DB> = defaultDb
): Promise<number> {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 19).replace("T", " ");
  const r = await dbi
    .selectFrom("announcements")
    .select(dbi.fn.countAll<number>().as("n"))
    .where("shop_id", "=", shopId)
    .where("sent_at", ">", since)
    .executeTakeFirst();
  return Number(r?.n ?? 0);
}

/** Diffuse une annonce aux abonnées. Quota strict : 4 / 30 jours. */
export async function sendAnnouncement(
  shopId: string,
  body: string,
  dbi: Kysely<DB> = defaultDb
): Promise<{ sent: number } | { error: string }> {
  if ((await announcementsThisMonth(shopId, dbi)) >= MAX_ANNOUNCEMENTS_PER_MONTH) {
    return { error: "quota_reached" };
  }
  const phones = await activeFollowers(shopId, dbi);
  if (phones.length === 0) return { error: "no_followers" };

  const shop = await dbi
    .selectFrom("shops").select(["slug"]).where("id", "=", shopId).executeTakeFirstOrThrow();
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const sent = await sendBulk(
    phones, "shop_announcement", body, `${base}/${shop.slug}?src=annonce`
  );

  await dbi
    .insertInto("announcements")
    .values({
      id: newId(), shop_id: shopId, body, sent_count: sent,
      open_est: Math.round(sent * 0.6), visits: 0, orders: 0,
    })
    .execute();
  return { sent };
}
