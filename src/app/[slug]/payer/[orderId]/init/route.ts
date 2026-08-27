// POST — initie le paiement puis redirige vers la page d'attente.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { initiatePayment, phoneCm, OPERATORS } from "@/lib/payments";

const input = z.object({
  operator: z.enum(OPERATORS),
  phone: phoneCm,
});

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; orderId: string } }
) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const form = await req.formData();
  const parsed = input.safeParse({
    operator: form.get("operator"),
    phone: form.get("phone"),
  });
  if (!parsed.success) {
    return NextResponse.redirect(
      `${base}/${params.slug}/payer/${params.orderId}?err=1`,
      303
    );
  }
  const result = await initiatePayment(
    params.orderId,
    parsed.data.operator,
    parsed.data.phone
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.redirect(
    `${base}/${params.slug}/payer/${params.orderId}/attente`,
    303
  );
}
