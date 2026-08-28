import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { getShopBySeller } from "@/lib/sellers";
import { OPERATORS, PAYMENT_MODES, phoneCm } from "@/lib/payments";

const input = z.object({
  city: z.string().trim().min(2).max(40),
  banner_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  momo_enabled: z.coerce.boolean(),
  lang: z.enum(["fr", "en"]),
  payment_mode: z.enum(PAYMENT_MODES),
  momo_operator: z.enum(OPERATORS),
  momo_number: z.string().trim().max(20),
});

export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const session = await readSession();
  if (!session) return NextResponse.redirect(`${base}/creer`, 303);
  const shop = await getShopBySeller(session.sellerId);
  if (!shop) return NextResponse.redirect(`${base}/creer`, 303);

  const form = await req.formData();
  const parsed = input.safeParse({
    city: form.get("city"),
    banner_color: form.get("banner_color") ?? "#33418F",
    momo_enabled: form.get("momo_enabled") === "on",
    lang: form.get("lang") ?? "fr",
    payment_mode: form.get("payment_mode") ?? "direct",
    momo_operator: form.get("momo_operator") ?? "mtn",
    momo_number: form.get("momo_number") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.redirect(`${base}/app/reglages`, 303);
  }

  // Numéro MoMo de la vendeuse : facultatif, mais s'il est saisi il doit être
  // un numéro camerounais valide — sinon l'acheteuse enverrait l'argent dans
  // le vide. Vide = la boutique n'affiche pas encore de bouton de paiement.
  let momoNumber: string | null = null;
  if (parsed.data.momo_number !== "") {
    const phone = phoneCm.safeParse(parsed.data.momo_number);
    if (!phone.success) {
      return NextResponse.redirect(`${base}/app/reglages?err=momo`, 303);
    }
    momoNumber = phone.data;
  }

  await db
    .updateTable("shops")
    .set({
      city: parsed.data.city,
      banner_color: parsed.data.banner_color,
      momo_enabled: parsed.data.momo_enabled ? 1 : 0,
      payment_mode: parsed.data.payment_mode,
      momo_number: momoNumber,
      momo_operator: parsed.data.momo_operator,
    })
    .where("id", "=", shop.id)
    .execute();
  await db
    .updateTable("sellers")
    .set({ lang: parsed.data.lang })
    .where("id", "=", session.sellerId)
    .execute();

  return NextResponse.redirect(`${base}/app/reglages?ok=1`, 303);
}
