// Canal d'arrivée d'une visite.
//
// LE PROBLÈME : le kit de partage donne à la vendeuse un lien NU
// (tara.shop/sa-boutique). C'est volontaire — un lien court se recopie mieux
// dans une bio TikTok, et une vendeuse qui le retape à la main ne recopiera
// jamais « ?src=bio ». Conséquence : la source du lien vaut « direct » pour
// la quasi-totalité du trafic réel, et ne dit rien de sa provenance.
//
// LE SIGNAL RÉELLEMENT DISPONIBLE : le navigateur intégré de TikTok s'annonce
// dans le user_agent. C'est le seul indice qui ne dépend pas de ce que la
// vendeuse a bien voulu recopier — et il est déjà stocké dans visits.
//
// C'est une HEURISTIQUE, pas une certitude : elle peut manquer une visite
// (lien ouvert depuis TikTok puis recollé ailleurs) ou changer si TikTok
// modifie son navigateur. L'écran Pilote affiche les user agents réellement
// observés, pour pouvoir corriger cette liste sur la foi de vraies visites.

export const CANAUX = ["tiktok", "whatsapp", "autre"] as const;
export type Canal = (typeof CANAUX)[number];

/** Marqueurs du navigateur intégré de TikTok (ByteDance). */
const TIKTOK_UA = /BytedanceWebview|musical_ly|AppName\/musical_ly|Trill|aweme|TikTok/i;

/** Marqueurs du navigateur intégré de WhatsApp. */
const WHATSAPP_UA = /WhatsApp/i;

/** Sources explicites, quand la vendeuse a gardé le paramètre du lien. */
const TIKTOK_SOURCE = /^(v:|src:(bio|tiktok|tt)$)/i;
const WHATSAPP_SOURCE = /^src:(wa|whatsapp|statut)$/i;

export function detectChannel(
  userAgent: string | null | undefined,
  source: string | null | undefined
): Canal {
  const ua = userAgent ?? "";
  // Le user_agent prime : il ne dépend pas de ce que la vendeuse a recopié.
  if (TIKTOK_UA.test(ua)) return "tiktok";
  if (WHATSAPP_UA.test(ua)) return "whatsapp";

  const src = source ?? "";
  if (TIKTOK_SOURCE.test(src)) return "tiktok";
  if (WHATSAPP_SOURCE.test(src)) return "whatsapp";

  return "autre";
}
