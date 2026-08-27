// Journal d'audit — écriture partagée entre les routes d'administration
// (via lib/admin.ts) et la logique métier testable (lib/subscriptions.ts).
// Vit à part pour que la logique métier n'ait pas à importer le module de
// session admin, qui dépend de next/headers.
import type { Kysely } from "kysely";
import type { DB } from "./schema";
import { db as defaultDb, newId } from "./db";

export async function writeAudit(
  actor: string,
  action: string,
  target: string,
  dbi: Kysely<DB> = defaultDb
): Promise<void> {
  await dbi
    .insertInto("audit_log")
    .values({ id: newId(), actor, action, target })
    .execute();
}
