// POST /{slug}/commander — crée la commande puis redirige vers WhatsApp.
// Formulaire HTML natif : fonctionne sans JavaScript (WebViews 3G).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createOrder, createOrderInput } from "@/lib/orders";
import { waLink, orderMessage } from "@/lib/whatsapp";
import { fcfa } from "@/lib/format";
import { normalizeLang } from "@/lib/i18n";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  if (!rateLimit(`order:${clientIp(req.headers)}`, 30, 600).allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const shop = await db
    .selectFrom("shops")
    .innerJoin("sellers", "sellers.id", "shops.seller_id")
    .select([
      "shops.id", "shops.slug", "shops.suspended",
      "sellers.phone as seller_phone", "sellers.lang as seller_lang",
    ])
    .where("shops.slug", "=", params.slug)
    .executeTakeFirst();
  if (!shop || shop.suspended === 1) {
    return NextResponse.json({ error: "shop_not_found" }, { status: 404 });
  }

  const form = await req.formData();
  const parsed = createOrderInput.safeParse({
    productId: form.get("product"),
    variant: form.get("variant") || undefined,
    qty: form.get("qty") || 1,
    source: form.get("source") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const order = await createOrder(shop.id, parsed.data);
  if (!order) {
    return NextResponse.json({ error: "product_unavailable" }, { status: 409 });
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  // action=pay → parcours paiement MoMo au lieu de WhatsApp
  if (form.get("action") === "pay") {
    return NextResponse.redirect(
      `${base}/${shop.slug}/payer/${order.id}`,
      303
    );
  }
  const lang = normalizeLang(shop.seller_lang);
  const href = waLink(
    shop.seller_phone,
    orderMessage({
      productName: order.productName,
      variant: parsed.data.variant ?? null,
      qty: parsed.data.qty,
      priceLabel: fcfa(order.amountFcfa),
      productUrl: `${base}/${shop.slug}/p/${parsed.data.productId}`,
      orderId: order.id,
      lang,
    })
  );
  return NextResponse.redirect(href, 303);
}
