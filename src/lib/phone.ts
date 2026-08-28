// Le numéro camerounais, en un seul endroit.
// Il était défini dans payments.ts, que orders.ts ne peut pas importer
// (payments.ts importe déjà orders.ts). Sorti ici, il sert aux deux.
import { z } from "zod";

/** Mobile camerounais : 6XXXXXXXX, normalisé avec le préfixe 237. */
export const phoneCm = z
  .string()
  .transform((s) => s.replace(/[^0-9]/g, ""))
  .refine((s) => /^(237)?6\d{8}$/.test(s), "numéro camerounais invalide")
  .transform((s) => (s.startsWith("237") ? s : `237${s}`));
