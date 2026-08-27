import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { getShopBySeller } from "@/lib/sellers";
import { ObShell, inputCls, labelCls, ctaCls } from "@/components/Onboarding";
import NameSlugField from "@/components/NameSlugField";

export const dynamic = "force-dynamic";

export default async function Etape2({ searchParams }: { searchParams: { err?: string } }) {
  const session = readSession();
  if (!session) redirect("/creer");
  const existing = await getShopBySeller(session.sellerId);
  if (existing) redirect("/creer/article");

  const host = (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000")
    .replace(/^https?:\/\//, "");

  return (
    <ObShell
      step={2}
      title="Le nom de ta boutique"
      subtitle="Ton lien se crée tout seul — c'est lui que tu mettras dans ta bio TikTok."
    >
      {searchParams.err && (
        <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
          Vérifie le nom (3 caractères minimum) et la ville.
        </p>
      )}
      <form method="post" action="/creer/boutique/save" className="flex flex-col gap-4">
        <NameSlugField host={host} />
        <label className={labelCls}>
          Ta ville
          <input
            name="city"
            placeholder="Douala"
            required
            minLength={2}
            maxLength={40}
            className={inputCls}
          />
        </label>
        <button type="submit" className={ctaCls}>
          Continuer →
        </button>
      </form>
    </ObShell>
  );
}
