// 404 — composant serveur, aucun JavaScript requis.
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50 text-4xl">
        🔎
      </div>
      <h1 className="text-xl font-extrabold">Cette page n&apos;existe pas</h1>
      <p className="max-w-[30ch] text-sm text-gray-500">
        Le lien est peut-être incomplet, ou la boutique a changé de nom.
        Vérifie l&apos;adresse dans la bio TikTok de la vendeuse.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-2xl bg-mango px-6 py-3.5 text-sm font-extrabold text-[#3A2A00]"
      >
        Aller à l&apos;accueil
      </Link>
      <Link href="/creer" className="text-xs font-bold text-indigo9 underline">
        Créer ma boutique gratuite
      </Link>
    </main>
  );
}
