import Link from "next/link";
import { t } from "@/lib/i18n";

export default function Home() {
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-end overflow-hidden bg-indigoNight px-6 pb-10 text-white">
      {/* fond : halos indigo + grain, en CSS pur */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 55% at 85% -5%, rgba(245,166,35,.28), transparent 60%), radial-gradient(90% 70% at 10% 20%, rgba(74,88,168,.55), transparent 65%), linear-gradient(180deg, #232C63 0%, #1A2148 55%, #141936 100%)",
        }}
      />
      <div aria-hidden className="grain absolute inset-0" />

      <div className="relative">
        <p className="font-display text-[64px] leading-none tracking-tight">
          tara<span className="text-mango">.</span>
        </p>
        <p className="mt-4 max-w-[26ch] text-[15px] leading-relaxed text-white/75">
          {t("fr", "home.tagline")}
        </p>

        <div className="mt-10 flex flex-col gap-3">
          <Link href="/creer" className="btn-mango">
            {t("fr", "home.cta")}
          </Link>
          <Link
            href="/nadia-friperie-237"
            className="btn border border-white/15 bg-white/[0.06] py-3.5 text-sm text-white/90"
          >
            {t("fr", "home.demo")}
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-white/45">
          <Link href="/cgu" className="underline-offset-2 hover:underline">{t("fr", "legal.terms")}</Link>
          <Link href="/confidentialite" className="underline-offset-2 hover:underline">{t("fr", "legal.privacy")}</Link>
          <Link href="/mentions-legales" className="underline-offset-2 hover:underline">{t("fr", "legal.notice")}</Link>
        </div>
      </div>
    </main>
  );
}
