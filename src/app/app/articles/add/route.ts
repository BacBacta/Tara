import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getShopBySeller } from "@/lib/sellers";
import { canAddProduct } from "@/lib/plan";
import { createProduct, productInput } from "@/lib/products";

export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const session = readSession();
  if (!session) return NextResponse.redirect(`${base}/creer`, 303);
  const shop = await getShopBySeller(session.sellerId);
  if (!shop) return NextResponse.redirect(`${base}/creer`, 303);

  // Palier gratuit : blocage du 11e article → écran d'upgrade
  if (!(await canAddProduct(shop))) {
    return NextResponse.redirect(`${base}/app/upgrade?from=limit`, 303);
  }

  const form = await req.formData();
  const parsed = productInput.safeParse({
    name: form.get("name"),
    price: form.get("price"),
    video_url: form.get("video_url") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.redirect(`${base}/app/articles?err=1`, 303);
  }
  await createProduct(shop.id, parsed.data, form.get("photo"));
  return NextResponse.redirect(`${base}/app/articles`, 303);
}
