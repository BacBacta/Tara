export const dynamic = "force-dynamic";

export default function AdminLogin({ searchParams }: { searchParams: { err?: string } }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="text-lg font-extrabold">Bio-Shop — Administration</h1>
      {searchParams.err && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
          Identifiants incorrects.
        </p>
      )}
      <form method="post" action="/admin/login/check" className="mt-5 flex flex-col gap-3">
        <input
          name="email"
          type="email"
          placeholder="admin@bioshop.cm"
          required
          className="rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-bold focus:border-indigo9 focus:outline-none"
        />
        <input
          name="password"
          type="password"
          placeholder="Mot de passe"
          required
          className="rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-bold focus:border-indigo9 focus:outline-none"
        />
        <button className="rounded-2xl bg-indigo9 px-5 py-3.5 text-sm font-extrabold text-white">
          Se connecter
        </button>
      </form>
    </main>
  );
}
