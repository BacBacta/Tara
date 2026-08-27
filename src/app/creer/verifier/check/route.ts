import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { phoneCm, verifyOtp } from "@/lib/otp";
import { upsertSellerByPhone, getShopBySeller } from "@/lib/sellers";
import { makeSessionCookie } from "@/lib/session";

const input = z.object({
  phone: phoneCm,
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const form = await req.formData();
  const parsed = input.safeParse({
    phone: form.get("phone"),
    code: form.get("code"),
  });
  if (!parsed.success) {
    return NextResponse.redirect(`${base}/creer`, 303);
  }
  const ok = await verifyOtp(parsed.data.phone, parsed.data.code);
  if (!ok) {
    const p = new URLSearchParams({ p: parsed.data.phone, err: "1" });
    return NextResponse.redirect(`${base}/creer/verifier?${p}`, 303);
  }
  const seller = await upsertSellerByPhone(parsed.data.phone);
  const hasShop = await getShopBySeller(seller.id);
  const res = NextResponse.redirect(
    `${base}${hasShop ? "/app" : "/creer/boutique"}`,
    303
  );
  const cookie = makeSessionCookie(seller.id);
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}
