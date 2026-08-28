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
  const res = await createProduct(shop.id, parsed.data, form.get("photo"));
  // L'article est créé dans tous les cas ; si la photo n'a pas suivi, on le
  // dit — sinon la vendeuse croit sa boutique à jour alors qu'il lui manque
  // le seul élément qui fait vendre.
  const suffixe = res.photo === "echec" ? "?photo=echec" : "";
  return NextResponse.redirect(`${base}/app/articles${suffixe}`, 303);
}
