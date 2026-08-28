import { requireShop } from "@/lib/guard";
import { FREE_PRODUCT_LIMIT, PAID_PLAN_PRICE_FCFA, isPaidActive } from "@/lib/plan";
import { fcfa } from "@/lib/format";
import AppShell from "@/components/AppShell";
import Alert from "@/components/Alert";
import { inputCls, labelCls } from "@/components/Onboarding";
import { collecteAbonnement, messagePreviensTara } from "@/lib/abonnement";
import { waLink } from "@/lib/whatsapp";

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
  const collecte = collecteAbonnement();
  const montant = fcfa(PAID_PLAN_PRICE_FCFA);

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

      {collecte.mode === "agregateur" ? (
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
          {paid ? "Prolonger d'un mois" : "Activer l'illimité"} — {montant}
        </button>
      </form>
      ) : collecte.numero ? (
        /* Pas d'agrégateur : elle envoie l'argent au portefeuille de Tara,
           qui active l'abonnement à la main. On le dit, plutôt que d'ouvrir
           un paiement qui n'aboutira jamais. */
        <section className="mt-6">
          <h2 className="label-micro mb-2.5">Comment payer</h2>
          <ol className="card divide-y divide-ink/[0.06] px-4">
            <li className="flex items-start gap-3 py-3.5">
              <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo9 text-[10.5px] font-extrabold text-white">
                1
              </span>
              <span className="min-w-0 text-[13.5px] leading-relaxed">
                Envoie <b>{montant}</b> à ce numéro{" "}
                {collecte.operateur === "orange" ? "Orange Money" : "MTN MoMo"} :
                <span className="mt-1 block select-all font-display text-[19px] tabular-nums tracking-wide text-indigo9">
                  {collecte.numero}
                </span>
              </span>
            </li>
            <li className="flex items-start gap-3 py-3.5">
              <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo9 text-[10.5px] font-extrabold text-white">
                2
              </span>
              <span className="text-[13.5px] leading-relaxed">
                Indique ta boutique en référence :{" "}
                <b className="select-all">{shop.slug}</b>
              </span>
            </li>
            <li className="flex items-start gap-3 py-3.5">
              <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo9 text-[10.5px] font-extrabold text-white">
                3
              </span>
              <span className="text-[13.5px] leading-relaxed">
                Préviens Tara — ton abonnement est activé à la main.
              </span>
            </li>
          </ol>
          {collecte.whatsapp && (
            <a
              href={waLink(collecte.whatsapp, messagePreviensTara(shop.slug, montant))}
              className="btn-wa mt-4"
            >
              💬 Prévenir Tara sur WhatsApp
            </a>
          )}
        </section>
      ) : (
        /* Ni agrégateur, ni portefeuille configuré : on ne fait pas semblant.
           Le pré-vol refuse d'ailleurs cette configuration en production. */
        <Alert tone="attention" className="mt-6">
          Le paiement de l&apos;abonnement n&apos;est pas encore ouvert. Ta boutique
          reste en ligne, et Tara te contactera pour l&apos;activer.
        </Alert>
      )}
    </AppShell>
  );
}
