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
    // Lot 1 — paiement direct. R1 : l'acheteuse paie UNE PERSONNE, pas une
    // plateforme. Aucune de ces chaînes ne promet de garantie ni de recours.
    "pay.directTitle": "Payer la vendeuse",
    "pay.directHowto": "Envoie le montant exact depuis ton téléphone, puis préviens la vendeuse sur WhatsApp.",
    "pay.number": "Numéro à payer",
    "pay.operator": "Opérateur",
    "pay.amount": "Montant exact",
    "pay.orderRef": "N° de commande",
    "pay.directNotice": "Tu envoies l'argent à la vendeuse, sur son propre téléphone. Tara ne touche jamais ton argent.",
    "pay.announce": "J'ai payé — prévenir la vendeuse",
    "pay.announced": "Paiement annoncé",
    "pay.announcedHelp": "La vendeuse vérifie la réception, puis confirme ta commande.",
    "pay.noNumber": "Cette boutique n'a pas encore mis son numéro Mobile Money. Commande sur WhatsApp : la vendeuse t'indiquera comment payer.",
    "pay.backToShop": "Retour à la boutique",
    "legal.terms": "Conditions",
    "legal.privacy": "Confidentialité",
    "legal.notice": "Mentions légales",
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
    // Lot 1 — direct payment. R1: the buyer pays A PERSON, not a platform.
    // None of these strings promises any guarantee or recourse.
    "pay.directTitle": "Pay the seller",
    "pay.directHowto": "Send the exact amount from your phone, then tell the seller on WhatsApp.",
    "pay.number": "Number to pay",
    "pay.operator": "Operator",
    "pay.amount": "Exact amount",
    "pay.orderRef": "Order no",
    "pay.directNotice": "You send the money to the seller, on their own phone. Tara never holds your money.",
    "pay.announce": "I have paid — tell the seller",
    "pay.announced": "Payment announced",
    "pay.announcedHelp": "The seller checks that it arrived, then confirms your order.",
    "pay.noNumber": "This shop has not set its Mobile Money number yet. Order on WhatsApp and the seller will tell you how to pay.",
    "pay.backToShop": "Back to the shop",
    "legal.terms": "Terms",
    "legal.privacy": "Privacy",
    "legal.notice": "Legal notice",
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
