"use client";

// 500 — Next.js impose un composant client pour la frontière d'erreur.
// Le chemin de retour est un lien <a> natif : il fonctionne même si le
// JavaScript n'a pas chargé, ce qui est précisément le cas ici.
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[erreur]", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-amber-50 text-[40px] shadow-card ring-8 ring-amber-50/60">
        ⚠️
      </div>
      <h1 className="font-display text-[22px] tracking-tight">Quelque chose a cassé</h1>
      <p className="max-w-[30ch] text-sm leading-relaxed text-inkSoft">
        Ce n&apos;est pas de ta faute. Réessaie dans un instant — si le problème
        continue, écris à la vendeuse sur WhatsApp.
      </p>
      <a
        href="/"
        className="btn-mango mt-3 w-auto px-8 text-sm"
      >
        Retour à l&apos;accueil
      </a>
      <button
        onClick={reset}
        className="text-xs font-bold text-indigo9 underline"
      >
        Réessayer
      </button>
    </main>
  );
}
