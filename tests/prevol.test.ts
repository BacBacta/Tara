// Lot 6 — le pré-vol. Ces contrôles gardent l'ouverture au public : s'ils se
// mettent à passer alors qu'ils ne devraient pas, un site de démonstration
// part en production. D'où des tests sur les DEUX sens.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MOTS_DE_PASSE_DEMO,
  SLUGS_DEMO,
  VALEURS_EXEMPLE,
  verifierEnv,
  verifierPagesLegales,
  verifierPaiementAgregateur,
} from "../scripts/preflight-checks.mjs";

/** Un environnement de production correct : aucun problème attendu. */
const ENV_SAIN = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://tara:mdp@localhost:5432/tara",
  NEXT_PUBLIC_BASE_URL: "https://tara.shop",
  SESSION_SECRET: "a".repeat(64),
  PAYMENT_WEBHOOK_SECRET: "secret-partage-avec-l-agregateur",
  PAYMENT_PROVIDER: "simiz",
  OTP_PROVIDER: "sms",
  NOTIFY_PROVIDER: "sms",
  TIKTOK_PROVIDER: "real",
  TIKTOK_WEBHOOK_SECRET: "secret-tiktok",
  SMS_API_URL: "https://sms.example.cm/v1/send",
  SMS_API_KEY: "cle",
  PAYMENT_MOCK_AUTOCONFIRM: "",
};

const codes = (env: Record<string, string>) => verifierEnv(env).map((p) => p.code);
const bloquants = (env: Record<string, string>) =>
  verifierEnv(env).filter((p) => p.bloquant !== false).map((p) => p.code);

