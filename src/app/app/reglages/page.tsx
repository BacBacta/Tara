import { requireShop } from "@/lib/guard";
import { isPaidActive } from "@/lib/plan";
import AppNav from "@/components/AppNav";
import { inputCls, labelCls } from "@/components/Onboarding";

export const dynamic = "force-dynamic";

const COLORS = ["#33418F", "#0E7C66", "#B45309", "#7C3AED", "#BE123C"];

export default async function Reglages({
  searchParams,
}: {
  searchParams: { ok?: string; err?: string };
}) {
  const { shop } = await requireShop();
  const paid = isPaidActive(shop);

  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-6">
      <h1 className="text-lg font-extrabold">Réglages</h1>
      {searchParams.ok && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-okgreen">
          ✓ Réglages enregistrés.
        </p>
      )}
      {searchParams.err === "momo" && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
          Numéro Mobile Money invalide — entre un numéro camerounais
          (ex : 6 77 12 34 56).
        </p>
      )}
      <p className="mt-2 text-xs text-gray-500">
        Plan : <b>{paid ? "Illimité" : "Gratuit"}</b>
        {paid && shop.plan_expires_at
          ? ` — jusqu'au ${new Date(shop.plan_expires_at).toLocaleDateString("fr-FR")}`
          : ""}
      </p>

      <form method="post" action="/app/reglages/save" className="mt-4 flex flex-col gap-4">
        <label className={labelCls}>
          Ville
          <input name="city" defaultValue={shop.city} required minLength={2} maxLength={40} className={inputCls} />
        </label>

        <div>
          <p className={labelCls}>Couleur de la bannière</p>
          <div className="mt-1.5 flex gap-2">
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
                  className="block h-9 w-9 rounded-xl border-2 border-transparent peer-checked:border-ink"
                  style={{ background: c }}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className={labelCls}>Comment tes clientes te paient</p>

          <div className="mt-2 flex flex-col gap-2">
            <label className="cursor-pointer rounded-xl border-2 border-gray-200 p-3 has-[:checked]:border-indigo9 has-[:checked]:bg-indigo-50">
              <input
                type="radio"
                name="payment_mode"
                value="direct"
                defaultChecked={shop.payment_mode !== "agregateur"}
                className="sr-only"
              />
              <span className="block text-sm font-extrabold">
                Paiement direct — recommandé
              </span>
              <span className="mt-0.5 block text-[11px] text-gray-500">
                La cliente envoie l&apos;argent sur ton téléphone, puis te
                prévient sur WhatsApp. C&apos;est toi qui marques la commande
                payée. Aucun contrat nécessaire.
              </span>
            </label>

            <label className="cursor-pointer rounded-xl border-2 border-gray-200 p-3 has-[:checked]:border-indigo9 has-[:checked]:bg-indigo-50">
              <input
                type="radio"
                name="payment_mode"
                value="agregateur"
                defaultChecked={shop.payment_mode === "agregateur"}
                className="sr-only"
              />
              <span className="block text-sm font-extrabold">
                Passerelle Mobile Money
              </span>
              <span className="mt-0.5 block text-[11px] text-gray-500">
                Confirmation automatique du paiement. Nécessite un contrat
                agrégateur.
              </span>
            </label>
          </div>

          <label className={`${labelCls} mt-4 block`}>
            Ton numéro Mobile Money
            <input
              name="momo_number"
              inputMode="tel"
              autoComplete="tel"
              placeholder="6 77 12 34 56"
              defaultValue={shop.momo_number ?? ""}
              maxLength={20}
              className={inputCls}
            />
          </label>
          <p className="mt-1 text-[11px] text-gray-500">
            C&apos;est le numéro que tes clientes verront pour t&apos;envoyer
            l&apos;argent. Tant qu&apos;il est vide, le bouton de paiement
            n&apos;apparaît pas sur ta boutique.
          </p>

          <p className={`${labelCls} mt-3`}>Ton opérateur</p>
          <div className="mt-1.5 flex gap-2">
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
                <span className="block rounded-xl border-2 border-gray-200 bg-white py-2.5 text-center text-sm font-extrabold peer-checked:border-indigo9 peer-checked:bg-indigo-50 peer-checked:text-indigo9">
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold">
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
          <div className="mt-1.5 flex gap-2">
            {(["fr", "en"] as const).map((l) => (
              <label key={l} className="flex-1 cursor-pointer">
                <input type="radio" name="lang" value={l} className="peer sr-only" defaultChecked={l === "fr"} />
                <span className="block rounded-xl border-2 border-gray-200 bg-white py-2.5 text-center text-sm font-extrabold peer-checked:border-indigo9 peer-checked:bg-indigo-50 peer-checked:text-indigo9">
                  {l === "fr" ? "Français" : "English"}
                </span>
              </label>
            ))}
          </div>
        </div>

        <button className="rounded-2xl bg-mango px-5 py-3.5 text-sm font-extrabold text-[#3A2A00]">
          Enregistrer
        </button>
      </form>

      <form method="post" action="/app/reglages/logout" className="mt-6">
        <button className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-3 text-xs font-bold text-gray-500">
          Se déconnecter
        </button>
      </form>

      <AppNav active="/app/reglages" />
    </main>
  );
}
