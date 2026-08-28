import { requireShop } from "@/lib/guard";
import { getIdentity } from "@/lib/identities";
import { db } from "@/lib/db";
import AppShell from "@/components/AppShell";
import Alert from "@/components/Alert";

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
    <AppShell
      slug={shop.slug}
      active="/app"
      title="Mon compte TikTok"
      subtitle="Connecte ton compte pour obtenir le badge vérifié et afficher tes vidéos sur ta boutique."
    >
      {searchParams.ok && (
        <Alert tone="ok" className="mb-4">
          ✓ Compte connecté — tes vidéos sont synchronisées.
        </Alert>
      )}
      {searchParams.err && (
        <Alert className="mb-4">La connexion a échoué. Réessaie.</Alert>
      )}

      {active ? (
        <div className="card p-4">
          <span className="chip bg-indigo9/10 font-extrabold text-indigo9">
            ✓ Compte TikTok vérifié
          </span>
          <p className="mt-3 font-display text-[17px] tracking-tight">@{identity?.username}</p>
          <p className="mt-1 text-[12.5px] tabular-nums text-inkSoft">
            {identity?.follower_count.toLocaleString("fr-FR")} abonnés ·{" "}
            {Number(videos?.n ?? 0)} vidéos synchronisées
          </p>
          <p className="mt-1 text-[11.5px] text-inkSoft/80">
            Dernière synchro :{" "}
            {identity?.synced_at ? new Date(identity.synced_at).toLocaleString("fr-FR") : "—"}
          </p>
          <div className="mt-4 flex gap-2">
            <form method="post" action="/app/tiktok/sync">
              <button className="chip border border-indigo9/35 px-3 py-1.5 font-extrabold text-indigo9 transition-transform active:scale-[0.97]">
                Synchroniser maintenant
              </button>
            </form>
            <form method="post" action="/app/tiktok/disconnect">
              <button className="chip border border-ink/10 px-3 py-1.5 font-bold text-inkSoft transition-transform active:scale-[0.97]">
                Déconnecter
              </button>
            </form>
          </div>
        </div>
      ) : (
        <form method="post" action="/app/tiktok/connect">
          <button className="btn bg-ink py-4 text-white shadow-card active:shadow-none">
            Connecter mon compte TikTok
          </button>
          <p className="mt-3 text-[12px] leading-relaxed text-inkSoft">
            Autorisations demandées : profil public, statistiques, liste de tes vidéos
            publiques. Tara ne publie jamais à ta place.
          </p>
        </form>
      )}
    </AppShell>
  );
}
