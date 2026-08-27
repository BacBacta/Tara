// Tableau de bord vendeuse — version minimale (complet en Phase 5).
import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { getShopBySeller } from "@/lib/sellers";

export const dynamic = "force-dynamic";

export default async function AppHome() {
  const session = readSession();
  if (!session) redirect("/creer");
  const shop = await getShopBySeller(session.sellerId);
  if (!shop) redirect("/creer/boutique");
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  return (
    <main className="mx-auto max-w-md px-6 pb-10 pt-8">
      <h1 className="text-lg font-extrabold">
        Bio·Shop <span className="text-sm font-bold text-gray-500">— {shop.name}</span>
      </h1>
      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 text-sm">
        <p>
          Ta boutique :{" "}
          <a href={`${base}/${shop.slug}`} className="font-extrabold text-indigo9 underline">
            {base.replace(/^https?:\/\//, "")}/{shop.slug}
          </a>
        </p>
        <p className="mt-2 text-gray-500">
          KPIs, commandes et gestion des articles arrivent en Phase 5.
        </p>
      </div>
    </main>
  );
}
