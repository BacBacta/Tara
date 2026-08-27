import Link from "next/link";
import { t } from "@/lib/i18n";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-3xl font-extrabold tracking-tight">
        Bio·<span className="text-mango">Shop</span>
      </h1>
      <p className="text-sm text-gray-500">{t("fr", "home.tagline")}</p>
      <div className="flex w-full flex-col gap-3">
        <Link
          href="/creer"
          className="rounded-2xl bg-mango px-6 py-4 text-sm font-extrabold text-[#3a2a00]"
        >
          {t("fr", "home.cta")}
        </Link>
        <Link
          href="/nadia-friperie-237"
          className="rounded-2xl border border-gray-200 bg-white px-6 py-4 text-sm font-bold text-indigo9"
        >
          {t("fr", "home.demo")}
        </Link>
      </div>
    </main>
  );
}
