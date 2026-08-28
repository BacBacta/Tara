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
          <div className="h-16 w-16 animate-pulse rounded-full bg-mango/40 text-center text-3xl leading-[4rem]">📲</div>
          <h1 className="font-display text-[23px] tracking-tight">Regarde ton téléphone</h1>
          <p className="max-w-[28ch] text-[14px] leading-relaxed text-inkSoft">
            Compose ton code PIN {pay.operator === "orange" ? "Orange Money" : "MTN MoMo"} pour
            activer ton abonnement.
          </p>
          <p className="text-[11.5px] text-inkSoft">Vérification automatique…</p>
        </>
      ) : (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-3xl">✕</div>
          <h1 className="font-display text-[23px] tracking-tight">Paiement non abouti</h1>
          <a href="/app/upgrade" className="btn-mango w-auto px-8">
            Réessayer
          </a>
        </>
      )}
    </main>
  );
}
