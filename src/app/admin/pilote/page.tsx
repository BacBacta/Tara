import { requireAdmin } from "@/lib/admin";
import {
  agentsObserves,
  boutiquesParSemaine,
  boutiquesVivantes,
  commandesParBoutique,
  renouvellements,
} from "@/lib/pilote";
import AdminShell from "@/components/AdminShell";

export const dynamic = "force-dynamic";

function joursDepuis(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso.replace(" ", "T") + "Z").getTime();
  return Math.floor((Date.now() - t) / 86400_000);
}

export default async function Pilote() {
  const admin = await requireAdmin();

  const [semaines, vivantes, commandes, renouv, agents] = await Promise.all([
    boutiquesParSemaine(),
    boutiquesVivantes(),
    commandesParBoutique(),
    renouvellements(),
    agentsObserves(),
  ]);

  const actives = vivantes.filter((b) => b.visitesTikTok7j > 0);
  const avecCommande = commandes.filter((c) => c.commandes > 0);
  const delais = avecCommande
    .map((c) => c.delaiPremiereCommandeJours)
    .filter((d): d is number => d !== null);
  const delaiMedian = delais.length
    ? [...delais].sort((a, b) => a - b)[Math.floor(delais.length / 2)]
    : null;

  return (
    <AdminShell
      email={admin.email}
      actif="pilote"
      title="Pilote"
      subtitle="Quatre chiffres décident de la suite. Le deuxième est le plus important."
    >
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          ["Boutiques", String(vivantes.length)],
          ["Vivantes (TikTok 7 j)", `${actives.length} / ${vivantes.length}`],
          ["Ont vendu", `${avecCommande.length} / ${vivantes.length}`],
          ["Ont repayé", String(renouv.boutiquesRenouvelees)],
        ].map(([label, valeur]) => (
          <div key={label} className="card px-3 py-3.5">
            <p className="text-[9.5px] font-extrabold uppercase tracking-micro text-inkSoft">
              {label}
            </p>
            <p className="mt-1.5 font-display text-[19px] leading-none tabular-nums">{valeur}</p>
          </div>
        ))}
      </div>

      {/* ---------- 2) la métrique clé ---------- */}
      <h2 className="label-micro mb-2.5 mt-7">Le lien est-il encore dans la bio ?</h2>
      <div className="card border-indigo9/20 p-4">
        <p className="mb-4 text-[12.5px] leading-relaxed text-inkSoft">
          Une visite venant du navigateur intégré de TikTok est le meilleur indice
          disponible que la vendeuse a gardé son lien en bio. Aucune visite depuis
          plusieurs jours = elle décroche.
        </p>
        {vivantes.length === 0 && <p className="text-[12.5px] text-inkSoft">Aucune boutique.</p>}
        <div className="flex flex-col">
          {vivantes.map((b) => {
            const j = joursDepuis(b.derniereVisiteTikTok);
            const decroche = j === null || j > 7;
            return (
              <div
                key={b.id}
                className="flex items-center gap-2.5 border-b border-ink/[0.06] py-2 text-[12.5px] last:border-0"
              >
                <span
                  aria-hidden
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    decroche ? "bg-red-400" : "bg-okgreen"
                  }`}
                />
                <b className="min-w-0 flex-1 truncate">{b.name}</b>
                <span className="shrink-0 tabular-nums text-inkSoft">
                  {b.visitesTikTok7j} visite{b.visitesTikTok7j > 1 ? "s" : ""} / 7 j
                </span>
                <span
                  className={`shrink-0 tabular-nums ${decroche ? "text-red-500" : "text-inkSoft/70"}`}
                >
                  {j === null ? "jamais" : `il y a ${j} j`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------- 1) créations ---------- */}
      <h2 className="label-micro mb-2.5 mt-7">Boutiques créées, par semaine</h2>
      <div className="card overflow-x-auto p-0">
        <table className="tbl">
          <thead>
            <tr>
              <th>Semaine du</th>
              <th className="text-right">Créées</th>
            </tr>
          </thead>
          <tbody>
            {semaines.length === 0 && (
              <tr>
                <td colSpan={2} className="text-inkSoft">
                  Aucune boutique.
                </td>
              </tr>
            )}
            {semaines.map((s) => (
              <tr key={s.semaine}>
                <td className="tabular-nums">{s.semaine}</td>
                <td className="text-right tabular-nums">{s.boutiques}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------- 3) commandes ---------- */}
      <h2 className="label-micro mb-2.5 mt-7">
        Commandes par boutique
        {delaiMedian !== null && (
          <span className="font-bold normal-case tracking-normal text-inkSoft/80">
            — 1re vente en {delaiMedian} j (médiane)
          </span>
        )}
      </h2>
      <div className="card overflow-x-auto p-0">
        <table className="tbl">
          <thead>
            <tr>
              <th>Boutique</th>
              <th>Créée le</th>
              <th className="text-right">Total</th>
              <th className="text-right">1re vente après</th>
              <th>Par semaine</th>
            </tr>
          </thead>
          <tbody>
            {commandes.length === 0 && (
              <tr>
                <td colSpan={5} className="text-inkSoft">
                  Aucune boutique.
                </td>
              </tr>
            )}
            {commandes.map((c) => (
              <tr key={c.slug}>
                <td className="font-bold">{c.name}</td>
                <td className="tabular-nums text-inkSoft">{c.creeLe}</td>
                <td className="text-right tabular-nums">{c.commandes}</td>
                <td className="text-right tabular-nums">
                  {c.delaiPremiereCommandeJours === null ? (
                    <span className="text-inkSoft/50">—</span>
                  ) : (
                    `${c.delaiPremiereCommandeJours} j`
                  )}
                </td>
                <td className="text-[10.5px] text-inkSoft">
                  {c.parSemaine.slice(0, 4).map((s) => `${s.semaine.slice(5)} : ${s.commandes}`).join(" · ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------- 4) renouvellement ---------- */}
      <h2 className="label-micro mb-2.5 mt-7">Abonnements payés au deuxième mois</h2>
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          ["Ont payé au moins une fois", renouv.boutiquesPayantes],
          ["Ont payé une DEUXIÈME fois", renouv.boutiquesRenouvelees],
          ["En période offerte seulement", renouv.boutiquesOffertesSeulement],
        ].map(([label, valeur]) => (
          <div key={String(label)} className="card px-3 py-3.5">
            <p className="text-[9.5px] font-extrabold uppercase tracking-micro text-inkSoft">
              {String(label)}
            </p>
            <p className="mt-1.5 font-display text-[19px] leading-none tabular-nums">
              {String(valeur)}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-[12px] leading-relaxed text-inkSoft">
        Une période offerte ne compte pas comme un paiement. La question du pilote
        n&apos;est pas « combien de boutiques sont actives » mais « combien ont sorti
        3 000 F une deuxième fois ».
      </p>

      {/* ---------- garde-fou ---------- */}
      <h2 className="label-micro mb-2.5 mt-7">Navigateurs observés — à vérifier</h2>
      <div className="rounded-3xl border border-mango/30 bg-amber-50/60 p-4">
        <p className="mb-4 text-[12.5px] leading-relaxed text-inkSoft">
          La détection du canal repose sur des marqueurs du <i>user agent</i> : c&apos;est
          une <b>heuristique</b>, pas une certitude. Ouvre ta boutique depuis TikTok sur
          ton téléphone, puis vérifie ici que la visite est bien classée « tiktok ».
          Sinon, corrige la liste dans{" "}
          <code className="rounded bg-cream px-1.5 py-0.5">src/lib/channel.ts</code>.
        </p>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead className="bg-transparent">
              <tr>
                <th>Navigateur</th>
                <th>Venue par</th>
                <th>Classé</th>
                <th className="text-right">Visites</th>
              </tr>
            </thead>
            <tbody>
              {agents.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-inkSoft">
                    Aucune visite sur 30 jours.
                  </td>
                </tr>
              )}
              {agents.map((a) => (
                <tr key={`${a.agent}-${a.canal}-${a.source}`} className="border-t border-mango/20">
                  {/* affiché en entier, et coupable à la souris : c'est la
                      seule preuve dont on dispose sur un vrai téléphone */}
                  <td className="max-w-[26rem] break-all font-mono text-[10.5px] leading-relaxed">
                    {a.agent}
                  </td>
                  <td className="whitespace-nowrap text-[11px] text-inkSoft">{a.source}</td>
                  <td>
                    <span
                      className={`chip font-extrabold ${
                        a.canal === "tiktok"
                          ? "bg-emerald-50 text-okgreen"
                          : "bg-ink/[0.06] text-inkSoft"
                      }`}
                    >
                      {a.canal}
                    </span>
                  </td>
                  <td className="text-right tabular-nums">{a.visites}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
