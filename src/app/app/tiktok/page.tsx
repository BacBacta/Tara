import { requireShop } from "@/lib/guard";
import { getIdentity } from "@/lib/identities";
import { db } from "@/lib/db";
import AppNav from "@/components/AppNav";

export const dynamic = "force-dynamic";

export default async function TikTokPage(props: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const searchParams = await props.searchParams;
  const { sellerId, shop } = await requireShop();
  const identity = await getIdentity(sellerId);
  const active = identity?.status === "active";
  const videos = active
    ? await db.selectFrom("videos").select(db.fn.countAll<number>().as("n"))
        .where("shop_id", "=", shop.id).executeTakeFirst()
    : null;

  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-6">
      <h1 className="text-lg font-extrabold">Mon compte TikTok</h1>
      <p className="mt-1 text-xs text-gray-500">
        Connecte ton compte pour obtenir le badge vérifié et afficher tes vidéos sur ta boutique.
      </p>

      {searchParams.ok && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-okgreen">
          ✓ Compte connecté — tes vidéos sont synchronisées.
        </p>
      )}
      {searchParams.err && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
          La connexion a échoué. Réessaie.
        </p>
      )}

      {active ? (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-extrabold text-indigo9">
            ✓ Compte TikTok vérifié
          </p>
          <p className="mt-2 text-sm font-extrabold">@{identity?.username}</p>
          <p className="mt-1 text-xs text-gray-500 tabular-nums">
            {identity?.follower_count.toLocaleString("fr-FR")} abonnés ·{" "}
            {Number(videos?.n ?? 0)} vidéos synchronisées
          </p>
          <p className="mt-1 text-[11px] text-gray-400">
            Dernière synchro :{" "}
            {identity?.synced_at ? new Date(identity.synced_at).toLocaleString("fr-FR") : "—"}
          </p>
          <div className="mt-3 flex gap-2">
            <form method="post" action="/app/tiktok/sync">
              <button className="rounded-full border border-indigo9/40 px-3 py-1.5 text-[11px] font-extrabold text-indigo9">
                Synchroniser maintenant
              </button>
            </form>
            <form method="post" action="/app/tiktok/disconnect">
              <button className="rounded-full border border-gray-200 px-3 py-1.5 text-[11px] font-bold text-gray-500">
                Déconnecter
              </button>
            </form>
          </div>
        </div>
      ) : (
        <form method="post" action="/app/tiktok/connect" className="mt-4">
          <button className="w-full rounded-2xl bg-ink px-5 py-4 text-sm font-extrabold text-white">
            Connecter mon compte TikTok
          </button>
          <p className="mt-2 text-[11px] text-gray-500">
            Autorisations demandées : profil public, statistiques, liste de tes vidéos
            publiques. Tara ne publie jamais à ta place.
          </p>
        </form>
      )}

      <AppNav active="/app" />
    </main>
  );
}
