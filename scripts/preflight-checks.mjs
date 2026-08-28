// Contrôles de pré-vol — fonctions pures, sans accès disque ni réseau, pour
// qu'elles soient testables. L'orchestration et les requêtes en base sont
// dans scripts/preflight.mjs.
//
// Chaque contrôle renvoie un problème { code, message } ou rien. Le message
// doit dire QUOI corriger, pas seulement ce qui ne va pas : ce script est lu
// un soir de mise en production, sous pression.

/** Valeurs d'exemple de .env.example — les laisser telles quelles est une faute. */
export const VALEURS_EXEMPLE = new Set([
  "change-me-32-characters-minimum-secret",
  "change-me-webhook-secret",
  "change-me",
]);

/** Mots de passe de démonstration présents dans le dépôt et la documentation. */
export const MOTS_DE_PASSE_DEMO = ["tara2026", "motdepasse", "admin", "TaraDemo2026!"];

/** Boutiques créées par npm run db:seed — jamais en production. */
export const SLUGS_DEMO = ["nadia-friperie-237", "kev-sneakers"];

// R5 dit : aucun mock en production. Mais tous les mocks ne pèsent pas le
// même poids, et deux d'entre eux dépendent de démarches explicitement
// reportées APRÈS le pilote (contrat agrégateur, app TikTok validée).
// Les traiter tous en bloquants rendrait le lancement impossible.
//
//   bloquant : true  → refus net, le déploiement s'arrête
//   bloquant : false → avertissement affiché, le déploiement continue
//
// Le cas de PAYMENT_PROVIDER est tranché plus finement dans preflight.mjs :
// il devient bloquant SI au moins une boutique est en mode « agregateur »,
// car ses paiements seraient alors confirmés sans qu'un franc soit versé.
const PROVIDERS = [
  ["OTP_PROVIDER", "code de vérification (OTP)", true,
    "les codes s'affichent à l'écran : n'importe qui prendrait le compte d'une vendeuse"],
  ["NOTIFY_PROVIDER", "notifications", true,
    "aucun SMS ne partirait, et aucune vendeuse ne pourrait s'inscrire"],
  ["PAYMENT_PROVIDER", "paiement", false,
    "sans risque tant que toutes les boutiques encaissent en mode direct"],
  ["TIKTOK_PROVIDER", "TikTok", false,
    "sans conséquence : le badge vérifié et l'import de vidéos restent inactifs"],
];

function vide(v) {
  return v === undefined || v === null || String(v).trim() === "";
}

