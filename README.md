# Tara — V1 + V2

La boutique des vendeuses TikTok du Cameroun : une mini-boutique web (PWA)
accessible par un lien court placé dans la bio TikTok, des commandes qui
arrivent sur WhatsApp, des paiements Mobile Money (MTN MoMo / Orange Money).

## Démarrage rapide (développement)

```bash
npm install
cp .env.example .env            # puis renseigner SESSION_SECRET
npm run db:migrate              # crée dev.db (SQLite) et applique migrations/
npm run db:seed                 # 2 boutiques de démo + commandes + admin
node scripts/create-admin.mjs admin@tara.shop motdepasse
npm run dev                     # http://localhost:3000
```

Boutiques de démo : `/nadia-friperie-237` (FR, MoMo activé) et `/kev-sneakers` (EN).
Back-office : `/admin`. Onboarding vendeuse : `/creer`.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` / `npm start` | build et exécution en production |
| `npm run db:migrate` | applique `migrations/*.sql` dans l'ordre |
| `npm run db:seed` | jeu de données de démonstration (réinitialise les tables) |
| `npm test` | tests Vitest (65 tests) |
| `node scripts/create-admin.mjs <email> <mdp>` | crée/réinitialise un administrateur |

## Architecture

- **Next.js 14 (App Router, TypeScript strict)** — SSR pour les vitrines publiques,
  Route Handlers pour les API. Les parcours acheteur et vendeuse fonctionnent
  **sans JavaScript** (formulaires POST natifs) : indispensable dans les WebViews
  TikTok/Instagram sur réseau 3G.
- **Kysely + better-sqlite3** en développement, **PostgreSQL** en production.
  Le schéma est en SQL pur (`migrations/`), les types dans `src/lib/schema.ts`.
  *(Prisma était prévu au cahier des charges ; ses moteurs binaires étant
  indisponibles dans l'environnement de build, Kysely a été retenu — même
  typage strict, aucun binaire externe, dialecte PostgreSQL natif.)*
- **Tailwind CSS**, palette produit dans `tailwind.config.ts`.
- **Zod** valide toutes les entrées d'API.
- **Sessions** : cookies `httpOnly` signés HMAC-SHA256 (vendeuses : 30 j ;
  administrateurs : 8 h). Authentification vendeuse par OTP à 6 chiffres.

### Intégrations derrière des interfaces

| Interface | Implémentation V1 | À brancher |
|---|---|---|
| `PaymentProvider` (`src/lib/payments.ts`) | `MockPaymentProvider` | Simiz / CamerPay / autre agrégateur MTN+Orange |
| `OtpProvider` (`src/lib/otp.ts`) | `MockOtpProvider` (code journalisé) | passerelle SMS locale (`OTP_PROVIDER=sms`) |

Pour brancher l'agrégateur réel : écrire une classe qui implémente
`PaymentProvider`, la retourner depuis `getPaymentProvider()` selon
`PAYMENT_PROVIDER`, et adapter la vérification de signature dans
`src/app/api/webhooks/payment/route.ts`. Aucun autre fichier à modifier.

## Sécurité

- Webhooks de paiement **idempotents** (garde SQL sur `provider_ref` +
  statut `pending`) : un rejeu ne crée jamais de doublon.
- Limitation de débit (`src/lib/ratelimit.ts`) : OTP 5/15 min par IP (et 5/h par
  numéro), connexion admin 10/10 min, webhooks 120/min, commandes 30/10 min.
  *Mono-instance : remplacer le `Map` par Redis en cas de montée en charge.*
- En-têtes : CSP stricte (TikTok autorisé pour l'embed et le pixel), HSTS,
  `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`.
- Mots de passe administrateurs en **scrypt salé**, comparaisons en temps constant.
- Chaque action d'administration est journalisée dans `audit_log`.

## Déploiement (VPS Ubuntu + PostgreSQL + Nginx)

### 1. Base de données

```bash
sudo apt install postgresql fonts-dejavu-core
sudo -u postgres createuser tara -P
sudo -u postgres createdb tara -O tara
```

> `fonts-dejavu-core` n'est pas décoratif : les images d'aperçu de partage
> (Open Graph) sont rendues par sharp, qui s'appuie sur les polices du système.
> Sans elles, les aperçus partagés sur WhatsApp seraient des aplats de couleur
> sans texte.

Dans `.env` : `DATABASE_URL="postgresql://tara:MOTDEPASSE@localhost:5432/tara"`.

**Aucune modification de code n'est nécessaire.** Le dialecte se déduit de
`DATABASE_URL` (`src/lib/db.ts`) : une URL `postgres://` ou `postgresql://`
sélectionne PostgreSQL, tout le reste SQLite. `npm run db:migrate` traduit les
migrations à la volée (`scripts/sql-portable.mjs`) et les applique dans une
transaction — sur PostgreSQL le DDL est transactionnel, donc une migration
échouée ne laisse jamais un schéma à moitié appliqué.

> **Ne convertissez pas les colonnes `INTEGER 0/1` en `BOOLEAN`.** Le code
> métier les compare à `1` (`shop.momo_enabled === 1`) ; le passage en booléen
> casserait ces comparaisons dans toute l'application.

> Les dates sont stockées en **TEXT** au format `YYYY-MM-DD HH:MM:SS` (UTC),
> identique sur les deux moteurs, parce que le code compare les dates comme des
> chaînes. C'est pour cela que la traduction utilise `to_char(...)` et non
> `CURRENT_TIMESTAMP`, qui ajouterait fraction de seconde et fuseau.

#### Bascule depuis un SQLite existant

À faire **avant** l'ouverture au public, jamais après :

```bash
# 1. arrêter l'application (plus aucune écriture pendant la bascule)
sudo systemctl stop tara

# 2. créer le schéma sur PostgreSQL
DATABASE_URL="postgresql://tara:MOTDEPASSE@localhost:5432/tara" npm run db:migrate

# 3. transférer les données existantes (pgloader gère les types SQLite)
sudo apt install pgloader
pgloader ./dev.db postgresql://tara:MOTDEPASSE@localhost:5432/tara

# 4. vérifier que les compteurs concordent, table par table
sqlite3 dev.db "select 'shops', count(*) from shops union all select 'orders', count(*) from orders;"
psql -U tara -d tara -c "select 'shops', count(*) from shops union all select 'orders', count(*) from orders;"

# 5. basculer DATABASE_URL dans .env, puis redémarrer
sudo systemctl start tara
```

Gardez le fichier `dev.db` d'origine au moins un mois : c'est votre seul
retour arrière.

#### Vérifier les invariants sur votre PostgreSQL

Les tests de concurrence tournent contre un vrai serveur. Sur une base
**jetable** (ils effacent le schéma) :

```bash
sudo -u postgres createdb tara_test -O tara
TEST_DATABASE_URL="postgresql://tara:MOTDEPASSE@localhost:5432/tara_test" npm test
```

Ils prouvent, sur PostgreSQL et non sur SQLite : 10 commandes simultanées sur
un stock de 3 donnent exactement 3 succès (R4), un webhook rejoué — y compris
en parallèle — n'a qu'un seul effet (R3), et deux activations d'abonnement
concurrentes avec la même référence n'en créditent qu'une.

Sans `TEST_DATABASE_URL`, ces tests sont **ignorés** et le disent : un test de
concurrence qui ne tournerait que sur SQLite ne prouverait rien, SQLite
sérialisant les écritures avec un verrou global.

### 2. Application

```bash
git clone <dépôt> /var/www/tara && cd /var/www/tara
npm ci && npm run build
npm run db:migrate
node scripts/create-admin.mjs admin@votredomaine.cm '<mot de passe fort>'
```

Service systemd `/etc/systemd/system/tara.service` :

```ini
[Unit]
Description=Tara
After=network.target postgresql.service

[Service]
WorkingDirectory=/var/www/tara
EnvironmentFile=/var/www/tara/.env
ExecStart=/usr/bin/npm start
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

### 3. Reverse proxy Nginx

```nginx
server {
  server_name tara.shop;
  client_max_body_size 10M;            # uploads photo
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;   # requis par le rate limiting
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Certificat TLS : `sudo certbot --nginx -d tara.shop`.

### 4. Variables d'environnement de production

```
NODE_ENV=production
NEXT_PUBLIC_BASE_URL="https://tara.shop"
SESSION_SECRET="<32+ caractères aléatoires>"
PAYMENT_WEBHOOK_SECRET="<secret partagé avec l'agrégateur>"
PAYMENT_PROVIDER="simiz"          # plus jamais "mock" en production
OTP_PROVIDER="sms"                # passerelle SMS locale
NOTIFY_PROVIDER="sms"             # mock | sms | whatsapp_cloud
SMS_API_URL="<endpoint de la passerelle>"
SMS_API_KEY="<cle>"
SMS_SENDER_ID="TARA"
PAYMENT_MOCK_AUTOCONFIRM=""       # DOIT rester vide en production
NEXT_PUBLIC_TIKTOK_PIXEL_ID="<id du pixel>"
```

> ⚠️ `OTP_PROVIDER=mock` affiche le code de vérification à l'écran et
> `PAYMENT_MOCK_AUTOCONFIRM=1` valide les paiements sans argent : ces deux
> réglages sont réservés à la démonstration.

### 5. Sauvegardes

```bash
# /etc/cron.daily/tara-backup
set -euo pipefail
pg_dump -U tara --format=custom tara > /var/backups/tara-$(date +%F).dump
find /var/backups -name 'tara-*.dump' -mtime +30 -delete
rsync -a /var/www/tara/public/uploads/ /var/backups/uploads/
```

Le format `custom` (`-Fc`) permet une restauration sélective, table par table,
et se restaure avec `pg_restore` :

```bash
# restauration complète sur une base vierge
sudo -u postgres createdb tara_restore -O tara
pg_restore -U tara -d tara_restore /var/backups/tara-2026-08-27.dump

# vérifier avant de basculer
psql -U tara -d tara_restore -c "select count(*) from orders;"
```

**Testez la restauration au moins une fois avant la mise en production.** Une
sauvegarde jamais restaurée n'est pas une sauvegarde. C'est un point de la
checklist de pré-vol (lot 6) que le script ne peut pas vérifier à votre place.

### 6. Fichiers uploadés

En V1 les photos sont écrites dans `public/uploads/`. Pour passer à un stockage
objet (S3/R2), remplacer l'écriture disque dans `src/lib/products.ts` — c'est le
seul point d'écriture.

## V2 — intégrations TikTok et rétention

Livrée. Tout est derrière des interfaces avec implémentations **mock** : aucune
requête réseau n'est faite tant que les vrais fournisseurs ne sont pas branchés.

| Bloc | Contenu | Interface à brancher |
|---|---|---|
| G1 | Login Kit, badge « compte TikTok vérifié », jetons **chiffrés AES-256-GCM** | `TikTokProvider` (`src/lib/tiktok.ts`) |
| G2 | Synchronisation des vidéos (Display API), tag vidéo↔articles, vitrine shoppable | idem |
| G3 | Webhooks TikTok idempotents : nouvelle vidéo → notification, désautorisation → badge retiré sous 24 h | `TIKTOK_WEBHOOK_SECRET` |
| G4 | Funnel vues → visites → commandes par vidéo | — |
| G5 | Avis vérifiés à lien unique (commande livrée uniquement), réponse et modération | `NotifyProvider` (SMS) |
| G6 | Suivi de boutique (opt-in), annonces **4/mois maximum**, désabonnement signé en un clic | `NotifyProvider` (SMS) |
| G7 | Drops : compte à rebours, aperçu verrouillé, alerte à l'ouverture, **stock atomique sans survente** | — |
| G8 | Back-office : comptes connectés, supervision des webhooks, modération des avis | — |

### Brancher TikTok pour de vrai

1. Créer l'app sur [TikTok for Developers](https://developers.tiktok.com/) et
   demander les scopes `user.info.basic`, `user.info.profile`, `user.info.stats`,
   `video.list` (l'audit prend plusieurs semaines — à lancer tôt).
2. Renseigner `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_WEBHOOK_SECRET`.
3. Écrire une classe implémentant `TikTokProvider` (OAuth réel + appels Display API)
   et la retourner depuis `getTikTokProvider()` quand `TIKTOK_PROVIDER=real`.
   Aucun écran, aucune route, aucun test à modifier.
4. Déclarer l'URL de rappel des webhooks : `https://…/api/webhooks/tiktok`.

### Brancher les notifications — SMS d'abord, WhatsApp plus tard

Les notifications (OTP, demande d'avis, annonces, alertes de drop) passent par
`NotifyProvider` (`src/lib/notify.ts`), qui embarque **trois implémentations
prêtes** — on change de canal avec une variable d'environnement, sans toucher au
reste du code.

| `NOTIFY_PROVIDER` | Usage | Prérequis |
|---|---|---|
| `mock` | développement et démonstration | aucun |
| **`sms`** | **production par défaut** | une passerelle SMS locale : `SMS_API_URL`, `SMS_API_KEY`, `SMS_SENDER_ID` |
| `whatsapp_cloud` | option de croissance, à fort volume | société vérifiée par Meta, numéro dédié, moyen de paiement international, templates approuvés |

**Pourquoi le SMS par défaut.** Il atteint 100 % des téléphones (y compris les
non-smartphones), ne demande ni vérification d'entreprise Meta ni carte bancaire
internationale, et se facture souvent en FCFA. Il sert aussi l'OTP de connexion
(`OTP_PROVIDER=sms` réutilise la même passerelle). Concrètement, il ne reste
qu'à adapter le corps de la requête HTTP au format de la passerelle retenue,
dans `SmsNotifyProvider` — une dizaine de lignes.

**Ce qui ne nécessite aucune passerelle.** Deux des quatre notifications s'en
passent très bien : prévenir la vendeuse d'une nouvelle vidéo se fait par une
bannière dans son tableau de bord, et la demande d'avis peut partir de sa propre
conversation WhatsApp via un lien `wa.me` pré-rempli — elle discute déjà avec la
cliente. Seuls les envois en masse (annonces, alertes de drop) demandent
réellement une passerelle.

**Quand passer à WhatsApp Cloud.** Quand le volume rend le SMS coûteux : la
Cloud API est moins chère au message et bien mieux lue. L'onboarding se fait
**directement chez Meta, sans BSP obligatoire** — un BSP n'apporte qu'un
accompagnement et parfois un paiement en monnaie locale. Attention aux
catégories de templates (`TEMPLATE_CATEGORY` dans le code) : `otp` en
*authentication*, `new_video_tag` et `review_request` en *utility*,
`shop_announcement` et `drop_open` en *marketing*. Envoyer du marketing sous une
catégorie utility expose à une suspension du compte. Les listes de diffusion
natives de WhatsApp ne sont pas une alternative : plafonnées à 256 contacts,
elles ne délivrent qu'aux personnes ayant enregistré le numéro de la vendeuse.

### Ordre de priorité des branchements

1. **Agrégateur Mobile Money** — indispensable : sans lui, pas d'encaissement.
2. **Passerelle SMS locale** — débloque l'OTP réel et les annonces, sans dossier.
3. *(optionnel)* **App TikTok** — badge vérifié, synchronisation, webhooks.
4. *(croissance)* **WhatsApp Cloud API**, puis le pixel publicitaire (V3).

### Points d'attention V2

- Les **quotas TikTok** : la synchronisation est planifiée (1×/jour) et déclenchée
  par webhook — ne jamais poller agressivement.
- Le **badge vérifié** doit tomber dès la révocation : c'est traité par le webhook
  `authorization.removed` et par l'échec de rafraîchissement du jeton.
- Le **quota d'annonces** (4/30 jours) est bloquant côté serveur : il protège les
  clientes du spam et le compte WhatsApp d'un blocage.

## Feuille de route

- **V3** : exploitation du pixel et de l'Events API (boost publicitaire des vidéos
  optimisé sur les commandes réelles), livraison intégrée avec partenaires
  coursiers, puis extensions stratégiques (paiement diaspora, catalogues
  fournisseurs).
