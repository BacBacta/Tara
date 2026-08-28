// Trois défauts trouvés par la répétition générale du pilote (28/08/2026),
// joués de bout en bout sur PostgreSQL. Ces tests les verrouillent.
//
//  1. en paiement direct, aucun numéro d'acheteuse n'arrive jusqu'à Tara :
//     le lien d'avis n'était envoyé à personne et le bouton « écrire à la
//     cliente » n'apparaissait jamais ;
//  2. l'export CSV mélangeait deux formats de date dans la même feuille ;
//  3. sans agrégateur, le bouton d'abonnement menait à une attente sans fin.
import { beforeEach, describe, expect, it } from "vitest";
import { Kysely, SqliteDialect } from "kysely";
import SQLite from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DB } from "@/lib/schema";
import { setBuyerPhone } from "@/lib/orders";
import { openReview, sendReviewLink } from "@/lib/reviews";
import { dateCsv } from "@/lib/format";
import { agregateurActif, collecteAbonnement, messagePreviensTara } from "@/lib/abonnement";
import { verifierEnv } from "../scripts/preflight-checks.mjs";

function memoryDb(): Kysely<DB> {
  const database = new SQLite(":memory:");
  const dir = join(process.cwd(), "migrations");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    database.exec(readFileSync(join(dir, f), "utf8"));
  }
  return new Kysely<DB>({ dialect: new SqliteDialect({ database }) });
}

describe("le numéro de la cliente, attaché par la vendeuse", () => {
  let db: Kysely<DB>;

  beforeEach(async () => {
    db = memoryDb();
    await db.insertInto("sellers").values({ id: "s1", phone: "237691882210", name: "N", lang: "fr" }).execute();
    await db.insertInto("shops").values([
      { id: "sh1", seller_id: "s1", slug: "n", name: "N", city: "Douala" },
      { id: "sh2", seller_id: "s1", slug: "m", name: "M", city: "Yaoundé" },
    ]).execute();
    await db.insertInto("products").values({
      id: "p1", shop_id: "sh1", name: "Robe", price_fcfa: 8500, video_url: null, removed: 0,
    }).execute();
    await db.insertInto("orders").values({
      id: "B-1000", shop_id: "sh1", product_id: "p1", qty: 1,
      amount_fcfa: 8500, buyer_phone: null, status: "delivered",
    }).execute();
  });

  const numero = async () =>
    (await db.selectFrom("orders").select("buyer_phone").where("id", "=", "B-1000").executeTakeFirst())
      ?.buyer_phone ?? null;

  it("enregistre et normalise un numéro camerounais", async () => {
    expect(await setBuyerPhone("B-1000", "sh1", "6 90 11 22 33", db)).toBe(true);
    expect(await numero()).toBe("237690112233");
  });

  it("refuse un numéro qui n'en est pas un", async () => {
    expect(await setBuyerPhone("B-1000", "sh1", "12345", db)).toBe(false);
    expect(await numero()).toBeNull();
  });

  it("une vendeuse ne peut pas écrire sur la commande d'une autre boutique", async () => {
    expect(await setBuyerPhone("B-1000", "sh2", "690112233", db)).toBe(false);
    expect(await numero()).toBeNull();
  });
});

