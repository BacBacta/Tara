import { requireShop } from "@/lib/guard";
import { isPaidActive } from "@/lib/plan";
import AppShell from "@/components/AppShell";
import Alert from "@/components/Alert";
import { inputCls, labelCls } from "@/components/Onboarding";

export const dynamic = "force-dynamic";

const COLORS = ["#33418F", "#0E7C66", "#B45309", "#7C3AED", "#BE123C"];

/** Choix visuel en carte : le point sélectionné se cerne d'indigo, en CSS seul. */
const CHOIX =
  "card block cursor-pointer p-3.5 has-[:checked]:border-indigo9 has-[:checked]:bg-indigo9/[0.06]";
const PASTILLE =
  "block rounded-2xl border border-ink/10 bg-cream py-2.5 text-center text-[13.5px] font-extrabold peer-checked:border-indigo9 peer-checked:bg-indigo9/[0.06] peer-checked:text-indigo9";

export default async function Reglages(
  props: {
    searchParams: Promise<{ ok?: string; err?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const { shop } = await requireShop();
  const paid = isPaidActive(shop);

  return (
    <AppShell
      slug={shop.slug}
      active="/app/reglages"
      title="Réglages"
      subtitle={`Plan ${paid ? "illimité" : "gratuit"}${
        paid && shop.plan_expires_at
          ? ` — jusqu'au ${new Date(shop.plan_expires_at).toLocaleDateString("fr-FR")}`
          : ""
      }`}
    >
      {searchParams.ok && (
        <Alert tone="ok" className="mb-4">
          ✓ Réglages enregistrés.
        </Alert>
      )}
      {searchParams.err === "momo" && (
        <Alert className="mb-4">
          Numéro Mobile Money invalide — entre un numéro camerounais (ex : 6 77 12 34 56).
        </Alert>
      )}

      <form method="post" action="/app/reglages/save" className="flex flex-col gap-5">
        <label className={labelCls}>
          Ville
          <input
            name="city"
            defaultValue={shop.city}
            required
            minLength={2}
            maxLength={40}
            className={inputCls}
          />
        </label>

        <div>
          <p className={labelCls}>Couleur de la bannière</p>
          <div className="mt-2 flex gap-2.5">
            {COLORS.map((c) => (
              <label key={c} className="cursor-pointer">
                <input
                  type="radio"
                  name="banner_color"
                  value={c}
                  defaultChecked={shop.banner_color === c}
                  className="peer sr-only"
                />
                <span
                  className="block h-10 w-10 rounded-2xl ring-2 ring-transparent ring-offset-2 ring-offset-sand peer-checked:ring-ink"
                  style={{ background: c }}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <p className={labelCls}>Comment tes clientes te paient</p>

          <div className="mt-2.5 flex flex-col gap-2">
            <label className={CHOIX}>
              <input
                type="radio"
                name="payment_mode"
                value="direct"
                defaultChecked={shop.payment_mode !== "agregateur"}
                className="sr-only"
              />
              <span className="block text-[13.5px] font-extrabold">
                Paiement direct — recommandé
              </span>
              <span className="mt-1 block text-[12px] leading-relaxed text-inkSoft">
                La cliente envoie l&apos;argent sur ton téléphone, puis te prévient sur
                WhatsApp. C&apos;est toi qui marques la commande payée. Aucun contrat
                nécessaire.
              </span>
            </label>

            <label className={CHOIX}>
              <input
                type="radio"
                name="payment_mode"
                value="agregateur"
                defaultChecked={shop.payment_mode === "agregateur"}
                className="sr-only"
              />
              <span className="block text-[13.5px] font-extrabold">
                Passerelle Mobile Money
              </span>
              <span className="mt-1 block text-[12px] leading-relaxed text-inkSoft">
                Confirmation automatique du paiement. Nécessite un contrat agrégateur.
              </span>
            </label>
          </div>

          <label className={`${labelCls} mt-5 block`}>
            Ton numéro Mobile Money
            <input
              name="momo_number"
              inputMode="tel"
              autoComplete="tel"
              placeholder="6 77 12 34 56"
              defaultValue={shop.momo_number ?? ""}
              maxLength={20}
              className={`${inputCls} tabular-nums tracking-wide`}
            />
          </label>
          <p className="mt-2 text-[12px] leading-relaxed text-inkSoft">
            C&apos;est le numéro que tes clientes verront pour t&apos;envoyer l&apos;argent.
            Tant qu&apos;il est vide, le bouton de paiement n&apos;apparaît pas sur ta
            boutique.
          </p>

          <p className={`${labelCls} mt-5`}>Ton opérateur</p>
          <div className="mt-2 flex gap-2.5">
            {(
              [
                ["mtn", "MTN MoMo"],
                ["orange", "Orange Money"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex-1 cursor-pointer">
                <input
                  type="radio"
                  name="momo_operator"
                  value={value}
                  defaultChecked={
                    value === "orange"
                      ? shop.momo_operator === "orange"
                      : shop.momo_operator !== "orange"
                  }
                  className="peer sr-only"
                />
                <span className={PASTILLE}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="card flex items-center justify-between px-4 py-3.5 text-[13.5px] font-bold">
          Passerelle MoMo activée
          <input
            type="checkbox"
            name="momo_enabled"
            defaultChecked={shop.momo_enabled === 1}
            className="h-5 w-5 accent-indigo9"
          />
        </label>

        <div>
          <p className={labelCls}>Langue de la boutique</p>
          <div className="mt-2 flex gap-2.5">
            {(["fr", "en"] as const).map((l) => (
              <label key={l} className="flex-1 cursor-pointer">
                <input
                  type="radio"
                  name="lang"
                  value={l}
                  className="peer sr-only"
                  defaultChecked={l === "fr"}
                />
                <span className={PASTILLE}>{l === "fr" ? "Français" : "English"}</span>
              </label>
            ))}
          </div>
        </div>

        <button className="btn-mango mt-1">Enregistrer</button>
      </form>

      <form method="post" action="/app/reglages/logout" className="mt-7">
        <button className="btn border border-ink/10 bg-cream py-3 text-[12.5px] text-inkSoft shadow-insetHair">
          Se déconnecter
        </button>
      </form>
    </AppShell>
  );
}
