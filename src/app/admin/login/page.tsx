import Alert from "@/components/Alert";
import { Wordmark } from "@/components/Wordmark";
import { inputCls } from "@/components/ob-styles";

export const dynamic = "force-dynamic";

export default async function AdminLogin(props: { searchParams: Promise<{ err?: string }> }) {
  const searchParams = await props.searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 pb-16">
      <Wordmark className="text-[19px]" />
      <h1 className="mt-4 font-display text-[23px] leading-tight tracking-tight">
        Administration
      </h1>
      <p className="mt-1.5 text-[13px] text-inkSoft">Réservé à l&apos;équipe Tara.</p>

      {searchParams.err && <Alert className="mt-5">Identifiants incorrects.</Alert>}

      <form method="post" action="/admin/login/check" className="mt-6 flex flex-col gap-3">
        <input
          name="email"
          type="email"
          placeholder="admin@tara.shop"
          autoComplete="username"
          required
          className={`${inputCls} mt-0`}
        />
        <input
          name="password"
          type="password"
          placeholder="Mot de passe"
          autoComplete="current-password"
          required
          className={`${inputCls} mt-0`}
        />
        <button className="btn mt-2 bg-indigo9 py-4 text-white shadow-card active:shadow-none">
          Se connecter
        </button>
      </form>
    </main>
  );
}
