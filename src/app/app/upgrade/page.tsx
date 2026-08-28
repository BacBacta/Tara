import { requireShop } from "@/lib/guard";
import { FREE_PRODUCT_LIMIT, PAID_PLAN_PRICE_FCFA, isPaidActive } from "@/lib/plan";
import { fcfa } from "@/lib/format";
import AppShell from "@/components/AppShell";
import Alert from "@/components/Alert";
import { inputCls, labelCls } from "@/components/Onboarding";

export const dynamic = "force-dynamic";

const AVANTAGES = [
  "Articles illimités",
  "Statistiques détaillées par vidéo",
  "Badge boutique vérifiée (bientôt)",
];

export default async function Upgrade(
  props: {
    searchParams: Promise<{ from?: string; err?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const { shop } = await requireShop();
  const paid = isPaidActive(shop);

  return (
    <AppShell slug={shop.slug} active="/app" title="Tara illimité ✨">
      {searchParams.from === "limit" && (
        <Alert tone="attention" className="mb-4">
          Tu as atteint la limite de {FREE_PRODUCT_LIMIT} articles du palier gratuit.
        </Alert>
      )}
      {searchParams.err && (
        <Alert className="mb-4">Numéro invalide — entre ton numéro MoMo.</Alert>
      )}
      {paid && shop.plan_expires_at && (
        <Alert tone="ok" className="mb-4">
          Abonnement actif jusqu&apos;au{" "}
          {new Date(shop.plan_expires_at).toLocaleDateString("fr-FR")} — payer maintenant
          prolonge d&apos;un mois.
        </Alert>
      )}

      {/* Le seul argent qui entre chez Tara : l'abonnement de la vendeuse (R1). */}
      <section className="grain overflow-hidden rounded-3xl bg-gradient-to-br from-indigo9 via-indigoDeep to-indigoNight px-5 py-6 text-white shadow-float">
        <p className="font-display text-[30px] leading-none tracking-tight">
          {fcfa(PAID_PLAN_PRICE_FCFA)}
          <span className="text-[14px] font-bold text-white/55"> /mois</span>
        </p>
        <ul className="mt-4 flex flex-col gap-2 text-[13.5px]">
          {AVANTAGES.map((a) => (
            <li key={a} className="flex items-start gap-2.5">
              <span
                aria-hidden
                className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-extrabold"
              >
                ✓
              </span>
              {a}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[11.5px] leading-relaxed text-white/55">
          Aucune commission sur tes ventes : tes clientes te paient toujours directement.
        </p>
      </section>

      <form method="post" action="/app/upgrade/init" className="mt-6">
        <p className={labelCls}>Payer avec</p>
        <div className="mt-2 flex gap-2.5">
          <label className="card flex-1 cursor-pointer p-3.5 text-center text-[13.5px] font-extrabold has-[:checked]:border-indigo9 has-[:checked]:bg-indigo9/[0.06]">
            <input type="radio" name="operator" value="mtn" defaultChecked className="sr-only" />
            <span aria-hidden className="mx-auto mb-2 block h-6 w-6 rounded-lg bg-[#FFCC00]" />
            MTN MoMo
          </label>
          <label className="card flex-1 cursor-pointer p-3.5 text-center text-[13.5px] font-extrabold has-[:checked]:border-indigo9 has-[:checked]:bg-indigo9/[0.06]">
            <input type="radio" name="operator" value="orange" className="sr-only" />
            <span aria-hidden className="mx-auto mb-2 block h-6 w-6 rounded-lg bg-[#FF7900]" />
            Orange Money
          </label>
        </div>
        <label className={`${labelCls} mt-5`}>
          Ton numéro MoMo
          <input
            name="phone"
            inputMode="tel"
            placeholder="6 91 88 22 10"
            required
            className={`${inputCls} tabular-nums tracking-wide`}
          />
        </label>
        <button className="btn-mango mt-6">
          {paid ? "Prolonger d'un mois" : "Activer l'illimité"} — {fcfa(PAID_PLAN_PRICE_FCFA)}
        </button>
      </form>
    </AppShell>
  );
}
