// Applique les migrations SQL non encore appliquées, dans l'ordre.
// Le suivi en base rend le script idempotent : indispensable dès qu'une
// migration contient un ALTER TABLE (non rejouable), et pour les déploiements.
import Database from "better-sqlite3";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const file = url.replace(/^file:/, "");
const db = new Database(file);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

const applied = new Set(
  db.prepare("SELECT name FROM schema_migrations").all().map((r) => r.name)
);

const dir = join(process.cwd(), "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
let count = 0;

for (const f of files) {
  if (applied.has(f)) continue;
  const sql = readFileSync(join(dir, f), "utf8");
  const run = db.transaction(() => {
    db.exec(sql);
    db.prepare("INSERT INTO schema_migrations (name) VALUES (?)").run(f);
  });
  run();
  console.log("applied:", f);
  count++;
}

console.log(
  count === 0
    ? `Migrations à jour (${files.length} déjà appliquées) → ${file}`
    : `Migrations OK : ${count} appliquée(s) → ${file}`
);
