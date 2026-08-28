"use client";
// Confort strictement optionnel (R2) : si le JavaScript ne charge pas, ou si
// la WebView refuse le presse-papier, le lien reste lisible et sélectionnable
// juste au-dessus.
import { useState } from "react";

export default function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
        } catch {
          // WebViews sans presse-papier : l'utilisatrice copie à la main
        }
      }}
      className={done ? "btn bg-okgreen py-4 text-white shadow-none" : "btn-wa"}
    >
      {done ? "✓ Lien copié — colle-le dans ta bio !" : "📋 Copier mon lien"}
    </button>
  );
}
