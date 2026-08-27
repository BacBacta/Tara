import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { db, newId } from "@/lib/db";
import { readSession } from "@/lib/session";
import { getShopBySeller } from "@/lib/sellers";

const input = z.object({
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

export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const session = readSession();
  if (!session) return NextResponse.redirect(`${base}/creer`, 303);
  const shop = await getShopBySeller(session.sellerId);
  if (!shop) return NextResponse.redirect(`${base}/creer/boutique`, 303);

  const form = await req.formData();
  const parsed = input.safeParse({
    name: form.get("name"),
    price: form.get("price"),
    video_url: form.get("video_url") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.redirect(`${base}/creer/article?err=1`, 303);
  }

  const productId = newId();
  await db
    .insertInto("products")
    .values({
      id: productId,
      shop_id: shop.id,
      name: parsed.data.name,
      price_fcfa: parsed.data.price,
      video_url: parsed.data.video_url ?? null,
    })
    .execute();

  // Photo optionnelle → WebP 800px max, stockage local (interface S3 en prod)
  const photo = form.get("photo");
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
      // une photo illisible ne bloque jamais la création de l'article
    }
  }

  return NextResponse.redirect(`${base}/creer/fini`, 303);
}