describe("pré-vol — environnement", () => {
  it("un environnement de production correct ne bloque rien", () => {
    expect(bloquants(ENV_SAIN)).toEqual([]);
  });

  it("bloque sur un OTP ou des notifications simulés (R5)", () => {
    // OTP simulé = les codes s'affichent à l'écran : prise de compte triviale.
    // Notifications simulées = plus aucun SMS, donc plus aucune inscription.
    for (const cle of ["OTP_PROVIDER", "NOTIFY_PROVIDER"]) {
      expect(bloquants({ ...ENV_SAIN, [cle]: "mock" })).toContain(`provider_${cle}`);
    }
  });

  it("signale sans bloquer un paiement ou un TikTok simulés", () => {
    // Ces deux fournisseurs dépendent de démarches reportées après le pilote
    // (contrat agrégateur, app TikTok validée). Les rendre bloquants
    // interdirait tout lancement. Le mock de paiement redevient bloquant
    // dans preflight.mjs si une boutique encaisse via l'agrégateur.
    for (const cle of ["PAYMENT_PROVIDER", "TIKTOK_PROVIDER"]) {
      expect(codes({ ...ENV_SAIN, [cle]: "mock" })).toContain(`provider_${cle}`);
      expect(bloquants({ ...ENV_SAIN, [cle]: "mock" })).not.toContain(`provider_${cle}`);
    }
  });

  it("refuse l'auto-confirmation des paiements", () => {
    expect(codes({ ...ENV_SAIN, PAYMENT_MOCK_AUTOCONFIRM: "1" })).toContain("mock_autoconfirm");
  });

  it("refuse un SESSION_SECRET faible, vide ou d'exemple", () => {
    expect(codes({ ...ENV_SAIN, SESSION_SECRET: "" })).toContain("session_secret");
    expect(codes({ ...ENV_SAIN, SESSION_SECRET: "trop-court" })).toContain("session_secret");
    // Piège : la valeur d'exemple fait 38 caractères, la seule longueur ne suffit pas.
    const exemple = "change-me-32-characters-minimum-secret";
    expect(exemple.length).toBeGreaterThanOrEqual(32);
    expect(VALEURS_EXEMPLE.has(exemple)).toBe(true);
    expect(codes({ ...ENV_SAIN, SESSION_SECRET: exemple })).toContain("session_secret");
  });

  it("refuse un secret de webhook vide ou d'exemple", () => {
    expect(codes({ ...ENV_SAIN, PAYMENT_WEBHOOK_SECRET: "" })).toContain("webhook_paiement");
    expect(codes({ ...ENV_SAIN, PAYMENT_WEBHOOK_SECRET: "change-me-webhook-secret" }))
      .toContain("webhook_paiement");
  });

  it("n'exige le secret TikTok que si le fournisseur TikTok est réel", () => {
    expect(codes({ ...ENV_SAIN, TIKTOK_PROVIDER: "mock", TIKTOK_WEBHOOK_SECRET: "" }))
      .not.toContain("webhook_tiktok");
    expect(codes({ ...ENV_SAIN, TIKTOK_PROVIDER: "real", TIKTOK_WEBHOOK_SECRET: "" }))
      .toContain("webhook_tiktok");
  });

  it("refuse une URL publique locale ou non chiffrée", () => {
    expect(codes({ ...ENV_SAIN, NEXT_PUBLIC_BASE_URL: "http://localhost:3000" })).toContain("base_url");
    expect(codes({ ...ENV_SAIN, NEXT_PUBLIC_BASE_URL: "http://127.0.0.1:3000" })).toContain("base_url");
    expect(codes({ ...ENV_SAIN, NEXT_PUBLIC_BASE_URL: "http://tara.shop" })).toContain("base_url");
  });

  it("refuse SQLite en production", () => {
    expect(codes({ ...ENV_SAIN, DATABASE_URL: "file:./dev.db" })).toContain("database_url");
  });

  it("refuse une passerelle SMS sélectionnée mais non configurée", () => {
    // Sans canal d'OTP, aucune vendeuse ne peut créer son compte : l'échec
    // serait silencieux et le pilote entier bloqué.
    expect(codes({ ...ENV_SAIN, SMS_API_KEY: "" })).toContain("sms_incomplet");
    expect(codes({ ...ENV_SAIN, NOTIFY_PROVIDER: "whatsapp_cloud" })).toContain("whatsapp_incomplet");
  });

  it("accepte la configuration WhatsApp de production complète", () => {
    expect(bloquants({
      ...ENV_SAIN,
      NOTIFY_PROVIDER: "whatsapp_cloud",
      OTP_PROVIDER: "whatsapp",
      WHATSAPP_PHONE_NUMBER_ID: "123456789",
      WHATSAPP_ACCESS_TOKEN: "jeton-reel",
    })).toEqual([]);
  });

  it("refuse un OTP réel dont le canal de notifications est simulé", () => {
    // OTP_PROVIDER=whatsapp délègue à NOTIFY_PROVIDER : si celui-ci est mock,
    // les codes ne partent sur aucun canal réel.
    const env = { ...ENV_SAIN, OTP_PROVIDER: "whatsapp", NOTIFY_PROVIDER: "mock" };
    expect(codes(env)).toContain("otp_sans_canal");
  });

  it("refuse NODE_ENV autre que production", () => {
    expect(codes({ ...ENV_SAIN, NODE_ENV: "development" })).toContain("node_env");
  });
});

describe("pré-vol — paiement simulé et mode agrégateur", () => {
  it("tolère le mock si toutes les boutiques encaissent en direct", () => {
    expect(verifierPaiementAgregateur("mock", [])).toBeNull();
  });

  it("BLOQUE dès qu'une boutique attend une confirmation d'agrégateur", () => {
    // Sinon ses commandes passeraient en « payée » sans qu'un franc
    // soit versé à la vendeuse.
    const p = verifierPaiementAgregateur("mock", ["boutique-agregateur"]);
    expect(p?.bloquant).toBe(true);
    expect(p?.message).toContain("boutique-agregateur");
    expect(verifierPaiementAgregateur(undefined, ["x"])?.bloquant).toBe(true);
  });

  it("ne dit rien si un vrai agrégateur est branché", () => {
    expect(verifierPaiementAgregateur("simiz", ["boutique-agregateur"])).toBeNull();
  });
});

