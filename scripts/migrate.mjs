// Applique les migrations SQL dans l'ordre (dev: SQLite).
import Database from "better-sqlite3";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const file = url.replace(/^file:/, "");
const db = new Database(file);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const dir = join(process.cwd(), "migrations");
for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  db.exec(readFileSync(join(dir, f), "utf8"));
  console.log("applied:", f);
}
console.log("Migrations OK →", file);
