#!/usr/bin/env bash
#
# Restauration d'une sauvegarde Tara.
#   sudo -u postgres /var/www/tara/deploy/tara-restore.sh /var/backups/tara/tara-2026-08-27_0300.dump tara_restore
#
# Par prudence, ce script restaure vers une base SÉPARÉE. Écraser la base de
# production se fait à la main, en connaissance de cause, après vérification.
set -euo pipefail

DUMP="${1:-}"
BASE_CIBLE="${2:-tara_restore}"

[ -n "$DUMP" ] || { echo "usage : $0 <fichier.dump> [base_cible]" >&2; exit 1; }
[ -f "$DUMP" ] || { echo "fichier introuvable : $DUMP" >&2; exit 1; }

if psql -lqt | cut -d\| -f1 | grep -qw "$BASE_CIBLE"; then
  echo "La base « $BASE_CIBLE » existe déjà." >&2
  echo "Supprimez-la d'abord (dropdb $BASE_CIBLE) si vous voulez repartir de zéro." >&2
  exit 1
fi

echo "==> Création de $BASE_CIBLE"
createdb "$BASE_CIBLE"

echo "==> Restauration de $DUMP"
pg_restore --dbname="$BASE_CIBLE" --no-owner --no-privileges "$DUMP"

echo "==> Contrôle"
psql --dbname="$BASE_CIBLE" -c "
  select 'boutiques' as table, count(*) from shops
  union all select 'articles', count(*) from products
  union all select 'commandes', count(*) from orders
  union all select 'abonnements', count(*) from subscriptions;"

cat <<MSG

Restauration terminée dans « $BASE_CIBLE ».
Comparez ces compteurs avec la production AVANT toute bascule.
Pour basculer :  systemctl stop tara → modifier DATABASE_URL → systemctl start tara
MSG
