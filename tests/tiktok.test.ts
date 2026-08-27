// V2 — identités TikTok, chiffrement des jetons, synchronisation, tags.
import { beforeEach, describe, expect, it } from "vitest";
import { Kysely, SqliteDialect } from "kysely";
import SQLite from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DB } from "@/lib/schema";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { MockTikTokProvider, TIKTOK_SCOPES } from "@/lib/tiktok";
import {
  connectIdentity, getIdentity, getShopIdentity, revokeIdentity,
  syncIdentity, tagProducts,
} from "@/lib/identities";

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
  await db.insertInto("products").values([
    { id: "p1", shop_id: "sh1", name: "Robe", price_fcfa: 8500, video_url: null },
    { id: "p2", shop_id: "sh1", name: "Sac", price_fcfa: 6000, video_url: null },
  ]).execute();
}

describe("chiffrement des jetons OAuth", () => {
  it("aller-retour", () => {
    const enc = encryptToken("act_secret_123");
    expect(enc).not.toContain("act_secret_123");
    expect(decryptToken(enc)).toBe("act_secret_123");
  });
  it("payload altéré → null (AES-GCM authentifié)", () => {
    const enc = encryptToken("secret");
    const [iv, tag, ct] = enc.split(".");
    expect(decryptToken(`${iv}.${tag}.${ct.slice(0, -2)}AA`)).toBeNull();
    expect(decryptToken("nimporte-quoi")).toBeNull();
  });
});

describe("provider TikTok (mock)", () => {
  const p = new MockTikTokProvider();
  it("demande les 4 scopes du cahier des charges", async () => {
    const tokens = await p.exchangeCode("code123");
    expect(tokens.scopes.split(",")).toEqual([...TIKTOK_SCOPES]);
  });
  it("les identifiants vidéo sont uniques", async () => {
    const vids = await p.listVideos("mock_at_x");
    expect(new Set(vids.map((v) => v.id)).size).toBe(vids.length);
  });
  it("les métriques sont positives", async () => {
    const vids = await p.listVideos("mock_at_y");
    for (const v of vids) {
      expect(v.views).toBeGreaterThan(0);
      expect(v.likes).toBeGreaterThan(0);
    }
  });
});

describe("connexion, synchronisation et révocation", () => {
  let db: Kysely<DB>;
  beforeEach(async () => { db = memoryDb(); await seed(db); });

  async function connect() {
    const p = new MockTikTokProvider();
    const tokens = await p.exchangeCode("c1");
    const profile = await p.fetchProfile(tokens.accessToken);
    await connectIdentity("s1", tokens, profile, db);
  }

  it("connecte, chiffre le jeton et expose le badge", async () => {
    await connect();
    const id = await getIdentity("s1", db);
    expect(id?.status).toBe("active");
    expect(id?.access_token_enc).not.toContain("mock_at");
    const badge = await getShopIdentity("sh1", db);
    expect(badge?.username).toBeTruthy();
  });

  it("synchronise les vidéos, sans doublon à la seconde synchro", async () => {
    await connect();
    const first = await syncIdentity("s1", "sh1", db);
    expect("videos" in first).toBe(true);
    await syncIdentity("s1", "sh1", db);
    const rows = await db.selectFrom("videos").selectAll().execute();
    expect(rows.length).toBe("videos" in first ? first.videos : 0);
  });

  it("révocation : le badge tombe immédiatement", async () => {
    await connect();
    expect(await getShopIdentity("sh1", db)).toBeTruthy();
    const n = await revokeIdentity({ sellerId: "s1" }, db);
    expect(n).toBe(1);
    expect(await getShopIdentity("sh1", db)).toBeUndefined();
  });

  it("reconnexion après révocation réactive le badge", async () => {
    await connect();
    await revokeIdentity({ sellerId: "s1" }, db);
    await connect();
    expect(await getShopIdentity("sh1", db)).toBeTruthy();
    const all = await db.selectFrom("external_identities").selectAll().execute();
    expect(all).toHaveLength(1); // pas de doublon d'identité
  });

  it("le tag remplace les articles précédents", async () => {
    await connect();
    await syncIdentity("s1", "sh1", db);
    const v = await db.selectFrom("videos").select("id").executeTakeFirstOrThrow();
    await tagProducts(v.id, ["p1", "p2"], db);
    expect(await db.selectFrom("video_products").selectAll().execute()).toHaveLength(2);
    await tagProducts(v.id, ["p2"], db);
    const rows = await db.selectFrom("video_products").selectAll().execute();
    expect(rows).toHaveLength(1);
    expect(rows[0].product_id).toBe("p2");
  });

  it("synchroniser sans compte connecté échoue proprement", async () => {
    const r = await syncIdentity("s1", "sh1", db);
    expect("error" in r && r.error).toBe("not_connected");
  });
});
