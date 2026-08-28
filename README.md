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
| `npm test` | tests Vitest (234 tests + 8 PostgreSQL) |
| `node scripts/create-admin.mjs <email> <mdp>` | crée/réinitialise un administrateur |
| `node scripts/create-seller.mjs <tél> "<nom>" <ville> [fr\|en]` | crée une vendeuse et sa boutique **sans OTP** — pour recruter les pilotes à la main tant que la passerelle SMS n'est pas branchée |

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

### 2. Utilisateur, code et service

Tara tourne sous un utilisateur dédié, sans privilèges, et ses secrets vivent
hors du dépôt.

```bash
# utilisateur de service (pas de connexion interactive)
sudo adduser --system --group --home /var/www/tara --shell /usr/sbin/nologin tara

# code
sudo -u tara git clone https://github.com/BacBacta/Tara.git /var/www/tara
cd /var/www/tara
sudo -u tara npm ci
sudo -u tara npm run build

# secrets, HORS du dépôt, lisibles par le seul groupe tara
sudo install -d -m 750 -o root -g tara /etc/tara
sudo install -m 640 -o root -g tara .env.example /etc/tara/tara.env
sudo nano /etc/tara/tara.env        # voir §4

# schéma et compte administrateur
sudo -u tara env $(grep -v '^#' /etc/tara/tara.env | xargs) npm run db:migrate
sudo -u tara env $(grep -v '^#' /etc/tara/tara.env | xargs) \
  node scripts/create-admin.mjs admin@tara.shop '<mot de passe fort>'
```

Le service systemd est fourni : `deploy/tara.service`.

```bash
# vérifiez d'abord le chemin de npm — la ligne ExecStart doit correspondre
which npm

sudo cp deploy/tara.service /etc/systemd/system/tara.service
sudo systemctl daemon-reload
sudo systemctl enable --now tara
sudo systemctl status tara
```

Il tourne sous l'utilisateur `tara`, redémarre automatiquement, lit ses
variables dans `/etc/tara/tara.env`, et le disque lui est en lecture seule sauf
`.next/` et `public/uploads/`.

> `MemoryDenyWriteExecute` doit rester à `false` : Node compile son JIT à
> l'exécution et refuserait de démarrer autrement.

### 3. Reverse proxy Nginx et TLS

La configuration est fournie : `deploy/tara.nginx.conf`.

