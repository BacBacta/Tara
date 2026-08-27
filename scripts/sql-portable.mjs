// Traduction du SQL des migrations vers PostgreSQL.
//
// Les fichiers de migrations/ sont écrits en SQLite, qui reste le mode de
// développement. Une seule construction n'est pas portable : datetime('now').
//
// Le format doit rester IDENTIQUE entre les deux moteurs, parce que les dates
// sont stockées en TEXT et comparées comme des chaînes dans le code métier
// (« where created_at > :depuis »). datetime('now') de SQLite produit
// « 2026-08-27 22:19:24 » — UTC, sans fraction de seconde ni fuseau.
// CURRENT_TIMESTAMP de PostgreSQL produirait « 2026-08-27 22:19:24.123456+00 »,
// qui se compare différemment. D'où le to_char explicite.
const PG_NOW = "to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')";

/** Traduit un script de migration SQLite vers le dialecte demandé. */
export function toDialect(sql, dialect) {
  if (dialect !== "postgres") return sql;
  return sql.replace(/datetime\('now'\)/gi, PG_NOW);
}

export function isPostgresUrl(url) {
  return /^postgres(ql)?:\/\//.test(url);
}

export { PG_NOW };
