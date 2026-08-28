// Lot 7 — mesurer le pilote.
import { beforeEach, describe, expect, it } from "vitest";
import { Kysely, SqliteDialect } from "kysely";
import SQLite from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DB } from "@/lib/schema";
import { detectChannel } from "@/lib/channel";
import {
  agentsObserves,
  boutiquesParSemaine,
  boutiquesVivantes,
  commandesParBoutique,
  debutSemaine,
  renouvellements,
} from "@/lib/pilote";

function memoryDb(): Kysely<DB> {
  const database = new SQLite(":memory:");
  const dir = join(process.cwd(), "migrations");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    database.exec(readFileSync(join(dir, f), "utf8"));
  }
  return new Kysely<DB>({ dialect: new SqliteDialect({ database }) });
}

const ilYA = (j: number) =>
  new Date(Date.now() - j * 86400_000).toISOString().slice(0, 19).replace("T", " ");

describe("détection du canal d'arrivée", () => {
  // Le vrai navigateur intégré de TikTok sur Android annonce ces marqueurs.
  const UA_TIKTOK =
    "Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Chrome/107 Mobile Safari/537.36 " +
    "BytedanceWebview/d8a21c6 musical_ly_2022803040 JsSdk/1.0 AppName/musical_ly";
  const UA_CHROME =
    "Mozilla/5.0 (Linux; Android 11; Infinix X6511) AppleWebKit/537.36 Chrome/107 Mobile Safari/537.36";
  const UA_WHATSAPP = "WhatsApp/2.22.20.72 A";

  it("reconnaît TikTok par le user agent, MÊME avec un lien nu", () => {
    // C'est tout l'enjeu : le kit de partage donne un lien sans « ?src= »,
    // et une vendeuse ne recopiera jamais un paramètre à la main.
    expect(detectChannel(UA_TIKTOK, "direct")).toBe("tiktok");
    expect(detectChannel(UA_TIKTOK, null)).toBe("tiktok");
  });

  it("ne classe pas en TikTok un navigateur ordinaire", () => {
    expect(detectChannel(UA_CHROME, "direct")).toBe("autre");
    expect(detectChannel(UA_CHROME, null)).toBe("autre");
    expect(detectChannel(null, null)).toBe("autre");
  });

  it("reconnaît WhatsApp", () => {
    expect(detectChannel(UA_WHATSAPP, "direct")).toBe("whatsapp");
    expect(detectChannel(UA_CHROME, "src:wa")).toBe("whatsapp");
  });

  it("retombe sur la source quand le user agent ne dit rien", () => {
    expect(detectChannel(UA_CHROME, "v:7211111111111111111")).toBe("tiktok");
    expect(detectChannel(UA_CHROME, "src:bio")).toBe("tiktok");
    expect(detectChannel("", "src:tiktok")).toBe("tiktok");
  });

  it("le user agent prime sur la source", () => {
    // Un lien « src:wa » ouvert depuis TikTok est bien une visite TikTok.
    expect(detectChannel(UA_TIKTOK, "src:wa")).toBe("tiktok");
  });
});

describe("semaines", () => {
  it("ramène toute date au lundi de sa semaine", () => {
    expect(debutSemaine("2026-08-27 10:00:00")).toBe("2026-08-24"); // jeudi → lundi
    expect(debutSemaine("2026-08-24 00:00:00")).toBe("2026-08-24"); // lundi
    expect(debutSemaine("2026-08-30 23:59:59")).toBe("2026-08-24"); // dimanche
    expect(debutSemaine("2026-08-31 00:00:00")).toBe("2026-08-31"); // lundi suivant
  });
});

