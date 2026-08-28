// POST /app/commandes/cliente — la vendeuse attache le numéro de sa cliente
// à une commande. En paiement direct, aucun numéro ne passe par Tara : sans
// ce geste, ni le bouton WhatsApp ni le lien d'avis n'existent.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readSession } from "@/lib/session";
import { getShopBySeller } from "@/lib/sellers";
import { setBuyerPhone } from "@/lib/orders";
import { sendReviewLink } from "@/lib/reviews";

const input = z.object({
  order: z.string().regex(/^B-\d{4,6}$/),
  phone: z.string().min(6).max(20),
});

export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const session = await readSession();
  if (!session) return NextResponse.redirect(`${base}/creer`, 303);
  const shop = await getShopBySeller(session.sellerId);
  if (!shop) return NextResponse.redirect(`${base}/creer`, 303);

  const form = await req.formData();
  const parsed = input.safeParse({ order: form.get("order"), phone: form.get("phone") });
  if (!parsed.success) {
    return NextResponse.redirect(`${base}/app/commandes?err=phone`, 303);
  }

  const ok = await setBuyerPhone(parsed.data.order, shop.id, parsed.data.phone);
  if (!ok) return NextResponse.redirect(`${base}/app/commandes?err=phone`, 303);

  // commande déjà livrée : le lien d'avis part maintenant qu'on a un numéro
  await sendReviewLink(parsed.data.order);

  return NextResponse.redirect(`${base}/app/commandes?ok=1`, 303);
}
