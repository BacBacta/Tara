// i18n minimaliste (équivalent léger à next-intl, choisi pour tenir le budget
// de 200 Ko des vitrines) : dictionnaires typés FR/EN, résolution serveur.
export type Lang = "fr" | "en";

const dict = {
  fr: {
    "shop.sales": "ventes",
    "shop.seenInVideos": "Vu dans mes vidéos",
    "shop.products": "Articles disponibles",
    "shop.orderWhatsApp": "Commander sur WhatsApp",
    "shop.payMomo": "Payer par MoMo",
    "shop.outOfStock": "Rupture de stock",
    "shop.lowStock": "Stock limité",
    "shop.deliveryIn": "Livraison",
    "shop.createdWith": "Boutique créée avec",
    "shop.createYours": "Crée ta boutique gratuite",
    "shop.securePayment": "Tu paies la vendeuse directement — Tara ne touche jamais ton argent",
    "home.tagline": "Ta boutique dans ta bio TikTok. Commandes WhatsApp, paiement Mobile Money.",
    "home.cta": "Créer ma boutique gratuite",
    "home.demo": "Voir une boutique de démo",
  },
  en: {
    "shop.sales": "sales",
    "shop.seenInVideos": "Seen in my videos",
    "shop.products": "Available items",
    "shop.orderWhatsApp": "Order on WhatsApp",
    "shop.payMomo": "Pay with MoMo",
    "shop.outOfStock": "Out of stock",
    "shop.lowStock": "Low stock",
    "shop.deliveryIn": "Delivery",
    "shop.createdWith": "Shop created with",
    "shop.createYours": "Create your free shop",
    "shop.securePayment": "You pay the seller directly — Tara never holds your money",
    "home.tagline": "Your shop in your TikTok bio. WhatsApp orders, Mobile Money payments.",
    "home.cta": "Create my free shop",
    "home.demo": "See a demo shop",
  },
} as const;

export type MsgKey = keyof (typeof dict)["fr"];

export function t(lang: Lang, key: MsgKey): string {
  return dict[lang][key] ?? dict.fr[key];
}

export function normalizeLang(v: string | null | undefined): Lang {
  return v === "en" ? "en" : "fr";
}
