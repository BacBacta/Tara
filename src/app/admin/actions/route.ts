import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, readAdmin } from "@/lib/admin";

const input = z.object({
  shop: z.string().min(6).max(64).optional(),
  product: z.string().min(6).max(64).optional(),
  review: z.string().min(6).max(64).optional(),
  op: z.enum([
    "suspend", "unsuspend", "remove_product",
    "hide_review", "publish_review", // V2 — modération des avis
  ]),
});

export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const admin = readAdmin();
  if (!admin) return NextResponse.redirect(`${base}/admin/login`, 303);

  const form = await req.formData();
  const parsed = input.safeParse({
    shop: form.get("shop") ?? undefined,
    product: form.get("product") ?? undefined,
    review: form.get("review") ?? undefined,
    op: form.get("op"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const { shop, product, review, op } = parsed.data;

  if (op === "hide_review" || op === "publish_review") {
    if (!review) return NextResponse.json({ error: "missing_review" }, { status: 400 });
    await db
      .updateTable("reviews")
      .set({ status: op === "hide_review" ? "hidden" : "published" })
      .where("id", "=", review)
      .execute();
    await audit(admin.email, op, review);
    return NextResponse.redirect(`${base}/admin?ok=1`, 303);
  }

  if (op === "remove_product") {
    if (!product) return NextResponse.json({ error: "missing_product" }, { status: 400 });
    await db.updateTable("products").set({ removed: 1 }).where("id", "=", product).execute();
    await audit(admin.email, "remove_product", product);
  } else {
    if (!shop) return NextResponse.json({ error: "missing_shop" }, { status: 400 });
    await db
      .updateTable("shops")
      .set({ suspended: op === "suspend" ? 1 : 0 })
      .where("id", "=", shop)
      .execute();
    await audit(admin.email, op, shop);
  }
  return NextResponse.redirect(`${base}/admin?ok=1`, 303);
}
