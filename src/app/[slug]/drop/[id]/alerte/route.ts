import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { phoneCm } from "@/lib/payments";
import { addAlert } from "@/lib/drops";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  if (!rateLimit(`alert:${clientIp(req.headers)}`, 10, 600).allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const drop = await db
    .selectFrom("drops")
    .innerJoin("shops", "shops.id", "drops.shop_id")
    .select(["drops.id"])
    .where("drops.id", "=", params.id)
    .where("shops.slug", "=", params.slug)
    .executeTakeFirst();
  if (!drop) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const form = await req.formData();
  const parsed = phoneCm.safeParse(form.get("phone"));
  if (!parsed.success) {
    return NextResponse.redirect(`${base}/${params.slug}/drop/${params.id}`, 303);
  }
  await addAlert(drop.id, parsed.data);
  return NextResponse.redirect(`${base}/${params.slug}/drop/${params.id}?alert=ok`, 303);
}
