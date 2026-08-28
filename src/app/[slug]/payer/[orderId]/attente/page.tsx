// Page d'attente — polling SANS JavaScript via <meta http-equiv="refresh">.
// En mode mock avec auto-confirmation, le paiement passe en "success" après
// ~6 s pour permettre une démo de bout en bout sans agrégateur réel.
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getPaymentStatus, processPaymentWebhook } from "@/lib/payments";
import { normalizeLang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; orderId: string }> };

export default async function AttentePage(props: Props) {
  const params = await props.params;
  const order = await db
    .selectFrom("orders")
    .innerJoin("shops", "shops.id", "orders.shop_id")
    .innerJoin("sellers", "sellers.id", "shops.seller_id")
    .select(["orders.id", "orders.status", "shops.slug", "sellers.lang"])
    .where("orders.id", "=", params.orderId)
    .where("shops.slug", "=", params.slug)
    .executeTakeFirst();
  if (!order) notFound();
  const fr = normalizeLang(order.lang) === "fr";

  if (order.status === "paid") {
    redirect(`/${order.slug}/confirmation/${order.id}`);
  }

  const payment = await getPaymentStatus(order.id);
  if (!payment) redirect(`/${order.slug}/payer/${order.id}`);

  // Auto-confirmation du MOCK (dev/démo uniquement)
  if (
    payment.status === "pending" &&
    process.env.PAYMENT_PROVIDER === "mock" &&
    process.env.PAYMENT_MOCK_AUTOCONFIRM === "1"
  ) {
    const ageMs = Date.now() - new Date(payment.created_at + "Z").getTime();
    if (ageMs > 6000) {
      await processPaymentWebhook(
        { provider_ref: payment.provider_ref, status: "success" },
        JSON.stringify({ simulated: true, at: new Date().toISOString() })
      );
      redirect(`/${order.slug}/confirmation/${order.id}`);
    }
  }

  if (payment.status === "success") {
    redirect(`/${order.slug}/confirmation/${order.id}`);
  }

  const failed = payment.status === "failed" || payment.status === "expired";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      {!failed ? (
        <>
          {/* polling sans JS : la page se recharge toutes les 3 s */}
          <meta httpEquiv="refresh" content="3" />
          <div className="h-14 w-14 animate-pulse rounded-full bg-mango/40 text-center text-3xl leading-[3.5rem]">
            📲
          </div>
          <h1 className="text-lg font-extrabold">
            {fr ? "Regarde ton téléphone" : "Check your phone"}
          </h1>
          <p className="max-w-[28ch] text-sm text-gray-500">
            {fr
              ? `Compose ton code PIN ${payment.operator === "orange" ? "Orange Money" : "MTN MoMo"} pour valider le paiement.`
              : `Enter your ${payment.operator === "orange" ? "Orange Money" : "MTN MoMo"} PIN to confirm the payment.`}
          </p>
          <p className="text-xs text-gray-400">
            {fr ? "Vérification automatique…" : "Checking automatically…"}
          </p>
        </>
      ) : (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-3xl">
            ✕
          </div>
          <h1 className="text-lg font-extrabold">
            {fr ? "Paiement non abouti" : "Payment failed"}
          </h1>
          <a
            href={`/${order.slug}/payer/${order.id}`}
            className="rounded-2xl bg-mango px-6 py-3.5 text-sm font-extrabold text-[#3A2A00]"
          >
            {fr ? "Réessayer" : "Try again"}
          </a>
        </>
      )}
    </main>
  );
}
