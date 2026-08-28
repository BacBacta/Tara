// Crée ou met à jour un administrateur :
//   node scripts/create-admin.mjs <email> <motdepasse>
//
// Sur un hébergement sans shell (Vercel), il n'y a personne pour taper cette
// commande : le compte se crée alors AU BUILD, à partir de ADMIN_EMAIL et
// ADMIN_PASSWORD. Sans arguments ni variables, le script ne fait rien et
// rend la main — il peut donc rester dans la commande de build sans risque.
//
// Fonctionne sur SQLite (développement) et PostgreSQL (production), le
// dialecte étant déduit de DATABASE_URL — comme scripts/migrate.mjs.
import { randomBytes, scryptSync } from "node:crypto";
import { isPostgresUrl } from "./sql-portable.mjs";

const [emailArg, passwordArg] = process.argv.slice(2);
const email = emailArg ?? process.env.ADMIN_EMAIL;
const password = passwordArg ?? process.env.ADMIN_PASSWORD;

if (!emailArg && !email && !password) {
  console.log("Aucun administrateur à créer (ni arguments, ni ADMIN_EMAIL/ADMIN_PASSWORD).");
  process.exit(0);
}
if (!email || !password) {
  console.error("Usage: node scripts/create-admin.mjs <email> <motdepasse>");
  console.error("   ou : ADMIN_EMAIL et ADMIN_PASSWORD dans l'environnement.");
  process.exit(1);
}
if (password.length < 12) {
  console.error("Mot de passe trop court : 12 caractères minimum.");
  console.error("Ce compte peut suspendre des boutiques et activer des abonnements.");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const hash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
const url = process.env.DATABASE_URL ?? "file:./dev.db";

if (isPostgresUrl(url)) {
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query("SELECT id FROM admin_users WHERE email = $1", [email]);
    if (rows.length > 0) {
      await client.query("UPDATE admin_users SET password_hash = $1 WHERE id = $2", [hash, rows[0].id]);
      console.log("Mot de passe mis à jour pour", email);
    } else {
      await client.query(
        "INSERT INTO admin_users (id,email,password_hash,role) VALUES ($1,$2,$3,'admin')",
        [id, email, hash]
      );
      console.log("Administrateur créé :", email);
    }
  } finally {
    await client.end();
  }
} else {
  const { default: Database } = await import("better-sqlite3");
  const db = new Database(url.replace(/^file:/, ""));
  const existing = db.prepare("SELECT id FROM admin_users WHERE email = ?").get(email);
  if (existing) {
    db.prepare("UPDATE admin_users SET password_hash = ? WHERE id = ?").run(hash, existing.id);
    console.log("Mot de passe mis à jour pour", email);
  } else {
    db.prepare("INSERT INTO admin_users (id,email,password_hash,role) VALUES (?,?,?,'admin')")
      .run(id, email, hash);
    console.log("Administrateur créé :", email);
  }
  db.close();
}