describe("les quatre chiffres du pilote", () => {
  let db: Kysely<DB>;

  beforeEach(async () => {
    db = memoryDb();
    await db.insertInto("sellers").values({
      id: "s1", phone: "237691882210", name: "N", lang: "fr",
    }).execute();
    await db.insertInto("shops").values([
      { id: "vivante", seller_id: "s1", slug: "vivante", name: "Vivante",
        city: "Douala", suspended: 0, created_at: ilYA(30) },
      { id: "morte", seller_id: "s1", slug: "morte", name: "Décrochée",
        city: "Douala", suspended: 0, created_at: ilYA(30) },
      { id: "suspendue", seller_id: "s1", slug: "suspendue", name: "Suspendue",
        city: "Douala", suspended: 1, created_at: ilYA(10) },
    ]).execute();
    await db.insertInto("products").values({
      id: "p1", shop_id: "vivante", name: "Sac", price_fcfa: 6000, video_url: null,
    }).execute();
  });

  it("2) ne compte comme vivante qu'une boutique visitée depuis TikTok récemment", async () => {
    await db.insertInto("visits").values([
      // vivante : TikTok il y a 2 jours
      { id: "v1", shop_id: "vivante", product_id: null, source: "direct",
        user_agent: "BytedanceWebview", channel: "tiktok", created_at: ilYA(2) },
      // morte : TikTok, mais il y a 20 jours
      { id: "v2", shop_id: "morte", product_id: null, source: "direct",
        user_agent: "BytedanceWebview", channel: "tiktok", created_at: ilYA(20) },
      // du trafic récent mais PAS TikTok : ne compte pas
      { id: "v3", shop_id: "morte", product_id: null, source: "direct",
        user_agent: "Chrome", channel: "autre", created_at: ilYA(1) },
    ]).execute();

    const r = await boutiquesVivantes(db);
    const vivante = r.find((b) => b.id === "vivante");
    const morte = r.find((b) => b.id === "morte");

    expect(vivante?.visitesTikTok7j).toBe(1);
    expect(morte?.visitesTikTok7j).toBe(0);
    expect(morte?.derniereVisiteTikTok).toBeTruthy(); // on sait quand elle a décroché
    // une boutique suspendue n'est pas suivie
    expect(r.find((b) => b.id === "suspendue")).toBeUndefined();
  });

  it("1) compte les créations par semaine", async () => {
    const r = await boutiquesParSemaine(db);
    const total = r.reduce((a, b) => a + b.boutiques, 0);
    expect(total).toBe(3);
    expect(r[0].semaine).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("3) délai entre création et première commande", async () => {
    await db.insertInto("orders").values([
      { id: "B-1", shop_id: "vivante", product_id: "p1", variant: null,
        amount_fcfa: 6000, buyer_phone: null, source: "direct", created_at: ilYA(25) },
      { id: "B-2", shop_id: "vivante", product_id: "p1", variant: null,
        amount_fcfa: 6000, buyer_phone: null, source: "direct", created_at: ilYA(3) },
    ]).execute();

    const r = await commandesParBoutique(db);
    const vivante = r.find((c) => c.slug === "vivante");
    expect(vivante?.commandes).toBe(2);
    expect(vivante?.delaiPremiereCommandeJours).toBe(5); // créée à J-30, 1re vente à J-25
    expect(vivante?.parSemaine.length).toBeGreaterThan(0);

    const morte = r.find((c) => c.slug === "morte");
    expect(morte?.commandes).toBe(0);
    expect(morte?.delaiPremiereCommandeJours).toBeNull();
  });

  it("3 bis) un jeu de données incohérent ne produit pas de délai négatif", async () => {
    await db.insertInto("orders").values({
      id: "B-9", shop_id: "vivante", product_id: "p1", variant: null,
      amount_fcfa: 6000, buyer_phone: null, source: "direct", created_at: ilYA(60),
    }).execute();
    const r = await commandesParBoutique(db);
    expect(r.find((c) => c.slug === "vivante")?.delaiPremiereCommandeJours).toBe(0);
  });

  it("4) une période offerte ne compte pas comme un paiement", async () => {
    const p = (id: string, shop: string, origin: string) => ({
      id, shop_id: shop, plan: "paid", amount: origin === "offered" ? 0 : 3000,
      period_start: ilYA(60), period_end: ilYA(30), payment_id: null,
      origin, payment_ref: `${id}-ref`, note: null, activated_by: "mike",
    });
    await db.insertInto("subscriptions").values([
      p("a1", "vivante", "manual"),   // a payé une fois
      p("a2", "vivante", "manual"),   // …puis une deuxième
      p("b1", "morte", "offered"),    // seulement offerte
    ]).execute();

    const r = await renouvellements(db);
    expect(r.boutiquesPayantes).toBe(1);
    expect(r.boutiquesRenouvelees).toBe(1);
    expect(r.boutiquesOffertesSeulement).toBe(1);
  });

  it("expose les navigateurs réellement observés, pour vérifier l'heuristique", async () => {
    await db.insertInto("visits").values([
      { id: "v1", shop_id: "vivante", product_id: null, source: "direct",
        user_agent: "BytedanceWebview/d8a21c6 musical_ly", channel: "tiktok", created_at: ilYA(1) },
      { id: "v2", shop_id: "vivante", product_id: null, source: "direct",
        user_agent: "Chrome/107", channel: "autre", created_at: ilYA(1) },
    ]).execute();
    const r = await agentsObserves(db);
    expect(r.find((a) => a.canal === "tiktok")?.agent).toContain("Bytedance");
    expect(r.some((a) => a.canal === "autre")).toBe(true);
  });
});
