import { requireShop } from "@/lib/guard";
import { db } from "@/lib/db";
import {
  activeFollowers, announcementsThisMonth, MAX_ANNOUNCEMENTS_PER_MONTH,
} from "@/lib/followers";
import AppNav from "@/components/AppNav";

export const dynamic = "force-dynamic";

export default async function Annonces(props: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const searchParams = await props.searchParams;
  const { shop } = await requireShop();
  const followers = await activeFollowers(shop.id);
  const used = await announcementsThisMonth(shop.id);
  const left = Math.max(0, MAX_ANNOUNCEMENTS_PER_MONTH - used);
  const past = await db
    .selectFrom("announcements").selectAll()
    .where("shop_id", "=", shop.id)
    .orderBy("sent_at", "desc").limit(10).execute();
  const openRate = past.length
    ? Math.round((past.reduce((a, p) => a + p.open_est, 0) / Math.max(1, past.reduce((a, p) => a + p.sent_count, 0))) * 100)
    : 0;

  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-6">
      <h1 className="text-lg font-extrabold">Mes annonces</h1>
      <p className="mt-1 text-xs text-gray-500">
        Tes abonnées ont accepté de recevoir tes nouveautés sur WhatsApp.
      </p>

      {searchParams.ok && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-okgreen">
          ✓ Annonce envoyée à tes abonnées.
        </p>
      )}
      {searchParams.err === "quota" && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
          Quota atteint : {MAX_ANNOUNCEMENTS_PER_MONTH} annonces maximum par mois — c&apos;est
          ce qui protège tes clientes du spam (et ton compte d&apos;un blocage).
        </p>
      )}
      {searchParams.err === "empty" && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
          Aucune abonnée pour l&apos;instant — tes clientes peuvent s&apos;abonner depuis ta boutique.
        </p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ["Abonnées", String(followers.length)],
          ["Ouvertures", `${openRate} %`],
          ["Restantes", `${left}/${MAX_ANNOUNCEMENTS_PER_MONTH}`],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-gray-200 bg-white p-3">
            <p className="text-base font-extrabold tabular-nums">{v}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{l}</p>
          </div>
        ))}
      </div>

      {left > 0 && followers.length > 0 && (
        <form method="post" action="/app/annonces/send" className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
            Nouvelle annonce
            <textarea
              name="body"
              rows={3}
              required
              minLength={10}
              maxLength={500}
              defaultValue="📦 Nouveau colis ouvert SAMEDI 20h — 32 pièces, prix doux. Sois là tôt ! 🔥"
              className="mt-1.5 w-full rounded-xl border-2 border-gray-200 bg-sand px-3 py-2.5 text-sm font-semibold focus:border-indigo9 focus:outline-none"
            />
          </label>
          <button className="mt-3 w-full rounded-2xl bg-mango px-5 py-3.5 text-sm font-extrabold text-[#3A2A00]">
            📣 Envoyer aux {followers.length} abonnée{followers.length > 1 ? "s" : ""}
          </button>
        </form>
      )}

      <h2 className="mb-2 mt-6 text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
        Annonces passées
      </h2>
      <div className="flex flex-col gap-2">
        {past.length === 0 && (
          <p className="rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-400">
            Aucune annonce envoyée.
          </p>
        )}
        {past.map((a) => (
          <div key={a.id} className="rounded-2xl border border-gray-200 bg-white p-3 text-xs">
            {a.body}
            <p className="mt-1 tabular-nums text-[10px] text-gray-400">
              {new Date(a.sent_at).toLocaleString("fr-FR")} · {a.sent_count} envois ·{" "}
              {a.open_est} ouvertures est.
            </p>
          </div>
        ))}
      </div>
      <AppNav active="/app" />
    </main>
  );
}
