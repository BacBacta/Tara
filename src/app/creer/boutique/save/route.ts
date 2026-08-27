import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, newId } from "@/lib/db";
import { readSession } from "@/lib/session";
import { getShopBySeller, uniqueSlug } from "@/lib/sellers";

const input = z.object({
  name: z.string().trim().min(3).max(60),
  city: z.string().trim().min(2).max(40),
});

export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const session = readSession();
  if (!session) return NextResponse.redirect(`${base}/creer`, 303);
  if (await getShopBySeller(session.sellerId)) {
    return NextResponse.redirect(`${base}/creer/article`, 303);
  }

  const form = await req.formData();
  const parsed = input.safeParse({ name: form.get("name"), city: form.get("city") });
  if (!parsed.success) {
    return NextResponse.redirect(`${base}/creer/boutique?err=1`, 303);
  }

  const slug = await uniqueSlug(parsed.data.name);
  await db
    .insertInto("shops")
    .values({
      id: newId(),
      seller_id: session.sellerId,
      slug,
      name: parsed.data.name,
      city: parsed.data.city,
      plan_expires_at: null,
    })
    .execute();
  await db
    .updateTable("sellers")
    .set({ name: parsed.data.name })
    .where("id", "=", session.sellerId)
    .where("name", "=", "")
    .execute();

  return NextResponse.redirect(`${base}/creer/article`, 303);
}
