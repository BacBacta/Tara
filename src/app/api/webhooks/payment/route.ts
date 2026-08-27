// Webhook de l'agrégateur de paiement. Idempotent (voir lib/payments).
// Authentification : en-tête x-webhook-secret (le vrai agrégateur signera
// différemment — l'adaptation se fera dans le provider concerné).
import { NextRequest, NextResponse } from "next/server";
import { processPaymentWebhook, webhookInput } from "@/lib/payments";
import { processSubscriptionWebhook } from "@/lib/subscriptions";

export async function POST(req: NextRequest) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-webhook-secret") !== secret) {
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
  const parsed = webhookInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  // Références "sub_…" → abonnements ; sinon → paiements de commandes.
  const result = parsed.data.provider_ref.startsWith("sub_")
    ? await processSubscriptionWebhook(parsed.data, raw)
    : await processPaymentWebhook(parsed.data, raw);
  // Toujours 200 pour un doublon : l'agrégateur ne doit pas réessayer.
  return NextResponse.json({ ok: true, applied: result.applied });
}
