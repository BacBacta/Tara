// 404 — composant serveur, aucun JavaScript requis.
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-indigo9/[0.07] text-[40px] shadow-card ring-8 ring-indigo9/[0.04]">
        🔎
      </div>
      <h1 className="font-display text-[22px] tracking-tight">Cette page n&apos;existe pas</h1>
      <p className="max-w-[30ch] text-sm leading-relaxed text-inkSoft">
        Le lien est peut-être incomplet, ou la boutique a changé de nom.
        Vérifie l&apos;adresse dans la bio TikTok de la vendeuse.
      </p>
      <Link
        href="/"
        className="btn-mango mt-3 w-auto px-8 text-sm"
      >
        Aller à l&apos;accueil
      </Link>
      <Link href="/creer" className="text-xs font-bold text-indigo9 underline">
        Créer ma boutique gratuite
      </Link>
    </main>
  );
}
