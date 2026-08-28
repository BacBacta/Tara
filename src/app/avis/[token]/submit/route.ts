import { NextRequest, NextResponse } from "next/server";
import { reviewInput, submitReview } from "@/lib/reviews";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function POST(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  if (!rateLimit(`review:${clientIp(req.headers)}`, 20, 600).allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const form = await req.formData();
  const parsed = reviewInput.safeParse({
    rating: form.get("rating"),
    comment: form.get("comment") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.redirect(`${base}/avis/${params.token}?err=1`, 303);
  }
  const ok = await submitReview(params.token, parsed.data);
  return NextResponse.redirect(`${base}/avis/${params.token}${ok ? "?ok=1" : "?err=1"}`, 303);
}
