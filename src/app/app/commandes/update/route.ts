import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { getShopBySeller } from "@/lib/sellers";
import { ORDER_STATUSES, canTransition, type OrderStatus } from "@/lib/orders";
import { openReview } from "@/lib/reviews";

const input = z.object({
  order: z.string().regex(/^B-\d{4,6}$/),
  to: z.enum(ORDER_STATUSES),
});

export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const session = await readSession();
  if (!session) return NextResponse.redirect(`${base}/creer`, 303);
  const shop = await getShopBySeller(session.sellerId);
  if (!shop) return NextResponse.redirect(`${base}/creer`, 303);

  const form = await req.formData();
  const parsed = input.safeParse({ order: form.get("order"), to: form.get("to") });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const order = await db
    .selectFrom("orders")
    .select(["id", "status"])
    .where("id", "=", parsed.data.order)
    .where("shop_id", "=", shop.id) // une vendeuse ne touche que SES commandes
    .executeTakeFirst();
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!canTransition(order.status as OrderStatus, parsed.data.to)) {
    return NextResponse.json({ error: "invalid_transition" }, { status: 409 });
  }

  await db
    .updateTable("orders")
    .set({ status: parsed.data.to })
    .where("id", "=", order.id)
    .execute();

  // V2 : une commande livrée ouvre un droit d'avis (lien à usage unique)
  if (parsed.data.to === "delivered") {
    await openReview(order.id);
  }

  return NextResponse.redirect(`${base}/app/commandes`, 303);
}
