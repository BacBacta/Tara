import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { getShopBySeller } from "@/lib/sellers";
import { tagProducts } from "@/lib/identities";

export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const session = await readSession();
  if (!session) return NextResponse.redirect(`${base}/creer`, 303);
  const shop = await getShopBySeller(session.sellerId);
  if (!shop) return NextResponse.redirect(`${base}/creer`, 303);

  const form = await req.formData();
  const videoId = String(form.get("video") ?? "");
  const productIds = form.getAll("products").map(String);

  // la vidéo doit appartenir à la boutique
  const video = await db
    .selectFrom("videos").select("id")
    .where("id", "=", videoId).where("shop_id", "=", shop.id)
    .executeTakeFirst();
  if (!video) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // ne garder que les articles de la boutique
  const owned = await db
    .selectFrom("products").select("id")
    .where("shop_id", "=", shop.id).where("removed", "=", 0)
    .execute();
  const allowed = new Set(owned.map((p) => p.id));
  await tagProducts(videoId, productIds.filter((p) => allowed.has(p)));

  return NextResponse.redirect(`${base}/app/videos?ok=1`, 303);
}