describe("pré-vol — pages légales", () => {
  it("détecte le composant <Todo>, pas seulement le texte en clair", () => {
    // Les pages n'écrivent jamais « [À COMPLÉTER] » littéralement : elles
    // utilisent <Todo>. Un contrôle qui ne cherchait que le texte ne
    // détectait rien — c'est le défaut qui a été corrigé.
    const avecTodo = { chemin: "cgu.tsx", contenu: "<p>Siège : <Todo>adresse</Todo></p>" };
    expect(verifierPagesLegales([avecTodo])).toHaveLength(1);
    const enClair = { chemin: "x.tsx", contenu: "raison sociale [À COMPLÉTER]" };
    expect(verifierPagesLegales([enClair])).toHaveLength(1);
    const complet = { chemin: "ok.tsx", contenu: "<p>Siège : Douala, Cameroun</p>" };
    expect(verifierPagesLegales([complet])).toEqual([]);
  });

  it("les pages légales du dépôt sont encore incomplètes — et le pré-vol le voit", () => {
    // Ce test tombera le jour où MIKE aura complété les mentions légales.
    // Ce jour-là, remplacez-le par l'assertion inverse.
    const pages = [
      "src/app/cgu/page.tsx",
      "src/app/mentions-legales/page.tsx",
      "src/app/confidentialite/page.tsx",
    ].map((p) => ({ chemin: p, contenu: readFileSync(join(process.cwd(), p), "utf8") }));
    expect(verifierPagesLegales(pages)).toHaveLength(3);
  });
});

describe("pré-vol — constantes de démonstration", () => {
  it("connaît le mot de passe admin créé par le seed", () => {
    const seed = readFileSync(join(process.cwd(), "scripts/seed.mjs"), "utf8");
    const trouve = MOTS_DE_PASSE_DEMO.find((m) => seed.includes(`"${m}"`) || seed.includes(`'${m}'`));
    expect(trouve).toBeTruthy(); // sinon le pré-vol laisserait passer le compte de démo
  });

  it("connaît les slugs des boutiques du seed", () => {
    const seed = readFileSync(join(process.cwd(), "scripts/seed.mjs"), "utf8");
    for (const slug of SLUGS_DEMO) expect(seed).toContain(slug);
  });
});

describe("pré-vol — intégration", () => {
  it("est branché dans deploy.sh AVANT le redémarrage", () => {
    const deploy = readFileSync(join(process.cwd(), "scripts/deploy.sh"), "utf8");
    const posPrevol = deploy.indexOf("preflight.mjs");
    const posRedemarrage = deploy.indexOf("systemctl restart");
    expect(posPrevol).toBeGreaterThan(-1);
    expect(posPrevol).toBeLessThan(posRedemarrage);
  });

  it("le seed refuse de tourner sur une base PostgreSQL ou en production", () => {
    // db:seed fait un DELETE sur toutes les tables : lancé par mégarde sur la
    // production, il effacerait boutiques, commandes et abonnements.
    const seed = readFileSync(join(process.cwd(), "scripts/seed.mjs"), "utf8");
    expect(seed).toContain('NODE_ENV === "production"');
    expect(seed).toMatch(/postgres/);
  });

  it("create-admin sait écrire dans PostgreSQL", () => {
    // La procédure de déploiement du README l'exécute contre la production :
    // câblé sur SQLite, il échouait.
    const s = readFileSync(join(process.cwd(), "scripts/create-admin.mjs"), "utf8");
    expect(s).toContain("isPostgresUrl");
    expect(s).toContain("INSERT INTO admin_users (id,email,password_hash,role) VALUES ($1,$2,$3,'admin')");
  });
});