```bash
sudo apt install nginx certbot
sudo mkdir -p /var/www/certbot

# 1) certificat AVANT d'activer les blocs HTTPS
sudo certbot certonly --webroot -w /var/www/certbot -d tara.shop -d www.tara.shop

# 2) mise en place
sudo cp deploy/tara.nginx.conf /etc/nginx/sites-available/tara
sudo ln -s /etc/nginx/sites-available/tara /etc/nginx/sites-enabled/tara
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Ce que fait cette configuration : redirection HTTP → HTTPS, `www` vers le
domaine nu, `client_max_body_size 10M` pour les photos, compression du texte,
et surtout `X-Forwarded-For` — **sans lui, tout le trafic compterait pour une
seule adresse IP et le premier visiteur épuiserait le quota de rate limiting
de tout le monde.**

> **La configuration Nginx ne pose volontairement aucun en-tête de sécurité.**
> `next.config.mjs` pose déjà CSP, HSTS, `X-Frame-Options`,
> `X-Content-Type-Options`, `Referrer-Policy` et `Permissions-Policy`. Les
> ajouter aussi dans Nginx les dupliquerait : le navigateur appliquerait
> l'intersection des deux CSP, et la moindre divergence entre les deux
> fichiers casserait l'embed TikTok ou le pixel sans message lisible.
> Un seul endroit fait autorité. Un test (`tests/deploiement.test.ts`) échoue
> si un en-tête est ajouté des deux côtés.

> Les lignes `listen ... ssl http2;` correspondent à nginx 1.18 et 1.24
> (Ubuntu 22.04 et 24.04). Sur nginx ≥ 1.25 seulement, remplacez-les par
> `listen 443 ssl;` suivi de `http2 on;`.

### 4. Variables d'environnement de production

```
NODE_ENV=production
NEXT_PUBLIC_BASE_URL="https://tara.shop"
SESSION_SECRET="<32+ caractères aléatoires>"
PAYMENT_WEBHOOK_SECRET="<secret partagé avec l'agrégateur>"
PAYMENT_PROVIDER="simiz"          # plus jamais "mock" en production
OTP_PROVIDER="whatsapp"           # délègue au canal de notifications
NOTIFY_PROVIDER="whatsapp_cloud"  # production ; "sms" en repli
WHATSAPP_PHONE_NUMBER_ID="<id du numéro dédié>"
WHATSAPP_ACCESS_TOKEN="<jeton permanent Meta>"
WHATSAPP_TEMPLATE_LANG="fr"
PAYMENT_MOCK_AUTOCONFIRM=""       # DOIT rester vide en production
NEXT_PUBLIC_TIKTOK_PIXEL_ID="<id du pixel>"
```

> ⚠️ `OTP_PROVIDER=mock` affiche le code de vérification à l'écran et
> `PAYMENT_MOCK_AUTOCONFIRM=1` valide les paiements sans argent : ces deux
> réglages sont réservés à la démonstration.

### 5. Sauvegardes et restauration

Les deux scripts sont fournis et testés : `deploy/tara-backup.sh` et
`deploy/tara-restore.sh`.

```bash
sudo cp deploy/tara-backup.sh /etc/cron.daily/tara-backup
sudo chmod +x /etc/cron.daily/tara-backup
sudo -u postgres /etc/cron.daily/tara-backup      # premier essai, à la main
```

La sauvegarde écrit dans `/var/backups/tara` un dump PostgreSQL au format
`custom` (restauration sélective possible) plus une archive des photos
d'articles — qui ne sont pas en base : **sans elles, la restauration est
incomplète.** Rotation à 30 jours. Le script échoue bruyamment si le dump fait
moins d'un kilo-octet, et le renommage final est atomique : un fichier
`.dump` présent est forcément complet.

Restauration, vers une base **séparée** par prudence :

```bash
sudo -u postgres /var/www/tara/deploy/tara-restore.sh \
  /var/backups/tara/tara-2026-08-27_0300.dump tara_restore
```

Le script affiche les compteurs de boutiques, articles, commandes et
abonnements. **Comparez-les avec la production avant toute bascule.**

> **Testez la restauration au moins une fois avant l'ouverture.** Une
> sauvegarde jamais restaurée n'est pas une sauvegarde. C'est un point de la
> checklist de pré-vol que le script ne peut pas vérifier à votre place.

### 5 bis. Surveillance minimale

L'application expose `GET /api/sante` : `{"ok":true}` en 200 si la base
répond, `{"ok":false}` en 503 sinon. Elle ne divulgue rien d'autre. Un
processus vivant dont la base est tombée est bien signalé comme malade.

Trois niveaux, du plus simple au plus complet :

1. **systemd** relève déjà le service s'il meurt (`Restart=always`), au plus
   5 fois en 2 minutes pour éviter une boucle folle.
2. **Être prévenu.** systemd ne vous réveille pas la nuit. Le plus simple est
   un service de surveillance externe gratuit (UptimeRobot, healthchecks.io…)
   qui interroge `https://tara.shop/api/sante` toutes les 5 minutes et envoie
   un e-mail ou un SMS en cas d'échec. Un service externe est indispensable :
   si le VPS tombe entièrement, une alerte hébergée sur ce même VPS ne partira
   jamais.
3. **Vérification locale**, en complément, dans `/etc/cron.d/tara-sante` :

   ```cron
   */5 * * * * tara curl -fsS --max-time 10 http://127.0.0.1:3000/api/sante > /dev/null || systemctl restart tara
   ```

Journaux : `journalctl -u tara -f` (application), `/var/log/nginx/error.log`
(proxy).

### 6. Déploiements suivants

