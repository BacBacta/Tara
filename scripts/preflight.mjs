#!/usr/bin/env node
//
// Pré-vol — à lancer AVANT toute ouverture au public.
//   node scripts/preflight.mjs
//
// Il rend impossible une mise en ligne avec des fournisseurs simulés, des
// secrets d'exemple, un compte de démonstration ou des boutiques de seed.
// Sort en 1 dès qu'un contrôle échoue ; scripts/deploy.sh s'arrête alors
// avant de redémarrer le service.
//
// Il affiche TOUS les problèmes, pas seulement le premier : corriger un
// réglage à la fois, en redéployant entre chaque, serait une perte de temps.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { scryptSync, timingSafeEqual } from "node:crypto";
import { isPostgresUrl } from "./sql-portable.mjs";
import {
  MOTS_DE_PASSE_DEMO,
  SLUGS_DEMO,
  trier,
  verifierEnv,
  verifierPaiementAgregateur,
  verifierPagesLegales,
} from "./preflight-checks.mjs";

const PAGES_LEGALES = [
  "src/app/cgu/page.tsx",
  "src/app/mentions-legales/page.tsx",
  "src/app/confidentialite/page.tsx",
];

/** Même vérification que src/lib/admin.ts (format « sel:empreinte »). */
function motDePasseValide(motDePasse, stocke) {
  const [sel, empreinte] = String(stocke).split(":");
  if (!sel || !empreinte) return false;
  const a = Buffer.from(empreinte, "hex");
  const b = scryptSync(motDePasse, sel, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function lireBase(url) {
  if (isPostgresUrl(url)) {
    const { default: pg } = await import("pg");
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    try {
      const admins = await client.query("SELECT email, password_hash FROM admin_users");
      const shops = await client.query("SELECT slug, payment_mode FROM shops");
      return {
        admins: admins.rows,
        slugs: shops.rows.map((r) => r.slug),
        agregateur: shops.rows.filter((r) => r.payment_mode === "agregateur").map((r) => r.slug),
      };
    } finally {
      await client.end();
    }
  }
  const { default: Database } = await import("better-sqlite3");
  const db = new Database(url.replace(/^file:/, ""), { readonly: true });
  try {
    const shops = db.prepare("SELECT slug, payment_mode FROM shops").all();
    return {
      admins: db.prepare("SELECT email, password_hash FROM admin_users").all(),
      slugs: shops.map((r) => r.slug),
      agregateur: shops.filter((r) => r.payment_mode === "agregateur").map((r) => r.slug),
    };
  } finally {
    db.close();
  }
}

async function main() {
  const problemes = [];

  // 1) environnement
  problemes.push(...verifierEnv(process.env));

  // 2) pages légales
  const fichiers = PAGES_LEGALES.filter((p) => existsSync(join(process.cwd(), p))).map((p) => ({
    chemin: p,
    contenu: readFileSync(join(process.cwd(), p), "utf8"),
  }));
  problemes.push(...verifierPagesLegales(fichiers));

  // 3) base de données
  const url = process.env.DATABASE_URL;
  if (url) {
    try {
      const { admins, slugs, agregateur } = await lireBase(url);

      const soucisPaiement = verifierPaiementAgregateur(
        process.env.PAYMENT_PROVIDER,
        agregateur
      );
      if (soucisPaiement) problemes.push(soucisPaiement);

      if (admins.length === 0) {
        problemes.push({
          code: "admin_absent",
          bloquant: true,
          message:
            "Aucun compte administrateur : le back-office serait inaccessible. " +
            "Créez-en un avec node scripts/create-admin.mjs <email> '<mot de passe fort>'.",
        });
      }
      for (const a of admins) {
        const faible = MOTS_DE_PASSE_DEMO.find((m) => motDePasseValide(m, a.password_hash));
        if (faible) {
          problemes.push({
            code: "admin_demo",
            bloquant: true,
            message:
              `Le compte ${a.email} accepte encore un mot de passe de démonstration. ` +
              "Changez-le immédiatement : le back-office suspend des boutiques et active des abonnements.",
          });
        }
      }

      const demo = slugs.filter((s) => SLUGS_DEMO.includes(s));
      if (demo.length > 0) {
        problemes.push({
          code: "boutiques_demo",
          bloquant: true,
          message:
            `Boutiques de démonstration encore en base : ${demo.join(", ")}. ` +
            "Elles seraient publiques, indexées et listées dans le sitemap.",
        });
      }
    } catch (e) {
      problemes.push({
        code: "base_injoignable",
        bloquant: true,
        message: `Base de données injoignable : ${e.message}`,
      });
    }
  }

  // Rapport
  const { bloquants, avertissements } = trier(problemes);

  if (avertissements.length > 0) {
    console.warn(`\n\x1b[33m⚠ ${avertissements.length} avertissement(s) — non bloquant(s) :\x1b[0m\n`);
    for (const p of avertissements) console.warn(`  • [${p.code}] ${p.message}\n`);
  }

  if (bloquants.length === 0) {
    console.log("\x1b[32m✓ Pré-vol : rien ne bloque la mise en production.\x1b[0m");
    console.log("  Rappel : la checklist humaine du README reste à faire (voir « Pré-vol »).");
    process.exit(0);
  }

  console.error(
    `\n\x1b[31m✗ Pré-vol : ${bloquants.length} problème(s) bloquant(s) — mise en production REFUSÉE.\x1b[0m\n`
  );
  for (const p of bloquants) console.error(`  • [${p.code}] ${p.message}\n`);
  console.error("Corrigez tout ce qui précède, puis relancez le déploiement.\n");
  process.exit(1);
}

main().catch((e) => {
  console.error("Pré-vol : erreur inattendue —", e);
  process.exit(1);
});
