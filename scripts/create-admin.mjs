// Crée ou met à jour un administrateur : node scripts/create-admin.mjs email motdepasse
import Database from "better-sqlite3";
import { randomBytes, scryptSync } from "node:crypto";

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: node scripts/create-admin.mjs <email> <motdepasse>");
  process.exit(1);
}
const salt = randomBytes(16).toString("hex");
const hash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const db = new Database(url.replace(/^file:/, ""));
const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
const existing = db.prepare("SELECT id FROM admin_users WHERE email = ?").get(email);
if (existing) {
  db.prepare("UPDATE admin_users SET password_hash = ? WHERE id = ?").run(hash, existing.id);
  console.log("Mot de passe mis à jour pour", email);
} else {
  db.prepare("INSERT INTO admin_users (id,email,password_hash,role) VALUES (?,?,?,'admin')").run(id, email, hash);
  console.log("Administrateur créé :", email);
}
