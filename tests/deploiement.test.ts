// Lot 5 — garde-fous sur les fichiers de déploiement.
// Ces tests ne remplacent pas un vrai serveur : ils empêchent la dérive
// silencieuse entre la configuration Nginx et celle de l'application.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("configuration Nginx", () => {
  const nginx = lire("deploy/tara.nginx.conf");
  const nextConfig = lire("next.config.mjs");

  it("ne duplique aucun en-tête de sécurité déjà posé par next.config.mjs", () => {
    // Exigence du programme : « des en-têtes cohérents, ne les duplique pas
    // en les contredisant ». Deux CSP concurrentes s'appliqueraient en
    // intersection, cassant l'embed TikTok sans message lisible.
    const entetesApp = [
      "Content-Security-Policy",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Strict-Transport-Security",
    ];
    for (const e of entetesApp) {
      expect(nextConfig).toContain(e); // l'application le pose bien…
      // …donc Nginx ne doit pas le poser une seconde fois
      const ajoutParNginx = new RegExp(`add_header\\s+${e}`, "i");
      expect(nginx).not.toMatch(ajoutParNginx);
    }
  });

  it("transmet X-Forwarded-For, dont dépend le rate limiting", () => {
    // src/lib/ratelimit.ts lit x-forwarded-for : sans cet en-tête, tout le
    // trafic compterait pour une seule IP et le premier visiteur épuiserait
    // le quota de tout le monde.
    expect(lire("src/lib/ratelimit.ts")).toContain("x-forwarded-for");
    expect(nginx).toMatch(/proxy_set_header\s+X-Forwarded-For\s+\$proxy_add_x_forwarded_for/i);
  });

  it("accepte des photos d'articles assez grandes", () => {
    expect(nginx).toMatch(/client_max_body_size\s+10M/i);
  });

  it("redirige HTTP vers HTTPS", () => {
    expect(nginx).toMatch(/return\s+301\s+https:\/\//);
  });
});

describe("script de déploiement", () => {
  const deploy = lire("scripts/deploy.sh");

  it("s'arrête à la première erreur", () => {
    expect(deploy).toMatch(/set -euo pipefail/);
  });

  it("migre AVANT de redémarrer, jamais l'inverse", () => {
    const posMigration = deploy.indexOf("db:migrate");
    const posRedemarrage = deploy.indexOf("systemctl restart");
    expect(posMigration).toBeGreaterThan(-1);
    expect(posRedemarrage).toBeGreaterThan(-1);
    // Avec « set -e », une migration en échec arrête le script : le service
    // n'est jamais redémarré sur un schéma à moitié migré.
    expect(posMigration).toBeLessThan(posRedemarrage);
  });

  it("vérifie la santé du service après redémarrage", () => {
    expect(deploy).toContain("/api/sante");
  });
});

describe("unité systemd", () => {
  const unit = lire("deploy/tara.service");

  it("tourne sous un utilisateur non privilégié", () => {
    expect(unit).toMatch(/^User=tara$/m);
    expect(unit).not.toMatch(/^User=root$/m);
  });

  it("garde les secrets hors du dépôt", () => {
    expect(unit).toMatch(/EnvironmentFile=\/etc\/tara\/tara\.env/);
  });

  it("redémarre automatiquement", () => {
    expect(unit).toMatch(/^Restart=always$/m);
  });

  it("laisse Node compiler son JIT", () => {
    // MemoryDenyWriteExecute=true empêcherait le processus de démarrer.
    expect(unit).toMatch(/^MemoryDenyWriteExecute=false$/m);
  });

  it("place StartLimit* dans [Unit], pas dans [Service]", () => {
    // systemd >= 229 ignore ces clés dans [Service] — vérifié par
    // « systemd-analyze verify », qui les signalait comme inconnues.
    // On ancre sur un début de ligne : les commentaires du fichier
    // mentionnent « [Service] » en toutes lettres, et un indexOf naïf
    // couperait la section au milieu d'un commentaire.
    const debutService = unit.search(/^\[Service\]$/m);
    const unitSection = unit.slice(unit.search(/^\[Unit\]$/m), debutService);
    expect(unitSection).toMatch(/StartLimitIntervalSec=/);
    expect(unitSection).toMatch(/StartLimitBurst=/);
  });
});
