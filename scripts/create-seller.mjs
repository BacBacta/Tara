#!/usr/bin/env node
//
// Crée une vendeuse et sa boutique, sans passer par l'OTP :
//   node scripts/create-seller.mjs <téléphone> "<nom de la boutique>" <ville> [langue]
//   node scripts/create-seller.mjs 677123456 "Nadia Friperie" Douala fr
//
// POURQUOI CE SCRIPT EXISTE : l'inscription normale passe par un code SMS,
// et tant que la passerelle SMS n'est pas sous contrat, aucune vendeuse ne
// peut créer son compte. Ce script permet de recruter les dix premières
// pilotes à la main. La vendeuse se connecte ensuite normalement : dès que
// la passerelle SMS existe, l'OTP arrive sur le numéro enregistré ici.
//
// Il reflète exactement l'onboarding (src/app/creer/) : mêmes règles de
// slug, de téléphone, mêmes valeurs par défaut. Bi-dialecte SQLite /
// PostgreSQL, comme create-admin.mjs.
import { isPostgresUrl } from "./sql-portable.mjs";
import { normalizePhoneCm, slugCandidates } from "./seller-utils.mjs";

const [phoneArg, name, city, langArg] = process.argv.slice(2);
if (!phoneArg || !name || !city) {
  console.error('Usage: node scripts/create-seller.mjs <téléphone> "<nom boutique>" <ville> [fr|en]');
  process.exit(1);
}

const phone = normalizePhoneCm(phoneArg);
if (!phone) {
  console.error(`Téléphone invalide : « ${phoneArg} » — attendu un mobile camerounais (6XXXXXXXX).`);
  process.exit(1);
}
if (name.trim().length < 3 || name.trim().length > 60) {
  console.error("Nom de boutique : entre 3 et 60 caractères (comme dans l'onboarding).");
  process.exit(1);
}
if (city.trim().length < 2 || city.trim().length > 40) {
  console.error("Ville : entre 2 et 40 caractères.");
  process.exit(1);
}
const lang = langArg === "en" ? "en" : "fr";
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

/** Les mêmes 4 requêtes dans les deux dialectes, derrière une petite façade. */
async function ouvrir() {
  if (isPostgresUrl(url)) {
    const { default: pg } = await import("pg");
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    return {
      sellerByPhone: async (p) =>
        (await client.query("SELECT id, name FROM sellers WHERE phone = $1", [p])).rows[0],
      shopBySeller: async (sid) =>
        (await client.query("SELECT slug FROM shops WHERE seller_id = $1", [sid])).rows[0],
      slugTaken: async (s) =>
        (await client.query("SELECT id FROM shops WHERE slug = $1", [s])).rows.length > 0,
      insertSeller: (id) =>
        client.query("INSERT INTO sellers (id, phone, name, lang) VALUES ($1,$2,$3,$4)", [id, phone, name.trim(), lang]),
      insertShop: (id, sellerId, slug) =>
        client.query(
          "INSERT INTO shops (id, seller_id, slug, name, city, plan_expires_at) VALUES ($1,$2,$3,$4,$5,NULL)",
          [id, sellerId, slug, name.trim(), city.trim()]
        ),
      fermer: () => client.end(),
    };
  }
  const { default: Database } = await import("better-sqlite3");
  const db = new Database(url.replace(/^file:/, ""));
  return {
    sellerByPhone: async (p) => db.prepare("SELECT id, name FROM sellers WHERE phone = ?").get(p),
    shopBySeller: async (sid) => db.prepare("SELECT slug FROM shops WHERE seller_id = ?").get(sid),
    slugTaken: async (s) => db.prepare("SELECT id FROM shops WHERE slug = ?").get(s) !== undefined,
    insertSeller: async (id) =>
      db.prepare("INSERT INTO sellers (id, phone, name, lang) VALUES (?,?,?,?)").run(id, phone, name.trim(), lang),
    insertShop: async (id, sellerId, slug) =>
      db.prepare("INSERT INTO shops (id, seller_id, slug, name, city, plan_expires_at) VALUES (?,?,?,?,?,NULL)")
        .run(id, sellerId, slug, name.trim(), city.trim()),
    fermer: async () => db.close(),
  };
}

const dao = await ouvrir();
try {
  // Une vendeuse existe par son téléphone ; une boutique par vendeuse.
  let seller = await dao.sellerByPhone(phone);
  if (seller) {
    const shop = await dao.shopBySeller(seller.id);
    if (shop) {
      console.error(`Ce numéro a déjà une boutique : ${base}/${shop.slug}`);
      console.error("Rien n'a été modifié.");
      process.exit(1);
    }
    console.log(`Vendeuse existante (${phone}) — création de sa boutique seulement.`);
  } else {
    seller = { id: newId() };
    await dao.insertSeller(seller.id);
  }

  let slug = null;
  for (const candidat of slugCandidates(name)) {
    if (!(await dao.slugTaken(candidat))) { slug = candidat; break; }
  }
  if (!slug) {
    console.error("Impossible de trouver un slug libre pour ce nom.");
    process.exit(1);
  }

  await dao.insertShop(newId(), seller.id, slug);

  console.log(`Boutique créée : ${base}/${slug}`);
  console.log(`Connexion vendeuse : ${base}/creer avec le ${phone} (OTP sur ce numéro).`);
  console.log("À faire par la vendeuse : ajouter ses articles, puis son numéro MoMo dans Réglages.");
} finally {
  await dao.fermer();
}
