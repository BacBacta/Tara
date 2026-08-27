import { redirect } from "next/navigation";
import { requireShop } from "@/lib/guard";
import { latestPendingSubPayment, processSubscriptionWebhook } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

export default async function AttenteAbo() {
  const { shop } = await requireShop();
  const pay = await latestPendingSubPayment(shop.id);
  if (!pay) redirect("/app/upgrade");

  if (pay.status === "success") redirect("/app?ok=sub");

  // auto-confirmation du mock (démo/dev)
  if (
    pay.status === "pending" &&
    process.env.PAYMENT_PROVIDER === "mock" &&
    process.env.PAYMENT_MOCK_AUTOCONFIRM === "1"
  ) {
    const ageMs = Date.now() - new Date(pay.created_at + "Z").getTime();
    if (ageMs > 6000) {
      await processSubscriptionWebhook(
        { provider_ref: pay.provider_ref, status: "success" },
        JSON.stringify({ simulated: true })
      );
      redirect("/app?ok=sub");
    }
  }

  const failed = pay.status === "failed" || pay.status === "expired";
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      {!failed ? (
        <>
          <meta httpEquiv="refresh" content="3" />
          <div className="h-14 w-14 animate-pulse rounded-full bg-mango/40 text-center text-3xl leading-[3.5rem]">📲</div>
          <h1 className="text-lg font-extrabold">Regarde ton téléphone</h1>
          <p className="max-w-[28ch] text-sm text-gray-500">
            Compose ton code PIN {pay.operator === "orange" ? "Orange Money" : "MTN MoMo"} pour
            activer ton abonnement.
          </p>
          <p className="text-xs text-gray-400">Vérification automatique…</p>
        </>
      ) : (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-3xl">✕</div>
          <h1 className="text-lg font-extrabold">Paiement non abouti</h1>
          <a href="/app/upgrade" className="rounded-2xl bg-mango px-6 py-3.5 text-sm font-extrabold text-[#3A2A00]">
            Réessayer
          </a>
        </>
      )}
    </main>
  );
}
