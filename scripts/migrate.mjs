// Applique les migrations SQL non encore appliquées, dans l'ordre.
// Le suivi en base rend le script idempotent : indispensable dès qu'une
// migration contient un ALTER TABLE (non rejouable), et pour les déploiements.
//
// Fonctionne sur SQLite (développement) et PostgreSQL (production), le
// dialecte étant déduit de DATABASE_URL. Voir scripts/sql-portable.mjs.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isPostgresUrl, toDialect } from "./sql-portable.mjs";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const postgres = isPostgresUrl(url);

const dir = join(process.cwd(), "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const CREATE_TRACKING = postgres
  ? `CREATE TABLE IF NOT EXISTS schema_migrations (
       name TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
     )`
  : `CREATE TABLE IF NOT EXISTS schema_migrations (
       name TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`;

let count = 0;
let target = url;

if (postgres) {
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  target = url.replace(/:\/\/[^@]*@/, "://***@"); // ne jamais journaliser le mot de passe
  try {
    await client.query(CREATE_TRACKING);
    const { rows } = await client.query("SELECT name FROM schema_migrations");
    const applied = new Set(rows.map((r) => r.name));

    for (const f of files) {
      if (applied.has(f)) continue;
      const sql = toDialect(readFileSync(join(dir, f), "utf8"), "postgres");
      // PostgreSQL sait annuler du DDL : une migration à moitié appliquée
      // n'existe pas, et le marqueur n'est posé que si tout a réussi.
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [f]);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
      console.log("applied:", f);
      count++;
    }
  } finally {
    await client.end();
  }
} else {
  const { default: Database } = await import("better-sqlite3");
  target = url.replace(/^file:/, "");
  const db = new Database(target);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(CREATE_TRACKING);

  const applied = new Set(
    db.prepare("SELECT name FROM schema_migrations").all().map((r) => r.name)
  );

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
}

console.log(
  count === 0
    ? `Migrations à jour (${files.length} déjà appliquées) → ${target}`
    : `Migrations OK : ${count} appliquée(s) → ${target}`
);
