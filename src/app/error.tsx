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
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 text-4xl">
        ⚠️
      </div>
      <h1 className="text-xl font-extrabold">Quelque chose a cassé</h1>
      <p className="max-w-[30ch] text-sm text-gray-500">
        Ce n&apos;est pas de ta faute. Réessaie dans un instant — si le problème
        continue, écris à la vendeuse sur WhatsApp.
      </p>
      <a
        href="/"
        className="mt-2 rounded-2xl bg-mango px-6 py-3.5 text-sm font-extrabold text-[#3A2A00]"
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
