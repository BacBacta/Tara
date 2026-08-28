import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { getShopBySeller } from "@/lib/sellers";
import { ObShell, ObAlert, inputCls, labelCls, hintCls } from "@/components/Onboarding";
import NameSlugField from "@/components/NameSlugField";

export const dynamic = "force-dynamic";

export default async function Etape2(props: { searchParams: Promise<{ err?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await readSession();
  if (!session) redirect("/creer");
  const existing = await getShopBySeller(session.sellerId);
  if (existing) redirect("/creer/article");

  const host = (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000")
    .replace(/^https?:\/\//, "");

  return (
    <ObShell
      step={2}
      title="Le nom de ta boutique"
      subtitle="Ton lien se crée à partir du nom — c'est lui que tu mettras dans ta bio TikTok."
    >
      {searchParams.err && (
        <ObAlert>Vérifie le nom (3 caractères minimum) et la ville.</ObAlert>
      )}
      <form method="post" action="/creer/boutique/save" className="flex flex-col gap-5">
        <div>
          <NameSlugField host={host} />
          {/* Le lien ne se modifie pas ensuite : elle doit le savoir avant. */}
          <p className={hintCls}>
            Ce lien ne changera plus — choisis un nom que tu garderas. S&apos;il est déjà
            pris, un chiffre sera ajouté.
          </p>
        </div>
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
        <button type="submit" className="btn-mango mt-1">
          Continuer →
        </button>
      </form>
    </ObShell>
  );
}
