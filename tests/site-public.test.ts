// Lot 3 — ce qu'un site public doit avoir.
import { beforeEach, describe, expect, it } from "vitest";
import { Kysely, SqliteDialect } from "kysely";
import SQLite from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DB } from "@/lib/schema";
import { listPublicShops, shareTagline } from "@/lib/public";
import { isReservedSlug, RESERVED_SLUGS } from "@/lib/reserved";
import {
  clamp, escapeXml, fitFontSize, ogSvg, renderOgPng,
  OG_HEIGHT, OG_TEXT_WIDTH, OG_WIDTH,
} from "@/lib/ogimage";

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
  await db.insertInto("shops").values([
    { id: "sh1", seller_id: "s1", slug: "nadia", name: "Nadia Friperie",
      city: "Douala", suspended: 0, plan: "free", plan_expires_at: null },
    { id: "sh2", seller_id: "s1", slug: "suspendue", name: "Suspendue",
      city: "Yaoundé", suspended: 1, plan: "free", plan_expires_at: null },
    { id: "sh3", seller_id: "s1", slug: "vide", name: "Sans article",
      city: "Douala", suspended: 0, plan: "free", plan_expires_at: null },
  ]).execute();
  await db.insertInto("products").values([
    { id: "p1", shop_id: "sh1", name: "Robe", price_fcfa: 8500, video_url: null, removed: 0 },
    { id: "p2", shop_id: "sh1", name: "Sac", price_fcfa: 6000, video_url: null, removed: 0 },
    { id: "p3", shop_id: "sh2", name: "Caché", price_fcfa: 1000, video_url: null, removed: 0 },
    { id: "p4", shop_id: "sh3", name: "Retiré", price_fcfa: 1000, video_url: null, removed: 1 },
  ]).execute();
}

describe("sitemap : boutiques publiques", () => {
  let db: Kysely<DB>;
  beforeEach(async () => {
    db = memoryDb();
    await seed(db);
  });

  it("ne liste que les boutiques actives qui ont au moins un article", async () => {
    const shops = await listPublicShops(db);
    expect(shops.map((s) => s.slug)).toEqual(["nadia"]);
  });

  it("une boutique suspendue disparaît du sitemap", async () => {
    const shops = await listPublicShops(db);
    expect(shops.find((s) => s.slug === "suspendue")).toBeUndefined();
  });

  it("chaque boutique n'apparaît qu'une fois malgré ses articles", async () => {
    const shops = await listPublicShops(db);
    expect(shops).toHaveLength(1); // sh1 a 2 articles
  });
});

describe("slugs réservés", () => {
  it("les routes racine ne peuvent pas être prises par une boutique", () => {
    for (const s of ["admin", "app", "creer", "cgu", "confidentialite", "mentions-legales"]) {
      expect(isReservedSlug(s)).toBe(true);
    }
    expect(isReservedSlug("ADMIN")).toBe(true); // insensible à la casse
    expect(isReservedSlug("nadia-friperie-237")).toBe(false);
  });

  it("chaque route racine du projet figure dans la liste", () => {
    const roots = readdirSync(join(process.cwd(), "src/app"), { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("[") && !e.name.startsWith("_"))
      .map((e) => e.name);
    for (const r of roots) expect(RESERVED_SLUGS.has(r)).toBe(true);
  });
});

describe("aperçu de partage (Open Graph)", () => {
  it("la phrase d'accroche accorde le pluriel, en FR et EN", () => {
    expect(shareTagline({ city: "Douala" }, 1)).toBe("Douala · 1 article · Commande sur WhatsApp");
    expect(shareTagline({ city: "Douala" }, 4)).toBe("Douala · 4 articles · Commande sur WhatsApp");
    expect(shareTagline({ city: "Buea" }, 1, "en")).toBe("Buea · 1 item · Order on WhatsApp");
    expect(shareTagline({ city: "Buea" }, 3, "en")).toBe("Buea · 3 items · Order on WhatsApp");
  });

  it("un nom de boutique hostile ne casse pas le SVG", () => {
    expect(escapeXml('Chez <script>&"Nadia"')).toBe(
      "Chez &lt;script&gt;&amp;&quot;Nadia&quot;"
    );
    const svg = ogSvg({
      title: '<script>alert(1)</script>', subtitle: "Douala", color: "#33418F",
    });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("une couleur de bannière invalide retombe sur l'indigo de la marque", () => {
    expect(ogSvg({ title: "X", subtitle: "Y", color: "javascript:alert(1)" }))
      .toContain('fill="#33418F"');
    expect(ogSvg({ title: "X", subtitle: "Y", color: "#F5A623" }))
      .toContain('fill="#F5A623"');
  });

  it("les textes trop longs sont coupés proprement", () => {
    expect(clamp("abcdef", 10)).toBe("abcdef");
    const long = clamp("a".repeat(60), 34);
    expect(long).toHaveLength(34);
    expect(long.endsWith("…")).toBe(true);
  });

  it("un titre long réduit la police au lieu de déborder du cadre", () => {
    // le nom d'article le plus long autorisé doit tenir dans la largeur utile
    const long = "Robe wax cintrée — tissu Vlisco premium";
    const size = fitFontSize(long, 82, 40);
    expect(size).toBeLessThan(82);
    expect(long.length * size * 0.58).toBeLessThanOrEqual(OG_TEXT_WIDTH);

    // un titre court garde la taille maximale
    expect(fitFontSize("Nadia", 82, 40)).toBe(82);

    // et on ne descend jamais sous le plancher lisible
    expect(fitFontSize("x".repeat(200), 82, 40)).toBe(40);
  });

  it("le rendu produit bien un PNG de 1200×630", async () => {
    const png = await renderOgPng({
      title: "Nadia Friperie 237", subtitle: "Douala · 4 articles", color: "#33418F",
    });
    // signature PNG
    expect(png.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    // dimensions, lues dans l'en-tête IHDR
    expect(png.readUInt32BE(16)).toBe(OG_WIDTH);
    expect(png.readUInt32BE(20)).toBe(OG_HEIGHT);
  });
});
