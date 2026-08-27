import Link from "next/link";

const TABS = [
  ["/app", "🏪", "Boutique"],
  ["/app/commandes", "📦", "Commandes"],
  ["/app/articles", "🛍️", "Articles"],
  ["/app/annonces", "📣", "Annonces"],
  ["/app/reglages", "⚙️", "Réglages"],
] as const;

export default function AppNav({ active }: { active: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md border-t border-gray-200 bg-white pb-2 pt-1.5">
      {TABS.map(([href, icon, label]) => (
        <Link
          key={href}
          href={href}
          className={`flex flex-1 flex-col items-center gap-0.5 text-[10px] font-bold ${
            active === href ? "text-indigo9" : "text-gray-400"
          }`}
        >
          <span className="text-base">{icon}</span>
          {label}
        </Link>
      ))}
    </nav>
  );
}
