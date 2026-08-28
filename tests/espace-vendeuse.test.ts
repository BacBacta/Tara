// L'espace vendeuse : douze écrans qui avaient chacun leur mise en page.
// Ces tests verrouillent le cadre commun, la palette, et le compteur
// « à faire » qui décide de ce que la vendeuse voit en premier.
import { beforeEach, describe, expect, it } from "vitest";
import { Kysely, SqliteDialect } from "kysely";
import SQLite from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DB } from "@/lib/schema";
import { todo } from "@/lib/stats";

const APP = join(process.cwd(), "src/app/app");
const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** Toutes les pages de l'espace vendeuse, chemins relatifs au dépôt. */
function pagesVendeuse(dir = APP): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const chemin = join(dir, e.name);
    if (e.isDirectory()) out.push(...pagesVendeuse(chemin));
    else if (e.name === "page.tsx") out.push(chemin.replace(process.cwd() + "/", ""));
  }
  return out.sort();
}

// L'écran d'attente d'abonnement est un plein écran d'état (comme l'attente
// de paiement côté acheteuse) : il n'a ni titre ni barre du bas.
const HORS_CADRE = ["src/app/app/upgrade/attente/page.tsx"];

describe("un seul cadre pour l'espace vendeuse", () => {
  const pages = pagesVendeuse();

  it("les douze écrans existent toujours", () => {
    expect(pages.length).toBe(12);
  });

  for (const page of pagesVendeuse().filter((p) => !HORS_CADRE.includes(p))) {
    it(`${page} passe par AppShell`, () => {
      expect(lire(page)).toContain("@/components/AppShell");
    });
  }

  it("aucune page ne pose la barre du bas elle-même", () => {
    // elle vient d'AppShell : un seul endroit à faire évoluer
    for (const page of pagesVendeuse()) {
      expect(lire(page)).not.toContain("@/components/AppNav");
    }
    expect(lire("src/components/AppShell.tsx")).toContain("./AppNav");
  });

  it("la palette du design system a remplacé les gris génériques", () => {
    for (const page of pagesVendeuse()) {
      const src = lire(page);
      for (const legacy of ["text-gray-", "border-gray-", "bg-gray-", "bg-indigo-50"]) {
        expect(src, `${page} contient ${legacy}`).not.toContain(legacy);
      }
    }
  });

  it("l'ancien nom du produit a disparu du code", () => {
    // le tableau de bord affichait encore « Bio·Shop » en titre
    for (const page of pagesVendeuse()) expect(lire(page)).not.toContain("Bio·");
    expect(lire("src/components/AppShell.tsx")).toContain("Wordmark");
  });

  it("les écrans restent des pages serveur à formulaires POST", () => {
    for (const page of pagesVendeuse()) {
      const src = lire(page);
      expect(src).not.toContain('"use client"');
      expect(src).not.toContain("fetch(");
    }
  });
});

describe("la vendeuse voit enfin ses articles", () => {
  it("la liste d'articles affiche la photo, en variante légère", () => {
    const src = lire("src/app/app/articles/page.tsx");
    expect(src).toContain("photosByProduct");
    expect(src).toContain("photoVariant(photo, 320)");
    expect(src).toContain("🛍️"); // repli quand l'article n'a pas de photo
  });
});

describe("ce qui attend la vendeuse", () => {
  let db: Kysely<DB>;

  beforeEach(async () => {
    const database = new SQLite(":memory:");
    const dir = join(process.cwd(), "migrations");
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      database.exec(readFileSync(join(dir, f), "utf8"));
    }
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database }) });

    await db.insertInto("sellers").values({ id: "s1", phone: "237691882210", name: "N", lang: "fr" }).execute();
    await db.insertInto("shops").values([
      { id: "sh1", seller_id: "s1", slug: "n", name: "N", city: "Douala" },
      { id: "sh2", seller_id: "s1", slug: "m", name: "M", city: "Yaoundé" },
    ]).execute();
    await db.insertInto("products").values({
      id: "p1", shop_id: "sh1", name: "Robe", price_fcfa: 8500, video_url: null, removed: 0,
    }).execute();
  });

  const commande = (id: string, shop: string, status: string) => ({
    id, shop_id: shop, product_id: "p1", qty: 1, amount_fcfa: 8500,
    buyer_phone: "237690000000", status,
  });

  it("compte les paiements annoncés et les commandes à livrer", async () => {
    await db.insertInto("orders").values([
      commande("B-1", "sh1", "payment_announced"),
      commande("B-2", "sh1", "payment_announced"),
      commande("B-3", "sh1", "paid"),
      commande("B-4", "sh1", "delivered"), // livrée : plus rien à faire
      commande("B-5", "sh1", "cancelled"),
    ]).execute();

    expect(await todo("sh1", db)).toEqual({ aVerifier: 2, aLivrer: 1 });
  });

  it("ne compte que les commandes de la boutique demandée", async () => {
    await db.insertInto("orders").values([
      commande("B-6", "sh1", "paid"),
      commande("B-7", "sh2", "paid"),
      commande("B-8", "sh2", "payment_announced"),
    ]).execute();

    expect(await todo("sh1", db)).toEqual({ aVerifier: 0, aLivrer: 1 });
    expect(await todo("sh2", db)).toEqual({ aVerifier: 1, aLivrer: 1 });
  });

  it("renvoie zéro quand il n'y a rien à faire", async () => {
    expect(await todo("sh1", db)).toEqual({ aVerifier: 0, aLivrer: 0 });
  });
});
