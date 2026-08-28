import { requireShop } from "@/lib/guard";
import { db } from "@/lib/db";
import {
  activeFollowers, announcementsThisMonth, MAX_ANNOUNCEMENTS_PER_MONTH,
} from "@/lib/followers";
import AppShell from "@/components/AppShell";
import Alert from "@/components/Alert";

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
    <AppShell
      slug={shop.slug}
      active="/app/annonces"
      title="Mes annonces"
      subtitle="Tes abonnées ont accepté de recevoir tes nouveautés sur WhatsApp."
    >
      {searchParams.ok && (
        <Alert tone="ok" className="mb-4">
          ✓ Annonce envoyée à tes abonnées.
        </Alert>
      )}
      {searchParams.err === "quota" && (
        <Alert tone="attention" className="mb-4">
          Quota atteint : {MAX_ANNOUNCEMENTS_PER_MONTH} annonces maximum par mois — c&apos;est
          ce qui protège tes clientes du spam (et ton compte d&apos;un blocage).
        </Alert>
      )}
      {searchParams.err === "empty" && (
        <Alert tone="attention" className="mb-4">
          Aucune abonnée pour l&apos;instant — tes clientes peuvent s&apos;abonner depuis ta
          boutique.
        </Alert>
      )}

      <div className="grid grid-cols-3 gap-2">
        {[
          ["Abonnées", String(followers.length)],
          ["Ouvertures", `${openRate} %`],
          ["Restantes", `${left}/${MAX_ANNOUNCEMENTS_PER_MONTH}`],
        ].map(([l, v]) => (
          <div key={l} className="card px-3 py-3.5">
            <p className="font-display text-[17px] leading-none tabular-nums">{v}</p>
            <p className="mt-1.5 text-[9.5px] font-extrabold uppercase tracking-micro text-inkSoft">
              {l}
            </p>
          </div>
        ))}
      </div>

      {left > 0 && followers.length > 0 && (
        <form method="post" action="/app/annonces/send" className="card mt-4 p-4">
          <label className="block text-[10.5px] font-extrabold uppercase tracking-micro text-inkSoft">
            Nouvelle annonce
            <textarea
              name="body"
              rows={3}
              required
              minLength={10}
              maxLength={500}
              defaultValue="📦 Nouveau colis ouvert SAMEDI 20h — 32 pièces, prix doux. Sois là tôt ! 🔥"
              className="mt-2 w-full rounded-2xl border border-ink/10 bg-sand px-3.5 py-3 text-[13.5px] font-semibold leading-relaxed focus:border-indigo9"
            />
          </label>
          <button className="btn-mango mt-3">
            📣 Envoyer aux {followers.length} abonnée{followers.length > 1 ? "s" : ""}
          </button>
        </form>
      )}

      <h2 className="label-micro mb-2.5 mt-7">Annonces passées</h2>
      <div className="flex flex-col gap-2">
        {past.length === 0 && (
          <p className="card p-4 text-[12.5px] text-inkSoft">Aucune annonce envoyée.</p>
        )}
        {past.map((a) => (
          <div key={a.id} className="card p-4 text-[12.5px] leading-relaxed">
            {a.body}
            <p className="mt-1.5 text-[11px] tabular-nums text-inkSoft">
              {new Date(a.sent_at).toLocaleString("fr-FR")} · {a.sent_count} envois ·{" "}
              {a.open_est} ouvertures est.
            </p>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
