import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { getShopBySeller } from "@/lib/sellers";

const input = z.object({
  review: z.string().min(6).max(64),
  op: z.enum(["reply", "hide", "publish"]),
  reply: z.string().trim().max(300).optional(),
});

export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const session = await readSession();
  if (!session) return NextResponse.redirect(`${base}/creer`, 303);
  const shop = await getShopBySeller(session.sellerId);
  if (!shop) return NextResponse.redirect(`${base}/creer`, 303);

  const form = await req.formData();
  const parsed = input.safeParse({
    review: form.get("review"),
    op: form.get("op"),
    reply: form.get("reply") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const patch =
    parsed.data.op === "reply"
      ? { reply: parsed.data.reply ?? null }
      : { status: parsed.data.op === "hide" ? "hidden" : "published" };

  await db
    .updateTable("reviews")
    .set(patch)
    .where("id", "=", parsed.data.review)
    .where("shop_id", "=", shop.id) // une vendeuse ne touche que ses avis
    .execute();
  return NextResponse.redirect(`${base}/app/avis?ok=1`, 303);
}