describe("le lien d'avis part quand un numéro existe", () => {
  let db: Kysely<DB>;

  beforeEach(async () => {
    db = memoryDb();
    await db.insertInto("sellers").values({ id: "s1", phone: "237691882210", name: "N", lang: "fr" }).execute();
    await db.insertInto("shops").values({ id: "sh1", seller_id: "s1", slug: "n", name: "N", city: "Douala" }).execute();
    await db.insertInto("products").values({
      id: "p1", shop_id: "sh1", name: "Robe", price_fcfa: 8500, video_url: null, removed: 0,
    }).execute();
  });

  const commande = (id: string, status: string, phone: string | null) =>
    db.insertInto("orders").values({
      id, shop_id: "sh1", product_id: "p1", qty: 1,
      amount_fcfa: 8500, buyer_phone: phone, status,
    }).execute();

  it("livrée sans numéro : le droit d'avis existe, mais rien n'est envoyé", async () => {
    await commande("B-1000", "delivered", null);
    const ouvert = await openReview("B-1000", db);
    expect(ouvert.created).toBe(true); // le jeton est bien créé
    expect(await sendReviewLink("B-1000", db)).toBe(false); // personne à prévenir
  });

  it("le numéro arrive après la livraison : le lien part enfin", async () => {
    await commande("B-1000", "delivered", null);
    await openReview("B-1000", db);
    expect(await setBuyerPhone("B-1000", "sh1", "690112233", db)).toBe(true);
    expect(await sendReviewLink("B-1000", db)).toBe(true);
  });

  it("ne renvoie rien une fois l'avis déposé", async () => {
    await commande("B-1000", "delivered", "237690112233");
    await openReview("B-1000", db);
    await db.updateTable("reviews").set({ status: "published", rating: 5 })
      .where("order_id", "=", "B-1000").execute();
    expect(await sendReviewLink("B-1000", db)).toBe(false);
  });

  it("ne part pas avant la livraison", async () => {
    await commande("B-1000", "paid", "237690112233");
    expect(await sendReviewLink("B-1000", db)).toBe(false);
  });
});

describe("dates de l'export CSV", () => {
  it("ramène l'ISO et le format SQL au même format", () => {
    expect(dateCsv("2026-09-27T21:01:50.627Z")).toBe("2026-09-27 21:01:50");
    expect(dateCsv("2026-08-28 20:57:31")).toBe("2026-08-28 20:57:31");
  });

  it("laisse passer le vide et ne casse pas sur une valeur illisible", () => {
    expect(dateCsv(null)).toBe("");
    expect(dateCsv("")).toBe("");
    expect(dateCsv("pas une date")).toBe("pas une date");
  });
});

describe("comment la vendeuse paie son abonnement", () => {
  it("un vrai fournisseur ouvre le paiement dans l'application", () => {
    expect(agregateurActif("simiz")).toBe(true);
    expect(collecteAbonnement({ PAYMENT_PROVIDER: "simiz" }).mode).toBe("agregateur");
  });

  it("sans fournisseur, on bascule sur le portefeuille de Tara", () => {
    expect(agregateurActif("mock")).toBe(false);
    expect(agregateurActif("")).toBe(false);
    const c = collecteAbonnement({
      PAYMENT_PROVIDER: "mock",
      TARA_MOMO_NUMBER: "237677889900",
      TARA_MOMO_OPERATOR: "orange",
      TARA_WHATSAPP: "237677889900",
    });
    expect(c).toEqual({
      mode: "manuel",
      numero: "237677889900",
      operateur: "orange",
      whatsapp: "237677889900",
    });
  });

  it("aucun numéro configuré : on ne fait pas semblant", () => {
    const c = collecteAbonnement({ PAYMENT_PROVIDER: "mock" });
    expect(c).toMatchObject({ mode: "manuel", numero: null, whatsapp: null });
  });

  it("le message de prévenance nomme la boutique et le montant", () => {
    const m = messagePreviensTara("nadia-friperie-237", "3 000 F");
    expect(m).toContain("nadia-friperie-237");
    expect(m).toContain("3 000 F");
  });

  it("le pré-vol refuse une production où personne ne peut s'abonner", () => {
    const sansMoyen = { PAYMENT_PROVIDER: "mock", TARA_MOMO_NUMBER: "" };
    const codes = verifierEnv(sansMoyen).map((p: { code: string }) => p.code);
    expect(codes).toContain("abonnement_sans_moyen");

    // avec le portefeuille renseigné, ou avec un agrégateur, plus d'alerte
    for (const env of [
      { PAYMENT_PROVIDER: "mock", TARA_MOMO_NUMBER: "237677889900" },
      { PAYMENT_PROVIDER: "simiz", TARA_MOMO_NUMBER: "" },
    ]) {
      expect(verifierEnv(env).map((p: { code: string }) => p.code)).not.toContain(
        "abonnement_sans_moyen"
      );
    }
  });
});
