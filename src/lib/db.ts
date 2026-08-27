// Couche d'accès aux données — Kysely + better-sqlite3 en dev.
// Décision d'architecture : Prisma était imposé initialement, mais ses moteurs
// binaires sont indisponibles dans certains environnements (CDN bloqué).
// Kysely offre le même typage strict, zéro binaire externe, et un dialecte
// PostgreSQL natif pour la production (échange du dialect uniquement).
import { Kysely, PostgresDialect, SqliteDialect } from "kysely";
import SQLite from "better-sqlite3";
import { Pool } from "pg";
import type { DB } from "./schema";

/** Le dialecte se déduit de DATABASE_URL : postgres:// → PostgreSQL, sinon SQLite. */
export function isPostgresUrl(url: string): boolean {
  return /^postgres(ql)?:\/\//.test(url);
}

const globalForDb = globalThis as unknown as { kysely?: Kysely<DB> };

function createDb(): Kysely<DB> {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";

  // Production : PostgreSQL. Le code métier est identique — seul le dialecte
  // change. SQLite ne tient pas la charge multi-utilisateurs (verrou global
  // en écriture), mais reste parfait en développement.
  if (isPostgresUrl(url)) {
    return new Kysely<DB>({
      dialect: new PostgresDialect({
        pool: new Pool({
          connectionString: url,
          max: Number(process.env.DATABASE_POOL_MAX ?? 10),
        }),
      }),
    });
  }

  const database = new SQLite(url.replace(/^file:/, ""));
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  return new Kysely<DB>({ dialect: new SqliteDialect({ database }) });
}

export const db = globalForDb.kysely ?? createDb();
if (process.env.NODE_ENV !== "production") globalForDb.kysely = db;

/** Identifiant court aléatoire (cuid simplifié, suffisant pour la V1). */
export function newId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}
