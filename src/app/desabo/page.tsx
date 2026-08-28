// Désabonnement en un clic depuis le lien des annonces (aucun compte requis).
import { db } from "@/lib/db";
import { checkUnsubToken, unfollow } from "@/lib/followers";

export const dynamic = "force-dynamic";

export default async function Desabo(
  props: {
    searchParams: Promise<{ s?: string; p?: string; t?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const { s: slug, p: phone, t: token } = searchParams;
  let done = false;
  if (slug && phone && token) {
    const shop = await db
      .selectFrom("shops").select("id").where("slug", "=", slug).executeTakeFirst();
    if (shop && checkUnsubToken(shop.id, phone, token)) {
      await unfollow(shop.id, phone);
      done = true;
    }
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-3xl">
        {done ? "✓" : "✕"}
      </div>
      <h1 className="text-lg font-extrabold">
        {done ? "Tu ne recevras plus d'annonces" : "Lien de désabonnement invalide"}
      </h1>
      <p className="max-w-[30ch] text-sm text-gray-500">
        {done
          ? "Tu peux te réabonner à tout moment depuis la boutique."
          : "Le lien est incomplet ou a expiré."}
      </p>
      {slug && (
        <a href={`/${slug}`} className="mt-2 rounded-2xl border border-gray-200 bg-white px-6 py-3 text-sm font-bold text-indigo9">
          Retour à la boutique
        </a>
      )}
    </main>
  );
}
