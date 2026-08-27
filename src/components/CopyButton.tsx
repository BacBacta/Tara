"use client";
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
          // WebViews sans clipboard : l'utilisatrice copie à la main
        }
      }}
      className={`mt-3 w-full rounded-2xl px-5 py-3.5 text-sm font-extrabold ${
        done ? "bg-okgreen text-white" : "bg-wagreen text-[#053B1D]"
      }`}
    >
      {done ? "✓ Lien copié — colle-le dans ta bio !" : "📋 Copier mon lien"}
    </button>
  );
}
