import { requireShop } from "@/lib/guard";
import { isPaidActive } from "@/lib/plan";
import AppNav from "@/components/AppNav";
import { inputCls, labelCls } from "@/components/Onboarding";

export const dynamic = "force-dynamic";

const COLORS = ["#33418F", "#0E7C66", "#B45309", "#7C3AED", "#BE123C"];

export default async function Reglages({ searchParams }: { searchParams: { ok?: string } }) {
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

        <label className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold">
          Accepter le paiement MoMo
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
