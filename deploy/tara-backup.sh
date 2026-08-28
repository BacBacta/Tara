#!/usr/bin/env bash
#
# Sauvegarde quotidienne de Tara (base + photos d'articles).
#   sudo cp deploy/tara-backup.sh /etc/cron.daily/tara-backup
#   sudo chmod +x /etc/cron.daily/tara-backup
#
# Le format « custom » (-Fc) de pg_dump permet une restauration sélective,
# table par table, avec pg_restore. Un dump SQL brut ne le permet pas.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/tara}"
UPLOADS_DIR="${UPLOADS_DIR:-/var/www/tara/public/uploads}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
ENV_FILE="${ENV_FILE:-/etc/tara/tara.env}"

# DATABASE_URL vit dans le fichier d'environnement, jamais dans ce script.
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi
: "${DATABASE_URL:?DATABASE_URL absent — impossible de sauvegarder}"

mkdir -p "$BACKUP_DIR"
HORODATAGE=$(date +%F_%H%M)
CIBLE="$BACKUP_DIR/tara-$HORODATAGE.dump"

# Un pg_dump interrompu laisserait un fichier partiel derrière lui : on le
# balaie quoi qu'il arrive, pour que le dossier ne contienne que des
# sauvegardes complètes.
trap 'rm -f "$CIBLE.partiel"' EXIT

# --clean --if-exists : le dump sait recréer par-dessus une base existante.
pg_dump --dbname="$DATABASE_URL" --format=custom --clean --if-exists --file="$CIBLE.partiel"
# Renommage atomique : un fichier .dump présent est forcément complet.
mv "$CIBLE.partiel" "$CIBLE"

# Les photos ne sont pas en base : sans elles, la restauration est incomplète.
if [ -d "$UPLOADS_DIR" ]; then
  tar -czf "$BACKUP_DIR/uploads-$HORODATAGE.tar.gz" -C "$(dirname "$UPLOADS_DIR")" "$(basename "$UPLOADS_DIR")"
fi

# Rotation.
find "$BACKUP_DIR" -name 'tara-*.dump'      -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name 'uploads-*.tar.gz' -mtime "+$RETENTION_DAYS" -delete

# Une sauvegarde vide est un piège : mieux vaut échouer bruyamment.
TAILLE=$(stat -c%s "$CIBLE")
if [ "$TAILLE" -lt 1024 ]; then
  echo "ALERTE : la sauvegarde ne fait que $TAILLE octets — vérifiez la base." >&2
  exit 1
fi

echo "Sauvegarde OK : $CIBLE ($TAILLE octets)"
