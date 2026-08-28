import { notFound } from "next/navigation";
import { getReviewByToken } from "@/lib/reviews";

export const dynamic = "force-dynamic";

export default async function AvisPage(
  props: { params: Promise<{ token: string }>; searchParams: Promise<{ ok?: string; err?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const review = await getReviewByToken(params.token);
  if (!review) notFound();

  if (searchParams.ok || review.status !== "pending") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-4xl text-okgreen">✓</div>
        <h1 className="text-lg font-extrabold">Merci pour ton avis !</h1>
        <p className="max-w-[28ch] text-sm text-gray-500">
          Il aide les prochains acheteurs de {review.shop_name}.
        </p>
        <a href={`/${review.slug}`} className="mt-2 rounded-2xl bg-wagreen px-6 py-3.5 text-sm font-extrabold text-[#053B1D]">
          Voir la boutique
        </a>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 pb-10 pt-10">
      <h1 className="text-lg font-extrabold">Ton avis sur cette commande</h1>
      <p className="mt-1 text-sm text-gray-500">
        {review.product_name} — commande {review.order_id} chez {review.shop_name}.
      </p>
      {searchParams.err && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
          Choisis une note entre 1 et 5.
        </p>
      )}
      <form method="post" action={`/avis/${review.token}/submit`} className="mt-5">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-gray-500">Ta note</p>
        <div className="mt-2 flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="flex-1 cursor-pointer">
              <input type="radio" name="rating" value={n} required className="peer sr-only" />
              <span className="block rounded-xl border-2 border-gray-200 bg-white py-3 text-center text-lg peer-checked:border-indigo9 peer-checked:bg-indigo-50">
                {"★".repeat(n)}
              </span>
            </label>
          ))}
        </div>
        <label className="mt-4 block text-[11px] font-extrabold uppercase tracking-widest text-gray-500">
          Ton commentaire (optionnel)
          <textarea
            name="comment"
            maxLength={400}
            rows={3}
            placeholder="Reçue en 2h, tissu superbe…"
            className="mt-1.5 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold focus:border-indigo9 focus:outline-none"
          />
        </label>
        <button className="mt-5 w-full rounded-2xl bg-mango px-5 py-4 text-sm font-extrabold text-[#3A2A00]">
          Publier mon avis
        </button>
        <p className="mt-2 text-center text-[11px] text-gray-500">
          🔒 Seuls les acheteurs livrés peuvent noter — ton avis portera la mention « Achat vérifié ».
        </p>
      </form>
    </main>
  );
}
