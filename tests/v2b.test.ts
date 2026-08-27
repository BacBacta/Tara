// V2 — webhooks TikTok (G3) et avis vérifiés (G5).
import { beforeEach, describe, expect, it } from "vitest";
import { Kysely, SqliteDialect } from "kysely";
import SQLite from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DB } from "@/lib/schema";
import { MockTikTokProvider } from "@/lib/tiktok";
import { connectIdentity, getShopIdentity, syncIdentity } from "@/lib/identities";
import { processTikTokWebhook } from "@/lib/webhooks-tiktok";
import { openReview, submitReview } from "@/lib/reviews";

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
  const p = new MockTikTokProvider();
  const tokens = await p.exchangeCode("c1");
  const profile = await p.fetchProfile(tokens.accessToken);
  await connectIdentity("s1", tokens, profile, db);
  return profile.openId;
}

describe("webhooks TikTok (G3)", () => {
  let db: Kysely<DB>;
  let openId: string;
  beforeEach(async () => { db = memoryDb(); openId = await seed(db); });

  it("nouvelle vidéo : synchronise et notifie, une seule fois", async () => {
    const first = await processTikTokWebhook(
      { event: "video.publish.complete", open_id: openId, event_id: "e1" }, "{}", db);
    expect(first).toEqual({ applied: true, action: "synced_and_notified" });

    const replay = await processTikTokWebhook(
      { event: "video.publish.complete", open_id: openId, event_id: "e1" }, "{}", db);
    expect(replay.applied).toBe(false); // ← idempotence par event_id

    const events = await db.selectFrom("webhook_events").selectAll().execute();
    expect(events).toHaveLength(1);
    expect(events[0].processed_at).not.toBeNull();
  });

  it("désautorisation : le badge tombe", async () => {
    expect(await getShopIdentity("sh1", db)).toBeTruthy();
    const r = await processTikTokWebhook(
      { event: "authorization.removed", open_id: openId, event_id: "e2" }, "{}", db);
    expect(r.action).toBe("revoked");
    expect(await getShopIdentity("sh1", db)).toBeUndefined();
  });

  it("open_id inconnu : accepté mais sans effet", async () => {
    const r = await processTikTokWebhook(
      { event: "video.publish.complete", open_id: "inconnu", event_id: "e3" }, "{}", db);
    expect(r).toEqual({ applied: true, action: "unknown_open_id" });
  });

  it("deux événements distincts sont tous deux traités", async () => {
    await processTikTokWebhook({ event: "video.publish.complete", open_id: openId, event_id: "a" }, "{}", db);
    await processTikTokWebhook({ event: "video.publish.complete", open_id: openId, event_id: "b" }, "{}", db);
    expect(await db.selectFrom("webhook_events").selectAll().execute()).toHaveLength(2);
  });
});

describe("avis vérifiés (G5)", () => {
  let db: Kysely<DB>;
  beforeEach(async () => {
    db = memoryDb(); await seed(db);
    await db.insertInto("orders").values({
      id: "B-1000", shop_id: "sh1", product_id: "p1", variant: null,
      amount_fcfa: 8500, buyer_phone: "237699887766", source: "direct",
      status: "paid",
    }).execute();
  });

  it("une commande non livrée n'ouvre pas d'avis", async () => {
    expect(await openReview("B-1000", db)).toEqual({ created: false });
  });

  it("une commande livrée ouvre un avis unique", async () => {
    await db.updateTable("orders").set({ status: "delivered" }).where("id", "=", "B-1000").execute();
    const first = await openReview("B-1000", db);
    expect(first.created).toBe(true);
    const second = await openReview("B-1000", db);
    expect(second.created).toBe(false); // pas de second droit d'avis
    expect(await db.selectFrom("reviews").selectAll().execute()).toHaveLength(1);
  });

  it("le lien d'avis est à usage unique", async () => {
    await db.updateTable("orders").set({ status: "delivered" }).where("id", "=", "B-1000").execute();
    const { token } = await openReview("B-1000", db);
    expect(await submitReview(token!, { rating: 5, comment: "Parfait" }, db)).toBe(true);
    expect(await submitReview(token!, { rating: 1, comment: "Rejeu" }, db)).toBe(false);
    const r = await db.selectFrom("reviews").selectAll().executeTakeFirstOrThrow();
    expect(r.rating).toBe(5);
    expect(r.status).toBe("published");
  });

  it("un jeton inconnu est rejeté", async () => {
    expect(await submitReview("jeton-bidon", { rating: 5 }, db)).toBe(false);
  });
});
