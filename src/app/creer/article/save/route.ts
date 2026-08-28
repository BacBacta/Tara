import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getShopBySeller } from "@/lib/sellers";
import { canAddProduct } from "@/lib/plan";
import { createProduct, productInput } from "@/lib/products";

export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const session = await readSession();
  if (!session) return NextResponse.redirect(`${base}/creer`, 303);
  const shop = await getShopBySeller(session.sellerId);
  if (!shop) return NextResponse.redirect(`${base}/creer/boutique`, 303);

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
    return NextResponse.redirect(`${base}/creer/article?err=1`, 303);
  }
  await createProduct(shop.id, parsed.data, form.get("photo"));
  // (onboarding : la vendeuse revoit ses articles juste après, à l'étape suivante)
  return NextResponse.redirect(`${base}/creer/fini`, 303);
}
