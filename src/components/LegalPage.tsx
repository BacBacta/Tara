// Coque commune des pages légales. Composant serveur : aucun JavaScript.
import Link from "next/link";

/** Marqueur d'information que seul MIKE peut fournir. Volontairement visible :
 *  une page légale incomplète ne doit pas pouvoir partir en production sans
 *  qu'on le remarque. Le pré-vol du lot 6 pourra chercher cette chaîne. */
export const A_COMPLETER = "[À COMPLÉTER]";

export function Todo({ children }: { children: React.ReactNode }) {
  return (
    <mark className="rounded bg-amber-100 px-1 font-bold text-amber-900">
      {A_COMPLETER} {children}
    </mark>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-6 text-sm font-extrabold text-ink">{children}</h2>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm leading-relaxed text-gray-600">{children}</p>;
}

export function Ul({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-gray-600">
      {children}
    </ul>
  );
}

export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-16 pt-8">
      <Link href="/" className="text-xs font-bold text-indigo9 underline">
        ← Tara
      </Link>
      <h1 className="mt-3 text-xl font-extrabold">{title}</h1>
      <p className="mt-1 text-[11px] text-gray-400">
        Dernière mise à jour : {updated}
      </p>
      {children}
      <nav className="mt-10 flex flex-wrap gap-4 border-t border-gray-200 pt-4 text-xs font-bold text-indigo9">
        <Link href="/cgu" className="underline">Conditions d&apos;utilisation</Link>
        <Link href="/mentions-legales" className="underline">Mentions légales</Link>
        <Link href="/confidentialite" className="underline">Confidentialité</Link>
      </nav>
    </main>
  );
}
