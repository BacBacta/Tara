import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getShopBySeller } from "@/lib/sellers";
import { announcementInput, sendAnnouncement } from "@/lib/followers";

export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const session = readSession();
  if (!session) return NextResponse.redirect(`${base}/creer`, 303);
  const shop = await getShopBySeller(session.sellerId);
  if (!shop) return NextResponse.redirect(`${base}/creer`, 303);

  const form = await req.formData();
  const parsed = announcementInput.safeParse({ body: form.get("body") });
  if (!parsed.success) return NextResponse.redirect(`${base}/app/annonces`, 303);

  const r = await sendAnnouncement(shop.id, parsed.data.body);
  if ("error" in r) {
    const code = r.error === "quota_reached" ? "quota" : "empty";
    return NextResponse.redirect(`${base}/app/annonces?err=${code}`, 303);
  }
  return NextResponse.redirect(`${base}/app/annonces?ok=1`, 303);
}
