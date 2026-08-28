import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { getShopBySeller } from "@/lib/sellers";
import { createDrop, dropInput } from "@/lib/drops";

export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const session = await readSession();
  if (!session) return NextResponse.redirect(`${base}/creer`, 303);
  const shop = await getShopBySeller(session.sellerId);
  if (!shop) return NextResponse.redirect(`${base}/creer`, 303);

  const form = await req.formData();
  const parsed = dropInput.safeParse({
    title: form.get("title"),
    opens_at: form.get("opens_at"),
    products: form.getAll("products").map(String),
  });
  if (!parsed.success) return NextResponse.redirect(`${base}/app/drops`, 303);

  // n'accepter que les articles de la boutique
  const owned = await db.selectFrom("products").select("id")
    .where("shop_id", "=", shop.id).where("removed", "=", 0).execute();
  const allowed = new Set(owned.map((p) => p.id));
  const products = parsed.data.products.filter((p) => allowed.has(p));

  const dropId = await createDrop(shop.id, { ...parsed.data, products });

  // stock chiffré du drop (garantit l'absence de survente)
  const stock = Number(form.get("stock") ?? 0);
  if (Number.isFinite(stock) && stock > 0 && products.length > 0) {
    await db.updateTable("products").set({ stock_qty: stock })
      .where("id", "in", products).execute();
  }
  return NextResponse.redirect(`${base}/app/drops?ok=${dropId.slice(0, 4)}`, 303);
}
