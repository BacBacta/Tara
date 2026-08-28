// Affichage des photos d'articles.
// Elles étaient stockées mais lues nulle part : la vitrine montrait un
// dégradé. Ces tests verrouillent la lecture et le repli.
import { beforeEach, describe, expect, it } from "vitest";
import { Kysely, SqliteDialect } from "kysely";
import SQLite from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DB } from "@/lib/schema";
import { photosByProduct } from "@/lib/photos";

function memoryDb(): Kysely<DB> {
  const database = new SQLite(":memory:");
  const dir = join(process.cwd(), "migrations");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    database.exec(readFileSync(join(dir, f), "utf8"));
  }
  return new Kysely<DB>({ dialect: new SqliteDialect({ database }) });
}

describe("lecture des photos", () => {
  let db: Kysely<DB>;

  beforeEach(async () => {
    db = memoryDb();
    await db.insertInto("sellers").values({
      id: "s1", phone: "237691882210", name: "N", lang: "fr",
    }).execute();
    await db.insertInto("shops").values({
      id: "sh1", seller_id: "s1", slug: "n", name: "N", city: "Douala",
    }).execute();
    await db.insertInto("products").values([
      { id: "p1", shop_id: "sh1", name: "Robe", price_fcfa: 8500, video_url: null, removed: 0 },
      { id: "p2", shop_id: "sh1", name: "Sac", price_fcfa: 6000, video_url: null, removed: 0 },
    ]).execute();
  });

  it("renvoie la photo de chaque article qui en a une", async () => {
    await db.insertInto("product_media").values({
      id: "m1", product_id: "p1", url_webp: "/uploads/p1.webp", position: 0,
    }).execute();

    const m = await photosByProduct(["p1", "p2"], db);
    expect(m.get("p1")).toBe("/uploads/p1.webp");
    // l'article sans photo est absent : l'appelant retombe sur le dégradé
    expect(m.has("p2")).toBe(false);
  });

  it("garde la première photo quand il y en a plusieurs", async () => {
    await db.insertInto("product_media").values([
      { id: "m2", product_id: "p1", url_webp: "/uploads/deuxieme.webp", position: 1 },
      { id: "m1", product_id: "p1", url_webp: "/uploads/premiere.webp", position: 0 },
    ]).execute();

    expect((await photosByProduct(["p1"], db)).get("p1")).toBe("/uploads/premiere.webp");
  });

  it("accepte une URL absolue (Vercel Blob) comme une relative (disque)", async () => {
    await db.insertInto("product_media").values({
      id: "m1", product_id: "p1",
      url_webp: "https://exemple.public.blob.vercel-storage.com/articles/p1.webp",
      position: 0,
    }).execute();
    expect((await photosByProduct(["p1"], db)).get("p1")).toMatch(/^https:\/\//);
  });

  it("ne fait aucune requête sans article", async () => {
    expect((await photosByProduct([], db)).size).toBe(0);
  });
});

describe("rendu dans les pages publiques", () => {
  const vitrine = readFileSync(join(process.cwd(), "src/app/[slug]/page.tsx"), "utf8");
  const fiche = readFileSync(join(process.cwd(), "src/app/[slug]/p/[id]/page.tsx"), "utf8");

  it("la vitrine affiche la photo et garde le dégradé en repli", () => {
    expect(vitrine).toContain("photosByProduct");
    expect(vitrine).toMatch(/<img[\s\S]{0,200}src=\{photos\.get\(p\.id\)\}/);
    expect(vitrine).toContain("🛍️"); // le repli existe toujours
  });

  it("la fiche article affiche la photo et garde le dégradé en repli", () => {
    expect(fiche).toContain("photosByProduct");
    expect(fiche).toMatch(/<img[\s\S]{0,200}src=\{photo\}/);
    expect(fiche).toContain("GRADS[product.position % 4]");
  });

  it("les images ne coûtent aucun JavaScript (R2)", () => {
    // next/image embarque du JS et un optimiseur : inutile ici, la photo est
    // déjà en WebP 800 px. Une balise <img> native suffit et marche sans JS.
    for (const src of [vitrine, fiche]) {
      expect(src).not.toContain("next/image");
    }
  });

  it("les dimensions sont déclarées, pour que la grille ne saute pas en 3G", () => {
    expect(vitrine).toMatch(/width=\{400\}[\s\S]{0,60}height=\{400\}/);
    expect(vitrine).toContain('loading="lazy"');
    expect(fiche).toMatch(/width=\{800\}[\s\S]{0,60}height=\{600\}/);
  });
});
