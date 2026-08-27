import { requireShop } from "@/lib/guard";
import { FREE_PRODUCT_LIMIT, PAID_PLAN_PRICE_FCFA, isPaidActive } from "@/lib/plan";
import { fcfa } from "@/lib/format";
import AppNav from "@/components/AppNav";

export const dynamic = "force-dynamic";

export default async function Upgrade({
  searchParams,
}: {
  searchParams: { from?: string; err?: string };
}) {
  const { shop } = await requireShop();
  const paid = isPaidActive(shop);

  return (
    <main className="mx-auto max-w-md px-5 pb-24 pt-8">
      <h1 className="text-xl font-extrabold">Tara illimité ✨</h1>
      {searchParams.from === "limit" && (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
          Tu as atteint la limite de {FREE_PRODUCT_LIMIT} articles du palier gratuit.
        </p>
      )}
      {searchParams.err && (
        <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
          Numéro invalide — entre ton numéro MoMo.
        </p>
      )}
      {paid && shop.plan_expires_at && (
        <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-okgreen">
          Abonnement actif jusqu&apos;au{" "}
          {new Date(shop.plan_expires_at).toLocaleDateString("fr-FR")} — payer maintenant
          prolonge d&apos;un mois.
        </p>
      )}

      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 text-sm">
        <p className="text-2xl font-extrabold text-indigo9">
          {fcfa(PAID_PLAN_PRICE_FCFA)}<span className="text-sm font-bold text-gray-400">/mois</span>
        </p>
        <ul className="mt-2 space-y-1 text-xs text-gray-600">
          <li>✓ Articles illimités</li>
          <li>✓ Statistiques détaillées par vidéo</li>
          <li>✓ Badge boutique vérifiée (bientôt)</li>
        </ul>
      </div>

      <form method="post" action="/app/upgrade/init" className="mt-5">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
          Payer avec
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
          Ton numéro MoMo
          <input
            name="phone"
            inputMode="tel"
            placeholder="6 91 88 22 10"
            required
            className="mt-1.5 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-base font-bold focus:border-indigo9 focus:outline-none"
          />
        </label>
        <button className="mt-5 w-full rounded-2xl bg-mango px-5 py-4 text-sm font-extrabold text-[#3A2A00]">
          {paid ? "Prolonger d'un mois" : "Activer l'illimité"} — {fcfa(PAID_PLAN_PRICE_FCFA)}
        </button>
      </form>

      <AppNav active="/app" />
    </main>
  );
}