/** Contrôles portant uniquement sur l'environnement. */
export function verifierEnv(env) {
  const problemes = [];
  const ajouter = (code, message, bloquant = true) =>
    problemes.push({ code, message, bloquant });

  if (env.NODE_ENV !== "production") {
    ajouter(
      "node_env",
      `NODE_ENV vaut « ${env.NODE_ENV ?? "(vide)"} » — ce script garde une mise en production. Attendu : production.`
    );
  }

  // R5 — les mocks ne partent jamais en production.
  for (const [cle, quoi, bloquant, consequence] of PROVIDERS) {
    const v = env[cle];
    if (vide(v) || v === "mock") {
      ajouter(
        `provider_${cle}`,
        `${cle} vaut « ${v ?? "(vide)"} » : le fournisseur ${quoi} est simulé — ${consequence}.`,
        bloquant
      );
    }
  }

  if (!vide(env.PAYMENT_MOCK_AUTOCONFIRM)) {
    ajouter(
      "mock_autoconfirm",
      "PAYMENT_MOCK_AUTOCONFIRM n'est pas vide : les paiements seraient validés " +
        "sans qu'un franc soit versé. Videz cette variable."
    );
  }

  // Abonnement : sans agrégateur, la vendeuse paie sur le portefeuille MoMo
  // de Tara. Si ce numéro manque, elle n'a AUCUN moyen de payer — et
  // l'abonnement est la seule recette du produit.
  const agregateur = !vide(env.PAYMENT_PROVIDER) && env.PAYMENT_PROVIDER !== "mock";
  if (!agregateur && vide(env.TARA_MOMO_NUMBER)) {
    ajouter(
      "abonnement_sans_moyen",
      "Aucun agrégateur et TARA_MOMO_NUMBER est vide : une vendeuse qui veut " +
        "s'abonner n'a aucun moyen de payer. Renseignez le portefeuille MoMo de Tara."
    );
  }

  // Session
  const secret = env.SESSION_SECRET;
  if (vide(secret)) {
    ajouter("session_secret", "SESSION_SECRET est vide : les sessions ne peuvent pas être signées.");
  } else if (VALEURS_EXEMPLE.has(secret)) {
    ajouter(
      "session_secret",
      "SESSION_SECRET vaut encore la valeur d'exemple de .env.example. " +
        "Générez-en un : node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  } else if (secret.length < 32) {
    ajouter(
      "session_secret",
      `SESSION_SECRET ne fait que ${secret.length} caractères ; il en faut au moins 32.`
    );
  }

  // Secrets de webhook
  const whPaiement = env.PAYMENT_WEBHOOK_SECRET;
  if (vide(whPaiement) || VALEURS_EXEMPLE.has(whPaiement)) {
    ajouter(
      "webhook_paiement",
      "PAYMENT_WEBHOOK_SECRET est vide ou reste à sa valeur d'exemple : " +
        "n'importe qui pourrait déclarer une commande payée."
    );
  }
  // Le secret TikTok n'a de sens que si le fournisseur TikTok est réel.
  if (env.TIKTOK_PROVIDER && env.TIKTOK_PROVIDER !== "mock") {
    const whTikTok = env.TIKTOK_WEBHOOK_SECRET;
    if (vide(whTikTok) || VALEURS_EXEMPLE.has(whTikTok)) {
      ajouter(
        "webhook_tiktok",
        "TIKTOK_PROVIDER est réel mais TIKTOK_WEBHOOK_SECRET est vide ou d'exemple."
      );
    }
  }

  // URL publique
  const base = env.NEXT_PUBLIC_BASE_URL;
  if (vide(base)) {
    ajouter("base_url", "NEXT_PUBLIC_BASE_URL est vide : les liens de partage et les QR codes seraient cassés.");
  } else if (/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(base)) {
    ajouter(
      "base_url",
      `NEXT_PUBLIC_BASE_URL pointe encore sur « ${base} » : les liens envoyés aux acheteuses ne mèneraient nulle part.`
    );
  } else if (!base.startsWith("https://")) {
    ajouter("base_url", `NEXT_PUBLIC_BASE_URL (« ${base} ») devrait être en https:// en production.`);
  }

  // Base de données — le lot 4 impose PostgreSQL avant l'ouverture.
  const dbUrl = env.DATABASE_URL;
  if (vide(dbUrl)) {
    ajouter("database_url", "DATABASE_URL est vide.");
  } else if (!/^postgres(ql)?:\/\//.test(dbUrl)) {
    ajouter(
      "database_url",
      "DATABASE_URL n'est pas une URL PostgreSQL. SQLite ne tient pas la charge " +
        "multi-utilisateurs (verrou global en écriture) : basculez avant d'ouvrir."
    );
  }

  // Un fournisseur déclaré mais non configuré échouerait silencieusement —
  // et sans canal d'OTP, aucune vendeuse ne peut créer son compte.
  const notify = env.NOTIFY_PROVIDER;
  const otp = env.OTP_PROVIDER;
  if (notify === "sms") {
    if (vide(env.SMS_API_URL) || vide(env.SMS_API_KEY)) {
      ajouter(
        "sms_incomplet",
        "La passerelle SMS est sélectionnée mais SMS_API_URL ou SMS_API_KEY est vide : " +
          "aucun code de vérification ne partirait, et aucune vendeuse ne pourrait s'inscrire."
      );
    }
  }
  if (notify === "whatsapp_cloud") {
    if (vide(env.WHATSAPP_PHONE_NUMBER_ID) || vide(env.WHATSAPP_ACCESS_TOKEN)) {
      ajouter(
        "whatsapp_incomplet",
        "NOTIFY_PROVIDER vaut whatsapp_cloud mais WHATSAPP_PHONE_NUMBER_ID ou " +
          "WHATSAPP_ACCESS_TOKEN est vide : rien ne partirait, OTP compris."
      );
    }
  }
  // L'OTP réel (sms ou whatsapp) DÉLÈGUE au canal de notifications : il n'a
  // pas de configuration propre, mais il exige que ce canal soit réel.
  if (!vide(otp) && otp !== "mock" && (vide(notify) || notify === "mock")) {
    ajouter(
      "otp_sans_canal",
      `OTP_PROVIDER vaut « ${otp} » mais NOTIFY_PROVIDER est simulé ou vide : ` +
        "les codes de connexion ne partiraient sur aucun canal réel."
    );
  }

  // Stockage des photos : un fournisseur annonce mais non configure ferait
  // echouer chaque photo — l'article se creerait sans elle.
  if (env.STORAGE_PROVIDER === "vercel_blob" && vide(env.BLOB_READ_WRITE_TOKEN)) {
    ajouter(
      "stockage_incomplet",
      "STORAGE_PROVIDER vaut vercel_blob mais BLOB_READ_WRITE_TOKEN est vide : " +
        "aucune photo d'article ne serait enregistrée."
    );
  }

  return problemes;
}

/**
 * Contrôle des pages légales : les marqueurs [À COMPLÉTER] posés au lot 3
 * signalent une information que seul MIKE peut fournir (RCCM, siège,
 * hébergeur…). Ouvrir avec ces marqueurs visibles serait embarrassant, et
 * juridiquement inutile.
 */
export function verifierPagesLegales(fichiers) {
  const problemes = [];
  for (const { chemin, contenu } of fichiers) {
    // Les pages n'écrivent pas le texte en clair : elles utilisent le
    // composant <Todo> de LegalPage.tsx, qui l'affiche surligné. Chercher
    // seulement « [À COMPLÉTER] » ne détectait donc rien.
    if (
      contenu.includes("A_COMPLETER") ||
      contenu.includes("[À COMPLÉTER]") ||
      /<Todo[\s>]/.test(contenu)
    ) {
      problemes.push({
        code: `legal_${chemin}`,
        message:
          `${chemin} contient encore des marqueurs [À COMPLÉTER] : raison sociale, ` +
          "RCCM, siège, hébergeur ou contact manquent. Ils s'affichent, surlignés, aux visiteurs.",
      });
    }
  }
  return problemes;
}

/**
 * Le mock de paiement n'est tolérable que si AUCUNE boutique n'attend une
 * confirmation d'agrégateur : sinon ses commandes passeraient en « payée »
 * sans qu'un franc soit versé. C'est le contrôle le plus critique du pré-vol.
 */
export function verifierPaiementAgregateur(paymentProvider, slugsAgregateur) {
  const simule = vide(paymentProvider) || paymentProvider === "mock";
  if (!simule || slugsAgregateur.length === 0) return null;
  return {
    code: "paiement_mock_agregateur",
    bloquant: true,
    message:
      `PAYMENT_PROVIDER est simulé alors que ${slugsAgregateur.length} boutique(s) ` +
      `encaissent via l'agrégateur (${slugsAgregateur.join(", ")}) : leurs commandes ` +
      "seraient marquées payées sans versement. Branchez l'agrégateur, ou " +
      "repassez ces boutiques en mode direct.",
  };
}

/** Sépare ce qui bloque de ce qui mérite seulement d'être signalé. */
export function trier(problemes) {
  return {
    bloquants: problemes.filter((p) => p.bloquant !== false),
    avertissements: problemes.filter((p) => p.bloquant === false),
  };
}
