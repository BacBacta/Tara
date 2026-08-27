// Opt-in public : une cliente s'abonne aux nouveautés d'une boutique.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { phoneCm } from "@/lib/payments";
import { follow } from "@/lib/followers";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  if (!rateLimit(`follow:${clientIp(req.headers)}`, 10, 600).allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const shop = await db
    .selectFrom("shops").select(["id", "slug"])
    .where("slug", "=", params.slug).where("suspended", "=", 0)
    .executeTakeFirst();
  if (!shop) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const form = await req.formData();
  const parsed = phoneCm.safeParse(form.get("phone"));
  if (!parsed.success) {
    return NextResponse.redirect(`${base}/${shop.slug}?follow=err`, 303);
  }
  await follow(shop.id, parsed.data);
  return NextResponse.redirect(`${base}/${shop.slug}?follow=ok`, 303);
}
