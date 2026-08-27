import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { getShopBySeller } from "@/lib/sellers";

const input = z.object({
  product: z.string().min(6).max(64),
  op: z.enum(["out", "restock", "remove"]),
});

export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const session = readSession();
  if (!session) return NextResponse.redirect(`${base}/creer`, 303);
  const shop = await getShopBySeller(session.sellerId);
  if (!shop) return NextResponse.redirect(`${base}/creer`, 303);

  const form = await req.formData();
  const parsed = input.safeParse({ product: form.get("product"), op: form.get("op") });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const patch =
    parsed.data.op === "remove"
      ? { removed: 1 }
      : { stock_state: parsed.data.op === "out" ? "out" : "in_stock" };

  await db
    .updateTable("products")
    .set(patch)
    .where("id", "=", parsed.data.product)
    .where("shop_id", "=", shop.id)
    .execute();
  return NextResponse.redirect(`${base}/app/articles`, 303);
}
