import Link from "next/link";
import { Wordmark } from "./Wordmark";

/** Cadre commun au back-office : marque, identité de l'admin, navigation.
 *  Les trois écrans (boutiques, pilote, connexion) ne gèrent que leur contenu. */
export default function AdminShell({
  email,
  title,
  subtitle,
  actif,
  children,
}: {
  email: string;
  title: string;
  subtitle?: string;
  /** onglet en cours : "boutiques" | "pilote" */
  actif: "boutiques" | "pilote";
  children: React.ReactNode;
}) {
  const onglet = (courant: boolean) =>
    `chip border font-extrabold ${
      courant
        ? "border-indigo9/35 bg-indigo9/10 text-indigo9"
        : "border-ink/10 bg-cream text-inkSoft"
    }`;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <Wordmark className="text-[17px]" />
          <span className="text-[10.5px] font-extrabold uppercase tracking-micro text-inkSoft">
            Administration
          </span>
        </div>
        <div className="flex items-center gap-2.5 text-[11.5px]">
          <span className="hidden text-inkSoft sm:inline">{email}</span>
          <a href="/admin/export" className="chip border border-ink/10 bg-cream font-extrabold text-indigo9">
            ⬇ Export CSV
          </a>
          <form method="post" action="/admin/logout">
            <button className="chip border border-ink/10 bg-cream font-bold text-inkSoft">
              Déconnexion
            </button>
          </form>
        </div>
      </header>

      <nav className="mt-5 flex gap-2">
        <Link href="/admin" className={onglet(actif === "boutiques")}>
          Boutiques
        </Link>
        <Link href="/admin/pilote" className={onglet(actif === "pilote")}>
          Pilote
        </Link>
      </nav>

      <h1 className="mt-6 font-display text-[23px] leading-tight tracking-tight">{title}</h1>
      {subtitle && (
        <p className="mt-1.5 text-[13px] leading-relaxed text-inkSoft">{subtitle}</p>
      )}

      <div className="mt-5">{children}</div>
    </main>
  );
}
