// POST /{slug}/payer/{orderId}/annonce — mode direct : l'acheteuse déclare
// avoir envoyé l'argent, puis part prévenir la vendeuse sur WhatsApp.
// Formulaire HTML natif : fonctionne sans JavaScript (WebViews 3G).
//
// R1 : cette route n'encaisse rien et ne confirme rien. Elle enregistre une
// DÉCLARATION de l'acheteuse. Seule la vendeuse marque la commande payée.
//
// SÉCURITÉ — non authentifiée, et c'est assumé. Les identifiants B-XXXX sont
// devinables : on peut donc forger l'annonce d'une commande tierce. Accepté
// après relecture de sécurité (28/08/2026) : aucune donnée personnelle n'est
// exposée, l'annonce ne peut jamais atteindre « paid », et elle ne prouve
// rien même pour l'acheteuse légitime — la vendeuse vérifie son portefeuille
// MoMo dans tous les cas. Raisonnement complet et conditions de réouverture :
// ROADMAP-PROD.md, question ouverte n°10.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { announceDirectPayment, normalizePaymentMode, operatorLabel } from "@/lib/payments";
import { directPaymentMessage, waLink } from "@/lib/whatsapp";
import { fcfa } from "@/lib/format";
import { normalizeLang } from "@/lib/i18n";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ slug: string; orderId: string }> }
) {
  const params = await props.params;
  if (!rateLimit(`announce:${clientIp(req.headers)}`, 30, 600).allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const order = await db
    .selectFrom("orders")
    .innerJoin("shops", "shops.id", "orders.shop_id")
    .innerJoin("sellers", "sellers.id", "shops.seller_id")
    .innerJoin("products", "products.id", "orders.product_id")
    .select([
      "orders.id", "orders.amount_fcfa", "orders.variant", "orders.qty",
      "shops.id as shop_id", "shops.slug", "shops.payment_mode",
      "shops.momo_number", "shops.momo_operator",
      "sellers.phone as seller_phone", "sellers.lang as seller_lang",
      "products.name as product_name",
    ])
    .where("orders.id", "=", params.orderId)
    .where("shops.slug", "=", params.slug)
    .executeTakeFirst();

  if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  if (normalizePaymentMode(order.payment_mode) !== "direct" || !order.momo_number) {
    return NextResponse.json({ error: "not_direct_mode" }, { status: 409 });
  }

  const result = await announceDirectPayment(order.id, order.shop_id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  const href = waLink(
    order.seller_phone,
    directPaymentMessage({
      productName: order.product_name,
      variant: order.variant,
      qty: order.qty,
      priceLabel: fcfa(order.amount_fcfa),
      orderId: order.id,
      momoNumber: order.momo_number,
      operatorLabel: operatorLabel(order.momo_operator),
      lang: normalizeLang(order.seller_lang),
    })
  );
  return NextResponse.redirect(href, 303);
}
