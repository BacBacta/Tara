import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import {
  agentsObserves,
  boutiquesParSemaine,
  boutiquesVivantes,
  commandesParBoutique,
  renouvellements,
} from "@/lib/pilote";

export const dynamic = "force-dynamic";

function Titre({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 mt-8 text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
      {children}
    </h2>
  );
}

function joursDepuis(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso.replace(" ", "T") + "Z").getTime();
  return Math.floor((Date.now() - t) / 86400_000);
}

export default async function Pilote() {
  requireAdmin();

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
    <main className="mx-auto max-w-4xl px-4 pb-16 pt-6">
      <Link href="/admin" className="text-xs font-bold text-indigo9 underline">
        ← Back-office
      </Link>
      <h1 className="mt-2 text-lg font-extrabold">Pilote</h1>
      <p className="mt-1 text-xs text-gray-500">
        Quatre chiffres décident de la suite. Le deuxième est le plus important.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          ["Boutiques", String(vivantes.length)],
          ["Vivantes (TikTok 7 j)", `${actives.length} / ${vivantes.length}`],
          ["Ont vendu", `${avecCommande.length} / ${vivantes.length}`],
          ["Ont repayé", String(renouv.boutiquesRenouvelees)],
        ].map(([label, valeur]) => (
          <div key={label} className="rounded-2xl border border-gray-200 bg-white p-3">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
              {label}
            </p>
            <p className="mt-1 text-lg font-extrabold tabular-nums">{valeur}</p>
          </div>
        ))}
      </div>

      {/* ---------- 2) la métrique clé ---------- */}
      <Titre>Le lien est-il encore dans la bio ?</Titre>
      <div className="rounded-2xl border-2 border-indigo9/25 bg-white p-4">
        <p className="mb-3 text-xs text-gray-500">
          Une visite venant du navigateur intégré de TikTok est le meilleur
          indice disponible que la vendeuse a gardé son lien en bio. Aucune
          visite depuis plusieurs jours = elle décroche.
        </p>
        {vivantes.length === 0 && <p className="text-xs text-gray-400">Aucune boutique.</p>}
        <div className="flex flex-col gap-1.5">
          {vivantes.map((b) => {
            const j = joursDepuis(b.derniereVisiteTikTok);
            const decroche = j === null || j > 7;
            return (
              <div
                key={b.id}
                className="flex items-center gap-2 border-b border-gray-100 py-1.5 text-xs last:border-0"
              >
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    decroche ? "bg-red-400" : "bg-okgreen"
                  }`}
                />
                <b className="flex-1 truncate">{b.name}</b>
                <span className="tabular-nums text-gray-500">
                  {b.visitesTikTok7j} visite{b.visitesTikTok7j > 1 ? "s" : ""} / 7 j
                </span>
                <span className={`tabular-nums ${decroche ? "text-red-500" : "text-gray-400"}`}>
                  {j === null ? "jamais" : `il y a ${j} j`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------- 1) créations ---------- */}
      <Titre>Boutiques créées, par semaine</Titre>
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-sand text-[10px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-3 py-2">Semaine du</th>
              <th className="px-3 py-2 text-right">Créées</th>
            </tr>
          </thead>
          <tbody>
            {semaines.length === 0 && (
              <tr>
                <td colSpan={2} className="px-3 py-3 text-gray-400">
                  Aucune boutique.
                </td>
              </tr>
            )}
            {semaines.map((s) => (
              <tr key={s.semaine} className="border-t border-gray-100">
                <td className="px-3 py-2 tabular-nums">{s.semaine}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.boutiques}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------- 3) commandes ---------- */}
      <Titre>
        Commandes par boutique
        {delaiMedian !== null && (
          <span className="ml-2 normal-case tracking-normal text-gray-400">
            — délai médian avant la première vente : {delaiMedian} j
          </span>
        )}
      </Titre>
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-sand text-[10px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-3 py-2">Boutique</th>
              <th className="px-3 py-2">Créée le</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">1re vente après</th>
              <th className="px-3 py-2">Par semaine</th>
            </tr>
          </thead>
          <tbody>
            {commandes.map((c) => (
              <tr key={c.slug} className="border-t border-gray-100">
                <td className="px-3 py-2 font-bold">{c.name}</td>
                <td className="px-3 py-2 tabular-nums text-gray-500">{c.creeLe}</td>
                <td className="px-3 py-2 text-right tabular-nums">{c.commandes}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {c.delaiPremiereCommandeJours === null ? (
                    <span className="text-gray-300">—</span>
                  ) : (
                    `${c.delaiPremiereCommandeJours} j`
                  )}
                </td>
                <td className="px-3 py-2 text-[10px] text-gray-500">
                  {c.parSemaine.slice(0, 4).map((s) => `${s.semaine.slice(5)} : ${s.commandes}`).join(" · ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------- 4) renouvellement ---------- */}
      <Titre>Abonnements payés au deuxième mois</Titre>
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          ["Ont payé au moins une fois", renouv.boutiquesPayantes],
          ["Ont payé une DEUXIÈME fois", renouv.boutiquesRenouvelees],
          ["En période offerte seulement", renouv.boutiquesOffertesSeulement],
        ].map(([label, valeur]) => (
          <div key={String(label)} className="rounded-2xl border border-gray-200 bg-white p-3">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
              {String(label)}
            </p>
            <p className="mt-1 text-lg font-extrabold tabular-nums">{String(valeur)}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-gray-500">
        Une période offerte ne compte pas comme un paiement. La question du
        pilote n&apos;est pas « combien de boutiques sont actives » mais
        « combien ont sorti 3 000 F une deuxième fois ».
      </p>

      {/* ---------- garde-fou ---------- */}
      <Titre>Navigateurs observés — à vérifier</Titre>
      <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
        <p className="mb-3 text-xs text-gray-600">
          La détection du canal repose sur des marqueurs du <i>user agent</i> :
          c&apos;est une <b>heuristique</b>, pas une certitude. Ouvre ta boutique
          depuis TikTok sur ton téléphone, puis vérifie ici que la visite est
          bien classée « tiktok ». Sinon, corrige la liste dans{" "}
          <code className="rounded bg-white px-1">src/lib/channel.ts</code>.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="text-[10px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="py-1">Navigateur</th>
                <th className="py-1">Classé</th>
                <th className="py-1 text-right">Visites</th>
              </tr>
            </thead>
            <tbody>
              {agents.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-2 text-gray-400">
                    Aucune visite sur 30 jours.
                  </td>
                </tr>
              )}
              {agents.map((a) => (
                <tr key={`${a.agent}-${a.canal}`} className="border-t border-amber-200/50">
                  <td className="py-1 font-mono">{a.agent}</td>
                  <td className="py-1">
                    <span
                      className={`rounded-full px-2 py-0.5 font-extrabold ${
                        a.canal === "tiktok"
                          ? "bg-emerald-50 text-okgreen"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {a.canal}
                    </span>
                  </td>
                  <td className="py-1 text-right tabular-nums">{a.visites}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