Une fois l'installation faite, chaque mise à jour passe par un seul script :

```bash
sudo -u tara /var/www/tara/scripts/deploy.sh
```

Il récupère le code, installe, compile, applique les migrations, redémarre le
service, puis interroge `/api/sante` pendant 30 secondes.

**Il s'arrête à la première erreur (`set -euo pipefail`) et n'atteint jamais
le redémarrage si une migration a échoué** : l'ancienne version continue de
tourner. Un site à l'ancienne version vaut mieux qu'un site cassé. Sur
PostgreSQL, chaque migration étant transactionnelle, une migration échouée ne
laisse pas non plus de schéma à moitié appliqué.

Pour revenir en arrière :

```bash
cd /var/www/tara
sudo -u tara git reset --hard <commit précédent>
sudo -u tara npm ci && sudo -u tara npm run build
sudo systemctl restart tara
```

> Un retour arrière ne défait **pas** les migrations déjà appliquées. Si la
> version fautive en contenait une, restaurez d'abord la base (§5).

### 7. Pré-vol — avant toute ouverture au public

```bash
cd /var/www/tara
sudo -u tara env $(grep -v '^#' /etc/tara/tara.env | xargs) node scripts/preflight.mjs
```

Le script est déjà branché dans `scripts/deploy.sh`, **avant le redémarrage** :
un déploiement qui échoue au pré-vol ne redémarre pas le service, et
l'ancienne version continue de tourner.

Il **refuse** la mise en production si :

- `OTP_PROVIDER` ou `NOTIFY_PROVIDER` vaut encore `mock` — les codes de
  vérification s'afficheraient à l'écran, et aucun SMS ne partirait ;
- `PAYMENT_MOCK_AUTOCONFIRM` n'est pas vide ;
- `SESSION_SECRET` est vide, fait moins de 32 caractères, ou vaut encore la
  valeur d'exemple (elle en fait 38 : la longueur seule ne suffit pas) ;
- un secret de webhook est vide ou d'exemple ;
- `NEXT_PUBLIC_BASE_URL` pointe sur `localhost` ou n'est pas en `https://` ;
- `DATABASE_URL` n'est pas PostgreSQL ;
- une passerelle SMS est sélectionnée sans URL ni clé ;
- aucun administrateur n'existe, ou l'un d'eux accepte encore un mot de passe
  de démonstration ;
- les boutiques du seed (`nadia-friperie-237`, `kev-sneakers`) sont en base ;
- les pages légales contiennent encore des marqueurs `[À COMPLÉTER]` ;
- **`PAYMENT_PROVIDER` est simulé alors qu'une boutique encaisse via
  l'agrégateur** — ses commandes seraient marquées payées sans versement.

Il **signale sans bloquer** un `PAYMENT_PROVIDER` ou un `TIKTOK_PROVIDER`
simulé quand rien n'en dépend : ces deux branchements attendent des démarches
externes (contrat agrégateur, app TikTok validée) et les rendre bloquants
interdirait tout lancement de pilote.

#### Checklist humaine — ce que le script ne peut pas vérifier

Le pré-vol lit des variables et des tables. Il ne peut rien dire de ceci, qui
reste à faire à la main, dans cet ordre :

- [ ] **Une sauvegarde a été restaurée pour de vrai**, au moins une fois, et
      les compteurs concordaient (§5). Une sauvegarde jamais restaurée n'est
      pas une sauvegarde.
- [ ] **La vitrine a été ouverte depuis le navigateur intégré de TikTok**, sur
      un vrai téléphone Android d'entrée de gamme, en 3G — pas dans Chrome sur
      un ordinateur. C'est le seul test qui compte : si le bouton ne réagit
      pas là, la vente est perdue.
- [ ] **Cette visite apparaît bien classée « tiktok »** dans
      `/admin/pilote`, section « Navigateurs observés ». La détection est une
      heuristique sur le *user agent* : si elle se trompe, la métrique la plus
      importante du pilote est fausse. Corrigez la liste de marqueurs dans
      `src/lib/channel.ts` si besoin.
