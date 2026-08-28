import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readSession } from "@/lib/session";
import { getShopBySeller } from "@/lib/sellers";
import { phoneCm, OPERATORS } from "@/lib/payments";
import { initiateSubscription } from "@/lib/subscriptions";
import { agregateurActif } from "@/lib/abonnement";

const input = z.object({ operator: z.enum(OPERATORS), phone: phoneCm });

export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const session = await readSession();
  if (!session) return NextResponse.redirect(`${base}/creer`, 303);
  const shop = await getShopBySeller(session.sellerId);
  if (!shop) return NextResponse.redirect(`${base}/creer`, 303);

  // Sans agrégateur, ce paiement ne peut pas aboutir : on renvoie l'écran
  // qui explique comment payer, plutôt qu'une attente sans fin.
  if (!agregateurActif()) {
    return NextResponse.redirect(`${base}/app/upgrade`, 303);
  }

  const form = await req.formData();
  const parsed = input.safeParse({
    operator: form.get("operator"),
    phone: form.get("phone"),
  });
  if (!parsed.success) {
    return NextResponse.redirect(`${base}/app/upgrade?err=1`, 303);
  }
  await initiateSubscription(shop.id, parsed.data.operator, parsed.data.phone);
  return NextResponse.redirect(`${base}/app/upgrade/attente`, 303);
}
