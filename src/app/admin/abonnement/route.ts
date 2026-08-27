// POST /admin/abonnement — activation manuelle d'un abonnement.
// MIKE encaisse les 3 000 F sur son MoMo personnel, saisit ici la référence
// de la transaction reçue, et la boutique passe au plan payant.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readAdmin } from "@/lib/admin";
import { grantSubscription } from "@/lib/subscriptions";

const input = z.object({
  shop: z.string().min(6).max(64),
  months: z.coerce.number().int().min(1).max(24),
  origin: z.enum(["manual", "offered"]),
  payment_ref: z.string().trim().max(80),
  note: z.string().trim().max(200),
});

export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const admin = readAdmin();
  if (!admin) return NextResponse.redirect(`${base}/admin/login`, 303);

  const form = await req.formData();
  const parsed = input.safeParse({
    shop: form.get("shop"),
    months: form.get("months") ?? 1,
    origin: form.get("origin") ?? "manual",
    payment_ref: form.get("payment_ref") ?? "",
    note: form.get("note") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.redirect(`${base}/admin?err=input#abonnements`, 303);
  }

  const res = await grantSubscription({
    shopId: parsed.data.shop,
    months: parsed.data.months,
    origin: parsed.data.origin,
    paymentRef: parsed.data.payment_ref,
    note: parsed.data.note,
    actor: admin.email,
  });

  if (!res.applied) {
    return NextResponse.redirect(`${base}/admin?err=${res.reason}#abonnements`, 303);
  }
  return NextResponse.redirect(`${base}/admin?ok=1#abonnements`, 303);
}
