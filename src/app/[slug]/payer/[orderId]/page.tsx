import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fcfa } from "@/lib/format";
import { normalizeLang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string; orderId: string }; searchParams: { err?: string } };

export default async function PayerPage({ params, searchParams }: Props) {
  const order = await db
    .selectFrom("orders")
    .innerJoin("shops", "shops.id", "orders.shop_id")
    .innerJoin("sellers", "sellers.id", "shops.seller_id")
    .innerJoin("products", "products.id", "orders.product_id")
    .select([
      "orders.id", "orders.amount_fcfa", "orders.variant", "orders.qty",
      "orders.status", "shops.slug", "shops.momo_enabled",
      "products.name as product_name", "sellers.lang",
    ])
    .where("orders.id", "=", params.orderId)
    .where("shops.slug", "=", params.slug)
    .executeTakeFirst();

  if (!order || order.momo_enabled !== 1) notFound();
  if (!["initiated", "pending_payment"].includes(order.status)) notFound();
  const lang = normalizeLang(order.lang);
  const fr = lang === "fr";

  return (
    <main className="mx-auto max-w-md px-4 pb-10">
      <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-gray-200 bg-sand px-4 py-3">
        <b className="text-sm">{fr ? "Paiement Mobile Money" : "Mobile Money payment"}</b>
      </div>

      <div className="mb-4 flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm">
        <span>
          {order.product_name}
          {order.variant ? ` (${order.variant})` : ""} × {order.qty}
        </span>
        <b>{fcfa(order.amount_fcfa)}</b>
      </div>

      {searchParams.err && (
        <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
          {fr
            ? "Numéro invalide — entre ton numéro MoMo (ex : 6 77 12 34 56)."
            : "Invalid number — enter your MoMo number (e.g. 6 77 12 34 56)."}
        </p>
      )}

      <form method="post" action={`/${order.slug}/payer/${order.id}/init`}>
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
          {fr ? "Choisis ton opérateur" : "Choose your operator"}
        </p>
        <div className="mt-2 flex gap-2.5">
          <label className="flex-1 cursor-pointer rounded-2xl border-2 border-gray-200 bg-white p-3 text-center text-sm font-extrabold has-[:checked]:border-indigo9 has-[:checked]:bg-indigo-50">
            <input type="radio" name="operator" value="mtn" defaultChecked className="sr-only" />
            <span className="mx-auto mb-1.5 block h-6 w-6 rounded-lg bg-[#FFCC00]" />
            MTN MoMo
          </label>
          <label className="flex-1 cursor-pointer rounded-2xl border-2 border-gray-200 bg-white p-3 text-center text-sm font-extrabold has-[:checked]:border-indigo9 has-[:checked]:bg-indigo-50">
            <input type="radio" name="operator" value="orange" className="sr-only" />
            <span className="mx-auto mb-1.5 block h-6 w-6 rounded-lg bg-[#FF7900]" />
            Orange Money
          </label>
        </div>

        <label className="mt-4 block text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
          {fr ? "Ton numéro" : "Your number"}
          <input
            name="phone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="6 77 12 34 56"
            required
            className="mt-1.5 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-base font-bold tracking-wide focus:border-indigo9 focus:outline-none"
          />
        </label>

        <button
          type="submit"
          className="mt-5 w-full rounded-2xl bg-mango px-5 py-4 text-sm font-extrabold text-[#3A2A00]"
        >
          {fr ? `Confirmer — ${fcfa(order.amount_fcfa)}` : `Confirm — ${fcfa(order.amount_fcfa)}`}
        </button>
        <p className="mt-3 text-center text-[11px] text-gray-500">
          {fr
            ? "Tu recevras une demande de code PIN sur ton téléphone."
            : "You will receive a PIN request on your phone."}
        </p>
      </form>
    </main>
  );
}
