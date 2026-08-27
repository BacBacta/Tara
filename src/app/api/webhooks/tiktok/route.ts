// Webhook TikTok. Réponse 200 immédiate (TikTok rejoue 72 h en cas d'échec).
import { NextRequest, NextResponse } from "next/server";
import { tiktokWebhookInput } from "@/lib/tiktok";
import { processTikTokWebhook } from "@/lib/webhooks-tiktok";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  if (!rateLimit(`tkwh:${clientIp(req.headers)}`, 120, 60).allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const secret = process.env.TIKTOK_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-tiktok-signature") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let raw: string;
  let body: unknown;
  try {
    raw = await req.text();
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = tiktokWebhookInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const r = await processTikTokWebhook(parsed.data, raw);
  return NextResponse.json({ ok: true, applied: r.applied, action: r.action ?? null });
}
