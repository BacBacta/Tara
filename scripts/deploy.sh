#!/usr/bin/env bash
#
# Déploiement de Tara sur le VPS.
#   sudo -u tara /var/www/tara/scripts/deploy.sh
#
# Règle : on ne redémarre JAMAIS sur une migration échouée. Chaque étape qui
# rate arrête le script, et l'ancienne version continue de tourner — un site
# à l'ancienne version vaut mieux qu'un site cassé.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/tara}"
BRANCH="${BRANCH:-main}"
SERVICE="${SERVICE:-tara}"
ENV_FILE="${ENV_FILE:-/etc/tara/tara.env}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/sante}"

étape() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
échec()  { printf '\n\033[31mÉCHEC : %s\033[0m\n' "$1" >&2; exit 1; }

cd "$APP_DIR" || échec "dossier introuvable : $APP_DIR"

[ -f "$ENV_FILE" ] || échec "fichier d'environnement absent : $ENV_FILE"
# Les variables sont nécessaires aux migrations et au pré-vol.
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

étape "Récupération du code ($BRANCH)"
git fetch --quiet origin "$BRANCH"
ANCIEN=$(git rev-parse HEAD)
git checkout --quiet "$BRANCH"
git reset --hard --quiet "origin/$BRANCH"
NOUVEAU=$(git rev-parse HEAD)
echo "$ANCIEN → $NOUVEAU"
if [ "$ANCIEN" = "$NOUVEAU" ]; then
  echo "(aucun nouveau commit — on continue quand même : la config a pu changer)"
fi

étape "Installation des dépendances"
npm ci

étape "Compilation"
npm run build

étape "Migrations"
# Le script est ré-exécutable : il saute ce qui est déjà appliqué.
# Sur PostgreSQL chaque migration est transactionnelle — pas de schéma
# à moitié appliqué en cas d'échec.
npm run db:migrate

# --- Le pré-vol du lot 6 viendra ici, AVANT le redémarrage. ---

étape "Redémarrage du service"
sudo systemctl restart "$SERVICE"

étape "Vérification de santé"
for i in $(seq 1 30); do
  if curl -fsS --max-time 3 "$HEALTH_URL" > /dev/null 2>&1; then
    echo "Le service répond (essai $i)."
    étape "Déploiement terminé : $NOUVEAU"
    exit 0
  fi
  sleep 1
done

échec "le service ne répond pas après 30 s — inspectez « journalctl -u $SERVICE -n 50 »"
