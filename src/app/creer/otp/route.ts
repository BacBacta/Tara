import { NextRequest, NextResponse } from "next/server";
import { phoneCm, requestOtp } from "@/lib/otp";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const ip = clientIp(req.headers);
  if (!rateLimit(`otp:${ip}`, 5, 900).allowed) {
    return NextResponse.redirect(`${base}/creer?err=rate`, 303);
  }

  const form = await req.formData();
  const parsed = phoneCm.safeParse(form.get("phone"));
  if (!parsed.success) {
    return NextResponse.redirect(`${base}/creer?err=phone`, 303);
  }
  const result = await requestOtp(parsed.data);
  if (!result.ok) {
    return NextResponse.redirect(`${base}/creer?err=rate`, 303);
  }
  const p = new URLSearchParams({ p: parsed.data });
  // En mode mock uniquement : le code de test est passé à l'écran de saisie.
  if (result.devCode) p.set("d", result.devCode);
  return NextResponse.redirect(`${base}/creer/verifier?${p}`, 303);
}
