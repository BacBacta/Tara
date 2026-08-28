// Stockage des photos d'articles derrière une interface (Vercel Blob en
// serverless, disque en dev/VPS).
//
// L'enjeu : sur Vercel le disque est en lecture seule. Sans ce découplage,
// chaque photo échouait et l'article se créait sans elle, en silence.
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DiskStorageProvider,
  getStorageProvider,
  safeKey,
  VercelBlobProvider,
} from "@/lib/storage";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  delete process.env.STORAGE_PROVIDER;
  delete process.env.BLOB_READ_WRITE_TOKEN;
});

describe("choix du fournisseur de stockage", () => {
  it("disque par défaut", () => {
    expect(getStorageProvider().name).toBe("disk");
  });
  it("vercel_blob quand demandé", () => {
    process.env.STORAGE_PROVIDER = "vercel_blob";
    expect(getStorageProvider().name).toBe("vercel_blob");
  });
  it("une valeur inconnue retombe sur le disque plutôt que d'échouer", () => {
    process.env.STORAGE_PROVIDER = "n_importe_quoi";
    expect(getStorageProvider().name).toBe("disk");
  });
});

describe("clé de fichier", () => {
  it("refuse une remontée d'arborescence", () => {
    // key vient d'un identifiant interne, mais l'interface est publique :
    // on ne laisse pas un chemin s'y glisser.
    expect(() => safeKey("../../etc/passwd")).toThrow();
    expect(() => safeKey("")).toThrow();
    expect(() => safeKey(".secret")).toThrow();
  });
  it("laisse passer un identifiant d'article normal", () => {
    expect(safeKey("mtc09bvh7nbkv4he.webp")).toBe("mtc09bvh7nbkv4he.webp");
  });
  it("nettoie les séparateurs de chemin", () => {
    expect(safeKey("a/b/c.webp")).toBe("abc.webp");
  });
});

describe("Vercel Blob", () => {
  it("échoue proprement sans jeton, sans appeler le SDK", async () => {
    await expect(
      new VercelBlobProvider().save({
        key: "x.webp", body: Buffer.from("x"), contentType: "image/webp",
      })
    ).rejects.toThrow(/BLOB_READ_WRITE_TOKEN/);
  });

  it("appelle put() avec les bons paramètres et renvoie l'URL absolue", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "jeton-de-test";
    const put = vi.fn(async () => ({ url: "https://exemple.public.blob.vercel-storage.com/articles/abc.webp" }));
    vi.doMock("@vercel/blob", () => ({ put }));
    vi.resetModules();
    const { VercelBlobProvider: P } = await import("@/lib/storage");

    const r = await new P().save({
      key: "abc.webp", body: Buffer.from("photo"), contentType: "image/webp",
    });

    expect(r.url).toMatch(/^https:\/\//); // autorisé par la CSP (img-src https:)
    expect(put).toHaveBeenCalledTimes(1);
    const [chemin, corps, opts] = put.mock.calls[0] as unknown as [string, Buffer, Record<string, unknown>];
    expect(chemin).toBe("articles/abc.webp");
    expect(corps).toBeInstanceOf(Buffer);
    expect(opts.access).toBe("public");
    expect(opts.contentType).toBe("image/webp");
    expect(opts.token).toBe("jeton-de-test");
    // sans cela, remplacer la photo d'un article créerait un doublon orphelin
    expect(opts.addRandomSuffix).toBe(false);
    expect(opts.allowOverwrite).toBe(true);
    vi.doUnmock("@vercel/blob");
  });
});

describe("disque", () => {
  it("écrit dans public/uploads et renvoie une URL relative", async () => {
    const ecrites: { chemin: string; taille: number }[] = [];
    vi.doMock("node:fs/promises", () => ({
      mkdir: vi.fn(async () => undefined),
      writeFile: vi.fn(async (chemin: string, corps: Buffer) => {
        ecrites.push({ chemin, taille: corps.length });
      }),
    }));
    vi.resetModules();
    const { DiskStorageProvider: D } = await import("@/lib/storage");

    const r = await new D().save({
      key: "abc.webp", body: Buffer.from("photo"), contentType: "image/webp",
    });

    expect(r.url).toBe("/uploads/abc.webp");
    expect(ecrites[0].chemin).toContain(join("public", "uploads", "abc.webp"));
    vi.doUnmock("node:fs/promises");
  });
});

describe("garde-fous du projet", () => {
  it("le pré-vol refuse vercel_blob sans jeton", async () => {
    const { verifierEnv } = await import("../scripts/preflight-checks.mjs");
    const codes = verifierEnv({ STORAGE_PROVIDER: "vercel_blob" }).map((p: { code: string }) => p.code);
    expect(codes).toContain("stockage_incomplet");
  });

  it("la CSP autorise les images https distantes", () => {
    // Les URL Vercel Blob sont absolues : sans « https: » dans img-src,
    // aucune photo ne s'afficherait.
    const conf = readFileSync(join(process.cwd(), "next.config.mjs"), "utf8");
    expect(conf).toMatch(/img-src[^"]*https:/);
  });

  it("createProduct n'écrit plus jamais sur le disque en direct", () => {
    // Toute écriture doit passer par l'interface, sinon le serverless casse.
    const src = readFileSync(join(process.cwd(), "src/lib/products.ts"), "utf8");
    expect(src).not.toMatch(/writeFile|mkdir/);
    expect(src).toContain("getStorageProvider");
  });
});
