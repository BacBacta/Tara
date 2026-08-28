import Link from "next/link";
import AppNav from "./AppNav";
import { Wordmark } from "./Wordmark";

/** Cadre commun aux douze écrans de l'espace vendeuse : marque, lien vers sa
 *  boutique, titre, et la barre du bas. Les pages ne gèrent que leur contenu. */
export default function AppShell({
  slug,
  title,
  subtitle,
  active,
  children,
}: {
  slug: string;
  title: React.ReactNode;
  subtitle?: string;
  /** onglet allumé dans la barre du bas ; "/app" pour les écrans secondaires */
  active: string;
  children: React.ReactNode;
}) {
  const host = (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(
    /^https?:\/\//,
    ""
  );

  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-5">
      <header className="mb-6 flex items-center justify-between gap-3">
        <Link href="/app">
          <Wordmark className="text-[17px]" />
        </Link>
        {/* raccourci permanent vers sa vitrine : elle la montre tout le temps */}
        <a
          href={`/${slug}`}
          className="chip min-w-0 border border-ink/10 bg-cream text-indigo9 shadow-insetHair"
        >
          <span className="truncate">
            {host}/{slug}
          </span>
          <span aria-hidden>↗</span>
        </a>
      </header>

      <h1 className="font-display text-[23px] leading-tight tracking-tight">{title}</h1>
      {subtitle && (
        <p className="mt-1.5 text-[13px] leading-relaxed text-inkSoft">{subtitle}</p>
      )}

      <div className="mt-5">{children}</div>

      <AppNav active={active} />
    </main>
  );
}