- [ ] **Une commande a été passée de bout en bout** sur cette même vitrine,
      jusqu'au message WhatsApp reçu par la vendeuse.
- [ ] **Les textes vus par l'acheteuse ont été relus contre R1** : nulle part
      Tara ne doit sembler sécuriser, garantir, séquestrer ou rembourser un
      paiement. Écrans concernés : fiche article, page de paiement direct,
      confirmation, et le message WhatsApp pré-rempli.
- [ ] **Les pages légales ont été relues par un juriste camerounais** et tous
      les `[À COMPLÉTER]` sont remplis (le script vérifie les marqueurs, pas
      la justesse du contenu).
- [ ] **Le certificat TLS est valide** et le renouvellement automatique a été
      testé : `sudo certbot renew --dry-run`.
- [ ] **La surveillance externe est en place** et une alerte a été reçue au
      moins une fois (coupez le service exprès pour vérifier).
- [ ] **Le mot de passe administrateur est stocké dans un gestionnaire de
      mots de passe**, pas dans un carnet ni dans un fil WhatsApp.

### 8. Photos d'articles — stockage et affichage

Les photos passent par une interface (`src/lib/storage.ts`), au même titre que
le paiement ou les notifications. Le point d'écriture est unique :
`products.ts` n'écrit plus jamais sur le disque en direct, un test le vérifie.

| `STORAGE_PROVIDER` | Où atterrissent les photos | Pour qui |
|---|---|---|
| **`disk`** (défaut) | `public/uploads/` | développement et **VPS** |
| `vercel_blob` | Vercel Blob (URL absolue https) | **serverless obligatoire** |

> **Sur une plateforme serverless (Vercel), `disk` ne fonctionne pas** : le
> système de fichiers est en lecture seule à l'exécution, chaque photo
> échouerait. Il faut `STORAGE_PROVIDER=vercel_blob` et un store Blob attaché
> au projet (qui fournit `BLOB_READ_WRITE_TOKEN`). Le pré-vol refuse un
> `vercel_blob` sans jeton.

Une photo qui échoue **ne bloque jamais** la création de l'article — la
vendeuse est en 3G — mais l'échec n'est pas silencieux : elle est redirigée
avec `?photo=echec` et voit un avertissement, et le serveur journalise la
cause. Ajouter S3 ou R2 = une classe de plus dans `storage.ts`.

**Affichage** : `src/lib/photos.ts` lit les photos en **une seule requête** par
vitrine. La grille les montre en vignettes carrées, la fiche article en
`aspect-[4/3]` ; les articles sans photo gardent le dégradé de repli. Balise
`<img>` native et **jamais `next/image`** : l'image est déjà en WebP 800 px à
l'envoi, donc ni optimiseur ni JavaScript (R2). `width`/`height` sont déclarés
pour que la grille ne saute pas pendant le chargement en 3G.

`npm run db:seed` **génère** les photos de démonstration dans `public/demo/`
(non versionné) : sans elles, les boutiques de démo afficheraient des images
cassées.

### 9. Abonnement des vendeuses — encaissement manuel

L'abonnement (3 000 F/mois) est **la seule recette de Tara** ; les ventes, elles,
ne passent jamais par Tara (R1).

Tant qu'aucun agrégateur n'est branché — `PAYMENT_PROVIDER` à `mock` ou vide —
la vendeuse **ne peut pas payer dans l'application** : le paiement lancé
n'aboutirait jamais et elle resterait sur un écran d'attente sans fin. Dans ce
cas, l'écran *Tara illimité* lui donne le portefeuille MoMo de Tara, la
référence à indiquer (le nom de sa boutique) et un bouton pour prévenir Tara ;
l'activation se fait ensuite à la main depuis `/admin`, avec la référence du
versement — c'est elle qui empêche de créditer deux fois le même paiement.

