// Le back-office : trois écrans qui n'avaient reçu aucun token du design
// system. Ces tests gardent le cadre commun et la relance des abonnements —
// la question du pilote étant « combien ont repayé une deuxième fois ».
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { joursAvantExpiration } from "@/lib/plan";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const ECRANS = {
  "boutiques": "src/app/admin/page.tsx",
  "pilote": "src/app/admin/pilote/page.tsx",
} as const;

// L'écran de connexion est un plein écran, avant toute session : il n'a ni
// navigation ni identité d'administrateur à afficher.
const CONNEXION = "src/app/admin/login/page.tsx";

describe("un seul cadre pour le back-office", () => {
  for (const [nom, chemin] of Object.entries(ECRANS)) {
    it(`l'écran ${nom} passe par AdminShell`, () => {
      const src = lire(chemin);
      expect(src).toContain("@/components/AdminShell");
      // la navigation et la déconnexion vivent dans le cadre, pas dans la page
      expect(src).not.toContain("/admin/logout");
    });
  }

  it("le cadre porte la marque, la navigation et la sortie", () => {
    const shell = lire("src/components/AdminShell.tsx");
    for (const attendu of ["Wordmark", "/admin/pilote", "/admin/export", "/admin/logout"]) {
      expect(shell).toContain(attendu);
    }
  });

  it("l'écran de connexion utilise le même vocabulaire visuel", () => {
    const src = lire(CONNEXION);
    expect(src).toContain("Wordmark");
    expect(src).toContain("font-display");
    expect(src).toContain('method="post"'); // toujours un formulaire natif
  });

  it("la palette a remplacé les gris génériques", () => {
    for (const chemin of [...Object.values(ECRANS), CONNEXION, "src/components/AdminShell.tsx"]) {
      const src = lire(chemin);
      for (const legacy of ["text-gray-", "border-gray-", "bg-gray-", "bg-indigo-50"]) {
        expect(src, `${chemin} contient ${legacy}`).not.toContain(legacy);
      }
    }
  });

  it("les tableaux partagent une seule définition", () => {
    for (const chemin of Object.values(ECRANS)) {
      expect(lire(chemin)).toContain('className="tbl"');
    }
    expect(lire("src/app/globals.css")).toContain(".tbl {");
  });
});

describe("relance des abonnements", () => {
  const jour = 86_400_000;
  const t0 = Date.parse("2026-08-28T12:00:00Z");

  it("compte les jours restants, même quand la date est déjà passée", () => {
    expect(joursAvantExpiration("2026-09-04T12:00:00Z", t0)).toBe(7);
    expect(joursAvantExpiration("2026-08-28T13:00:00Z", t0)).toBe(1); // dans la journée
    expect(joursAvantExpiration("2026-08-26T12:00:00Z", t0)).toBe(-2);
  });

  it("accepte les deux formats de date stockés", () => {
    // ISO (écrit par JavaScript) et format SQL (écrit par les migrations)
    expect(joursAvantExpiration("2026-08-29T12:00:00.000Z", t0)).toBe(1);
    expect(joursAvantExpiration("2026-08-29T12:00:00Z", t0)).toBe(1);
  });

  it("ne dit rien quand il n'y a pas d'abonnement", () => {
    expect(joursAvantExpiration(null)).toBeNull();
    expect(joursAvantExpiration("pas une date")).toBeNull();
  });

  it("le back-office relance à sept jours ou moins", () => {
    const src = lire(ECRANS["boutiques"]);
    expect(src).toContain("À relancer");
    expect(src).toMatch(/joursAvantExpiration\(s\.plan_expires_at\) \?\? 99\) <= 7/);
    // la relance se fait sur WhatsApp, avec le numéro de la vendeuse
    expect(src).toContain("https://wa.me/${s.seller_phone}");
  });
});
