import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { getShopBySeller } from "@/lib/sellers";

const input = z.object({
  city: z.string().trim().min(2).max(40),
  banner_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  momo_enabled: z.coerce.boolean(),
  lang: z.enum(["fr", "en"]),
});

export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const session = readSession();
  if (!session) return NextResponse.redirect(`${base}/creer`, 303);
  const shop = await getShopBySeller(session.sellerId);
  if (!shop) return NextResponse.redirect(`${base}/creer`, 303);

  const form = await req.formData();
  const parsed = input.safeParse({
    city: form.get("city"),
    banner_color: form.get("banner_color") ?? "#33418F",
    momo_enabled: form.get("momo_enabled") === "on",
    lang: form.get("lang") ?? "fr",
  });
  if (!parsed.success) {
    return NextResponse.redirect(`${base}/app/reglages`, 303);
  }

  await db
    .updateTable("shops")
    .set({
      city: parsed.data.city,
      banner_color: parsed.data.banner_color,
      momo_enabled: parsed.data.momo_enabled ? 1 : 0,
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
