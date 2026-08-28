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
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md border-t border-ink/[0.07] bg-cream/95 px-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md">
      {TABS.map(([href, icon, label]) => {
        const on = active === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1 text-[10px] font-extrabold ${
              on ? "text-indigo9" : "text-inkSoft/70"
            }`}
          >
            <span
              aria-hidden
              className={`flex h-7 w-12 items-center justify-center rounded-full text-[15px] ${
                on ? "bg-indigo9/10" : ""
              }`}
            >
              {icon}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
