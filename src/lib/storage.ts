// Stockage des photos d'articles.
//
// Pourquoi une interface : jusqu'ici createProduct écrivait directement dans
// public/uploads/. Cela marche sur un VPS, mais **pas** sur une plateforme
// serverless (Vercel), dont le système de fichiers est en lecture seule à
// l'exécution : l'écriture échouait, et le catch silencieux de createProduct
// faisait qu'un article se créait sans photo sans que la vendeuse le sache.
//
// Même patron que PaymentProvider / NotifyProvider / OtpProvider : une
// interface, plusieurs implémentations, le choix par variable d'environnement.
// Brancher un autre stockage (S3, R2) = une classe de plus, rien d'autre.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface StorageProvider {
  readonly name: string;
  /**
   * Enregistre un fichier et renvoie son URL publique.
   * `key` est un nom de fichier simple (pas un chemin) : l'implémentation
   * décide où il atterrit.
   */
  save(opts: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<{ url: string }>;
}

/** Nom de fichier sûr : ni chemin, ni remontée d'arborescence. */
export function safeKey(key: string): string {
  const k = key.replace(/[^A-Za-z0-9._-]/g, "");
  if (!k || k.startsWith(".")) throw new Error("clé de fichier invalide");
  return k;
}

/**
 * Disque local — développement et VPS.
 * Les fichiers sont servis par Next depuis public/uploads/.
 */
export class DiskStorageProvider implements StorageProvider {
  readonly name = "disk";

  // La signature reprend l'interface entière — contentType est inutile sur
  // disque (Next le déduit de l'extension), mais la restreindre empêcherait
  // d'appeler ce fournisseur directement.
  async save(opts: {
    key: string;
    body: Buffer;
    contentType?: string;
  }): Promise<{ url: string }> {
    const key = safeKey(opts.key);
    const dir = join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, key), opts.body);
    return { url: `/uploads/${key}` };
  }
}

/**
 * Vercel Blob — production serverless.
 * Nécessite BLOB_READ_WRITE_TOKEN (fourni automatiquement par Vercel quand
 * un store Blob est attaché au projet). Renvoie une URL absolue en https,
 * déjà autorisée par la CSP (`img-src 'self' data: https:`).
 *
 * Import paresseux : un déploiement sur VPS n'a jamais à charger ce SDK.
 */
export class VercelBlobProvider implements StorageProvider {
  readonly name = "vercel_blob";

  async save(opts: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<{ url: string }> {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) throw new Error("BLOB_READ_WRITE_TOKEN absent");
    const { put } = await import("@vercel/blob");
    const res = await put(`articles/${safeKey(opts.key)}`, opts.body, {
      access: "public",
      contentType: opts.contentType,
      token,
      // la clé vaut déjà l'identifiant de l'article : un suffixe aléatoire
      // empêcherait de remplacer la photo d'un article existant
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return { url: res.url };
  }
}

export function getStorageProvider(): StorageProvider {
  return process.env.STORAGE_PROVIDER === "vercel_blob"
    ? new VercelBlobProvider()
    : new DiskStorageProvider();
}
