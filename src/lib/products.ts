import { z } from "zod";
import sharp from "sharp";
import { db, newId } from "./db";
import { getStorageProvider } from "./storage";

export const productInput = z.object({
  name: z.string().trim().min(3).max(80),
  price: z.coerce.number().int().min(100).max(10_000_000),
  video_url: z
    .string()
    .trim()
    .url()
    .refine((u) => /tiktok\.com/.test(u), "URL TikTok attendue")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/** Sort de la création : la photo a-t-elle suivi ? */
export type PhotoOutcome = "aucune" | "enregistree" | "echec";

/**
 * Crée l'article et, si une photo est fournie, la convertit en WebP 800 px
 * et la confie au fournisseur de stockage (disque en dev/VPS, Vercel Blob
 * en serverless — voir lib/storage.ts).
 *
 * Une photo qui échoue ne bloque JAMAIS la création de l'article : la
 * vendeuse est en 3G, l'article doit exister. Mais l'échec est désormais
 * REMONTÉ (`echec`) au lieu d'être avalé en silence, pour qu'on puisse le
 * lui dire — un article de friperie sans photo ne se vend pas.
 */
export async function createProduct(
  shopId: string,
  data: z.infer<typeof productInput>,
  photo: unknown
): Promise<{ id: string; photo: PhotoOutcome }> {
  const productId = newId();
  const maxPos = await db
    .selectFrom("products")
    .select(db.fn.max("position").as("m"))
    .where("shop_id", "=", shopId)
    .executeTakeFirst();

  await db
    .insertInto("products")
    .values({
      id: productId,
      shop_id: shopId,
      name: data.name,
      price_fcfa: data.price,
      video_url: data.video_url ?? null,
      position: Number(maxPos?.m ?? -1) + 1,
    })
    .execute();

  if (!(photo instanceof File) || photo.size === 0 || photo.size > MAX_PHOTO_BYTES) {
    return { id: productId, photo: "aucune" };
  }

  try {
    const buf = Buffer.from(await photo.arrayBuffer());
    const webp = await sharp(buf)
      .rotate()
      .resize({ width: 800, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();

    const { url } = await getStorageProvider().save({
      key: `${productId}.webp`,
      body: webp,
      contentType: "image/webp",
    });

    await db
      .insertInto("product_media")
      .values({ id: newId(), product_id: productId, url_webp: url })
      .execute();
    return { id: productId, photo: "enregistree" };
  } catch (e) {
    // L'article reste créé. On journalise pour que la cause soit trouvable
    // côté serveur (stockage mal configuré, image illisible, quota…).
    console.error("[photo] échec d'enregistrement", e instanceof Error ? e.message : e);
    return { id: productId, photo: "echec" };
  }
}
