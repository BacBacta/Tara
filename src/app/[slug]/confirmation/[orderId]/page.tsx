import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { fcfa } from "@/lib/format";
import { normalizeLang, t } from "@/lib/i18n";
import TikTokPixel from "@/components/TikTokPixel";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string; orderId: string } };

export default async function ConfirmationPage({ params }: Props) {
  const order = await db
    .selectFrom("orders")
    .innerJoin("shops", "shops.id", "orders.shop_id")
    .innerJoin("sellers", "sellers.id", "shops.seller_id")
    .innerJoin("products", "products.id", "orders.product_id")
    .select([
      "orders.id", "orders.status", "orders.amount_fcfa",
      "shops.slug", "shops.name as shop_name",
      "products.name as product_name", "sellers.lang",
    ])
    .where("orders.id", "=", params.orderId)
    .where("shops.slug", "=", params.slug)
    .executeTakeFirst();
  // "paid" : la vendeuse (ou l'agrégateur) a confirmé l'encaissement.
  // "payment_announced" : l'acheteuse a déclaré son envoi en mode direct —
  // ce n'est PAS une confirmation, et le libellé le dit (R1).
  if (!order || !["paid", "payment_announced"].includes(order.status)) notFound();
  const lang = normalizeLang(order.lang);
  const fr = lang === "fr";
  const announced = order.status === "payment_announced";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      {/* L'achat n'est compté que lorsqu'il est réellement confirmé. */}
      {!announced && <TikTokPixel event="Purchase" value={order.amount_fcfa} />}
      <div
        className={`flex h-20 w-20 items-center justify-center rounded-full text-4xl ${
          announced ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-okgreen"
        }`}
      >
        {announced ? "⏳" : "✓"}
      </div>
      <h1 className="text-xl font-extrabold">
        {announced
          ? t(lang, "pay.announced")
          : fr
            ? "Commande confirmée !"
            : "Order confirmed!"}
      </h1>
      <p className="max-w-[30ch] text-sm text-gray-500">
        {announced ? (
          t(lang, "pay.announcedHelp")
        ) : fr ? (
          <>
            {order.shop_name} a reçu ta commande <b>{order.id}</b> (
            {order.product_name}, {fcfa(order.amount_fcfa)}). Le reçu et le
            suivi arrivent sur ton WhatsApp.
          </>
        ) : (
          <>
            {order.shop_name} received your order <b>{order.id}</b> (
            {order.product_name}, {fcfa(order.amount_fcfa)}). Receipt and
            tracking will arrive on WhatsApp.
          </>
        )}
      </p>
      <Link
        href={`/${order.slug}`}
        className="mt-2 rounded-2xl bg-wagreen px-6 py-3.5 text-sm font-extrabold text-[#053B1D]"
      >
        {fr ? "Retour à la boutique" : "Back to the shop"}
      </Link>
    </main>
  );
}
