import { z } from "zod";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { db, newId } from "./db";

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

/** Crée l'article + sa photo éventuelle (WebP 800px, stockage local/S3). */
export async function createProduct(
  shopId: string,
  data: z.infer<typeof productInput>,
  photo: unknown
): Promise<string> {
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

  if (photo instanceof File && photo.size > 0 && photo.size <= MAX_PHOTO_BYTES) {
    try {
      const buf = Buffer.from(await photo.arrayBuffer());
      const webp = await sharp(buf)
        .rotate()
        .resize({ width: 800, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer();
      const dir = join(process.cwd(), "public", "uploads");
      await mkdir(dir, { recursive: true });
      const filename = `${productId}.webp`;
      await writeFile(join(dir, filename), webp);
      await db
        .insertInto("product_media")
        .values({ id: newId(), product_id: productId, url_webp: `/uploads/${filename}` })
        .execute();
    } catch {
      // une photo illisible ne bloque jamais la création
    }
  }
  return productId;
}
