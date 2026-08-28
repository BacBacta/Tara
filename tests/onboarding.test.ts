// L'onboarding vendeuse : c'est l'entonnoir qui crée les boutiques.
// Ces tests verrouillent ce qui doit rester vrai après la refonte visuelle :
// des formulaires natifs (R2), aucune promesse financière (R1), et des textes
// qui disent la vérité du code (durée du code OTP, lien définitif).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const ECRANS = {
  "étape 1 — numéro": "src/app/creer/page.tsx",
  "étape 1 bis — code": "src/app/creer/verifier/page.tsx",
  "étape 2 — boutique": "src/app/creer/boutique/page.tsx",
  "étape 3 — article": "src/app/creer/article/page.tsx",
} as const;

const SOURCES_CREER = [
  ...Object.values(ECRANS),
  "src/app/creer/fini/page.tsx",
  "src/components/Onboarding.tsx",
];

describe("onboarding sans JavaScript (R2)", () => {
  for (const [nom, chemin] of Object.entries(ECRANS)) {
    it(`${nom} : soumet par formulaire POST natif`, () => {
      const src = lire(chemin);
      expect(src).toMatch(/<form\s+method="post"/);
      expect(src).toMatch(/action="\/creer\//);
      // aucun envoi par JavaScript, aucun état client dans la page elle-même
      expect(src).not.toContain("use client");
      expect(src).not.toContain("fetch(");
      expect(src).not.toContain("onSubmit");
    });
  }

  it("la photo du premier article part en multipart, sans JavaScript", () => {
    const src = lire(ECRANS["étape 3 — article"]);
    expect(src).toContain('encType="multipart/form-data"');
    expect(src).toContain('type="file"');
  });

  it("l'aperçu du lien reste un confort : le champ marche sans lui", () => {
    const src = lire("src/components/NameSlugField.tsx");
    // le champ porte un name : il part avec le formulaire même sans hydratation
    expect(src).toMatch(/name="name"/);
    expect(src).toContain("required");
  });
});

describe("onboarding et R1 — aucune promesse financière", () => {
  const INTERDITS = [/garanti/i, /rembours/i, /paiement sécurisé/i, /argent bloqué/i, /séquestre/i];

  for (const chemin of SOURCES_CREER) {
    it(`${chemin} ne promet rien que Tara ne tient pas`, () => {
      const src = lire(chemin);
      for (const interdit of INTERDITS) expect(src).not.toMatch(interdit);
    });
  }

  it("le premier écran dit au contraire que Tara ne touche pas l'argent", () => {
    expect(lire(ECRANS["étape 1 — numéro"])).toContain("Tara ne touche jamais ton argent");
  });
});

describe("les textes disent la vérité du code", () => {
  it("la durée annoncée du code est celle du code", () => {
    const ttl = /OTP_TTL_MIN = (\d+)/.exec(lire("src/lib/otp.ts"))?.[1];
    expect(ttl).toBe("10");
    expect(lire(ECRANS["étape 1 bis — code"])).toContain(`valable ${ttl} minutes`);
  });

  it("le lien est annoncé définitif — et rien ne permet de le changer", () => {
    expect(lire(ECRANS["étape 2 — boutique"])).toContain("ne changera plus");
    // si un jour les réglages modifient le slug, ce test rappellera de
    // corriger la phrase de l'étape 2
    expect(lire("src/app/app/reglages/save/route.ts")).not.toMatch(/\bslug\b/);
  });
});

describe("un seul système visuel", () => {
  it("les écrans passent par le socle partagé, pas par des styles à part", () => {
    for (const chemin of Object.values(ECRANS)) {
      const src = lire(chemin);
      expect(src).toContain("@/components/Onboarding");
      // plus de bouton mango recopié à la main dans chaque page
      expect(src).not.toMatch(/bg-mango px-/);
    }
  });

  it("les classes des champs sont partagées avec le champ client", () => {
    const styles = lire("src/components/ob-styles.ts");
    expect(styles).toContain("inputCls");
    expect(lire("src/components/NameSlugField.tsx")).toContain('from "./ob-styles"');
    // le socle les ré-exporte : les pages n'ont qu'un seul point d'entrée
    expect(lire("src/components/Onboarding.tsx")).toContain('from "./ob-styles"');
  });
});