| Variable | Rôle | Sans elle |
|---|---|---|
| `TARA_MOMO_NUMBER` | portefeuille MoMo de Tara | **le pré-vol bloque** : aucune vendeuse ne peut s'abonner |
| `TARA_MOMO_OPERATOR` | `mtn` (défaut) ou `orange` | l'écran annonce MTN |
| `TARA_WHATSAPP` | numéro pour prévenir Tara | le bouton WhatsApp n'apparaît pas |

Dès qu'un vrai `PAYMENT_PROVIDER` est branché, l'écran repasse tout seul au
paiement dans l'application : aucune de ces variables n'est alors utilisée.

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

### Brancher les notifications — WhatsApp Cloud en production

Les notifications (OTP, demande d'avis, annonces, alertes de drop) passent par
`NotifyProvider` (`src/lib/notify.ts`), qui embarque **trois implémentations
prêtes** — on change de canal avec une variable d'environnement, sans toucher au
reste du code.

| `NOTIFY_PROVIDER` | Usage | Prérequis |
|---|---|---|
| `mock` | développement et démonstration | aucun |
| **`whatsapp_cloud`** | **production** (décision du 28/08/2026) | société vérifiée par Meta, numéro dédié, moyen de paiement international, les **cinq templates approuvés** |
| `sms` | repli si la vérification Meta traîne | une passerelle SMS locale : `SMS_API_URL`, `SMS_API_KEY`, `SMS_SENDER_ID` |

**Pourquoi WhatsApp.** L'utilisatrice type vit dans TikTok et WhatsApp : un
message WhatsApp est lu, un SMS l'est de moins en moins, et le template
WhatsApp coûte moins cher que le SMS camerounais. L'OTP de connexion suit le
même canal (`OTP_PROVIDER=whatsapp` délègue à `NOTIFY_PROVIDER`). Le prix de ce
choix est administratif, pas technique — voir la liste des démarches ci-dessous.

**Les cinq templates à faire approuver chez Meta.** Chaque template porte le
nom exact de son gabarit interne (préfixable via `WHATSAPP_TEMPLATE_PREFIX`),
avec **un** paramètre de corps `{{1}}`, dans la langue de
`WHATSAPP_TEMPLATE_LANG` (fr par défaut) :

| Template | Catégorie Meta | Le paramètre `{{1}}` reçoit |
|---|---|---|
| `otp` | *authentication* | le code seul — gabarit imposé par Meta, bouton « copier le code » inclus |
| `new_video_tag` | *utility* | le texte et le lien |
| `review_request` | *utility* | le texte et le lien |
| `shop_announcement` | *marketing* | le texte et le lien |
| `drop_open` | *marketing* | le texte et le lien |

**Les catégories ne sont pas décoratives** : envoyer du marketing sous une
catégorie *utility* expose à une suspension du compte. Et le template `otp`
n'est pas un template libre — Meta impose son gabarit d'authentification, dont
le bouton « copier le code » ; le fournisseur envoie le code isolé, jamais la
phrase complète (qui dépasserait la limite de 15 caractères du paramètre).

**Ce que ce canal n'est pas.** Uniquement des templates transactionnels et
marketing approuvés — jamais de conversation automatisée : Meta interdit les
assistants IA généralistes sur l'API Cloud depuis janvier 2026 (`CLAUDE.md`).

**L'onboarding se fait directement chez Meta, sans BSP obligatoire** — un BSP
n'apporte qu'un accompagnement et parfois un paiement en monnaie locale. Les
listes de diffusion natives de WhatsApp ne sont pas une alternative :
plafonnées à 256 contacts, elles ne délivrent qu'aux personnes ayant
enregistré le numéro de la vendeuse.

**Le repli SMS reste prêt.** Si la vérification Meta traîne, `NOTIFY_PROVIDER=sms`
et `OTP_PROVIDER=sms` basculent tout sur une passerelle SMS locale — il ne
reste qu'à adapter le corps de la requête HTTP au format de la passerelle
retenue, dans `SmsNotifyProvider` (une dizaine de lignes). En attendant l'un ou
l'autre, `scripts/create-seller.mjs` inscrit les vendeuses pilotes sans OTP.

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
