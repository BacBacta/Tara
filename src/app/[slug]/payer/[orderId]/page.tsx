import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { fcfa } from "@/lib/format";
import { normalizeLang, t } from "@/lib/i18n";
import { normalizePaymentMode, operatorLabel } from "@/lib/payments";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; orderId: string }>; searchParams: Promise<{ err?: string }> };

export default async function PayerPage(props: Props) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const order = await db
    .selectFrom("orders")
    .innerJoin("shops", "shops.id", "orders.shop_id")
    .innerJoin("sellers", "sellers.id", "shops.seller_id")
    .innerJoin("products", "products.id", "orders.product_id")
    .select([
      "orders.id", "orders.amount_fcfa", "orders.variant", "orders.qty",
      "orders.status", "shops.slug", "shops.momo_enabled", "shops.name as shop_name",
      "shops.payment_mode", "shops.momo_number", "shops.momo_operator",
      "products.name as product_name", "sellers.lang",
    ])
    .where("orders.id", "=", params.orderId)
    .where("shops.slug", "=", params.slug)
    .executeTakeFirst();

  if (!order) notFound();
  const lang = normalizeLang(order.lang);
  const fr = lang === "fr";
  const mode = normalizePaymentMode(order.payment_mode);

  const recap = (
    <div className="card mb-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-sm">
      <span className="min-w-0 truncate text-inkSoft">
        {order.product_name}
        {order.variant ? ` (${order.variant})` : ""} × {order.qty}
      </span>
      <b className="shrink-0 font-display tabular-nums tracking-tight">{fcfa(order.amount_fcfa)}</b>
    </div>
  );

  // ------------------------------------------------------------------
  // Mode direct : l'acheteuse paie la vendeuse sur son téléphone.
  // Tara n'est pas dans le circuit de l'argent (R1).
  // ------------------------------------------------------------------
  if (mode === "direct") {
    if (!["initiated", "pending_payment", "payment_announced"].includes(order.status)) {
      notFound();
    }

    // Boutique en mode direct qui n'a pas encore renseigné son numéro :
    // message clair et sortie propre, jamais une page cassée.
    if (!order.momo_number) {
      return (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-3xl">
            📵
          </div>
          <h1 className="text-lg font-extrabold">{t(lang, "pay.directTitle")}</h1>
          <p className="max-w-[32ch] text-sm text-gray-500">{t(lang, "pay.noNumber")}</p>
          <Link
            href={`/${order.slug}`}
            className="mt-2 rounded-2xl bg-wagreen px-6 py-3.5 text-sm font-extrabold text-[#053B1D]"
          >
            {t(lang, "pay.backToShop")}
          </Link>
        </main>
      );
    }

    const announced = order.status === "payment_announced";

    return (
      <main className="mx-auto max-w-md px-4 pb-10">
        <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-ink/[0.06] bg-sand/90 px-4 py-3 backdrop-blur-md">
          <b className="text-sm">{t(lang, "pay.directTitle")}</b>
        </div>

        {recap}

        {announced ? (
          <div className="mb-4 rounded-2xl border border-okgreen/20 bg-emerald-50 px-4 py-3.5">
            <p className="text-sm font-extrabold text-okgreen">
              ✓ {t(lang, "pay.announced")}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-inkSoft">{t(lang, "pay.announcedHelp")}</p>
          </div>
        ) : (
          <p className="mb-4 text-sm leading-relaxed text-inkSoft">{t(lang, "pay.directHowto")}</p>
        )}

        {/* Les coordonnées de la VENDEUSE — jamais un compte Tara.
            Présentées comme une carte : c'est le geste central de la page. */}
        <dl className="grain overflow-hidden rounded-3xl bg-gradient-to-br from-indigo9 via-indigoDeep to-indigoNight text-white shadow-float">
          <div className="px-5 pb-4 pt-5">
            <dt className="text-[10.5px] font-extrabold uppercase tracking-micro text-white/50">
              {t(lang, "pay.number")}
            </dt>
            <dd className="mt-1 select-all font-display text-[27px] tabular-nums leading-none tracking-wide">
              {order.momo_number}
            </dd>
            <dd className="mt-2.5">
              <span
                className={`chip font-extrabold ${
                  order.momo_operator === "orange"
                    ? "bg-[#FF7900] text-white"
                    : "bg-[#FFCC00] text-[#3A2A00]"
                }`}
              >
                {operatorLabel(order.momo_operator)}
              </span>
            </dd>
          </div>
          <div className="flex items-stretch border-t border-white/10 bg-white/[0.04]">
            <div className="flex-1 px-5 py-3.5">
              <dt className="text-[10.5px] font-extrabold uppercase tracking-micro text-white/50">
                {t(lang, "pay.amount")}
              </dt>
              <dd className="mt-0.5 font-display text-lg tabular-nums tracking-tight text-mango">
                {fcfa(order.amount_fcfa)}
              </dd>
            </div>
            <div className="border-l border-white/10 px-5 py-3.5 text-right">
              <dt className="text-[10.5px] font-extrabold uppercase tracking-micro text-white/50">
                {t(lang, "pay.orderRef")}
              </dt>
              <dd className="mt-0.5 font-display text-lg tabular-nums tracking-tight">{order.id}</dd>
            </div>
          </div>
        </dl>

        <p className="mt-3.5 text-center text-[11px] leading-relaxed text-inkSoft">
          {order.shop_name} — {t(lang, "pay.directNotice")}
        </p>

        {/* Formulaire POST natif : fonctionne sans JavaScript. */}
        <form method="post" action={`/${order.slug}/payer/${order.id}/annonce`}>
          <button type="submit" className="btn-wa mt-5 text-sm">
            💬 {t(lang, "pay.announce")}
          </button>
        </form>

        <Link
          href={`/${order.slug}`}
          className="mt-4 block text-center text-xs font-bold text-inkSoft underline-offset-2 active:underline"
        >
          {t(lang, "pay.backToShop")}
        </Link>
      </main>
    );
  }

  // ------------------------------------------------------------------
  // Mode agrégateur : parcours Mobile Money historique, inchangé.
  // ------------------------------------------------------------------
  if (order.momo_enabled !== 1) notFound();
  if (!["initiated", "pending_payment"].includes(order.status)) notFound();

  return (
    <main className="mx-auto max-w-md px-4 pb-10">
      <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-ink/[0.06] bg-sand/90 px-4 py-3 backdrop-blur-md">
        <b className="text-sm">{fr ? "Paiement Mobile Money" : "Mobile Money payment"}</b>
      </div>

      {recap}

      {searchParams.err && (
        <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
          {fr
            ? "Numéro invalide — entre ton numéro MoMo (ex : 6 77 12 34 56)."
            : "Invalid number — enter your MoMo number (e.g. 6 77 12 34 56)."}
        </p>
      )}

      <form method="post" action={`/${order.slug}/payer/${order.id}/init`}>
        <p className="label-micro">{fr ? "Choisis ton opérateur" : "Choose your operator"}</p>
        <div className="mt-2 flex gap-2.5">
          <label className="flex-1 cursor-pointer rounded-2xl border border-ink/10 bg-cream p-3.5 text-center text-sm font-extrabold shadow-insetHair transition-transform active:scale-95 has-[:checked]:border-indigo9 has-[:checked]:bg-indigo9/[0.06] has-[:checked]:shadow-card">
            <input type="radio" name="operator" value="mtn" defaultChecked className="sr-only" />
            <span className="mx-auto mb-2 block h-7 w-7 rounded-xl bg-[#FFCC00] shadow-insetHair" />
            MTN MoMo
          </label>
          <label className="flex-1 cursor-pointer rounded-2xl border border-ink/10 bg-cream p-3.5 text-center text-sm font-extrabold shadow-insetHair transition-transform active:scale-95 has-[:checked]:border-indigo9 has-[:checked]:bg-indigo9/[0.06] has-[:checked]:shadow-card">
            <input type="radio" name="operator" value="orange" className="sr-only" />
            <span className="mx-auto mb-2 block h-7 w-7 rounded-xl bg-[#FF7900] shadow-insetHair" />
            Orange Money
          </label>
        </div>

        <label className="label-micro mt-5 block after:hidden">
          {fr ? "Ton numéro" : "Your number"}
          <input
            name="phone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="6 77 12 34 56"
            required
            className="mt-2 w-full rounded-2xl border border-ink/10 bg-cream px-4 py-3.5 font-display text-lg tabular-nums tracking-wide shadow-insetHair placeholder:font-sans placeholder:text-sm placeholder:font-bold placeholder:text-ink/30 focus:border-indigo9 focus:outline-none"
          />
        </label>

        <button type="submit" className="btn-mango mt-6 text-sm">
          {fr ? `Confirmer — ${fcfa(order.amount_fcfa)}` : `Confirm — ${fcfa(order.amount_fcfa)}`}
        </button>
        <p className="mt-3 text-center text-[11px] text-inkSoft">
          {fr
            ? "Tu recevras une demande de code PIN sur ton téléphone."
            : "You will receive a PIN request on your phone."}
        </p>
      </form>
    </main>
  );
}
