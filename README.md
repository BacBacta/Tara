# Bio-Shop — V1

La boutique des vendeuses TikTok du Cameroun : une mini-boutique web (PWA)
accessible par un lien court placé dans la bio TikTok, des commandes qui
arrivent sur WhatsApp, des paiements Mobile Money (MTN MoMo / Orange Money).

## Démarrage rapide (développement)

```bash
npm install
cp .env.example .env            # puis renseigner SESSION_SECRET
npm run db:migrate              # crée dev.db (SQLite) et applique migrations/
npm run db:seed                 # 2 boutiques de démo + commandes + admin
node scripts/create-admin.mjs admin@bioshop.cm motdepasse
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
| `npm test` | tests Vitest (58 tests) |
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
| `OtpProvider` (`src/lib/otp.ts`) | `MockOtpProvider` (code journalisé) | BSP WhatsApp ou passerelle SMS locale |

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
sudo apt install postgresql
sudo -u postgres createuser bioshop -P
sudo -u postgres createdb bioshop -O bioshop
```

Dans `.env` : `DATABASE_URL="postgresql://bioshop:MOTDEPASSE@localhost:5432/bioshop"`.

> Le code de `src/lib/db.ts` utilise le dialecte SQLite. Pour PostgreSQL :
> `npm i pg`, remplacer `SqliteDialect` par `PostgresDialect` (`new Pool({ connectionString })`),
> et convertir les `INTEGER 0/1` de `migrations/001_init.sql` en `BOOLEAN`.
> Les requêtes Kysely restent identiques.

### 2. Application

```bash
git clone <dépôt> /var/www/bioshop && cd /var/www/bioshop
npm ci && npm run build
npm run db:migrate
node scripts/create-admin.mjs admin@votredomaine.cm '<mot de passe fort>'
```

Service systemd `/etc/systemd/system/bioshop.service` :

```ini
[Unit]
Description=Bio-Shop
After=network.target postgresql.service

[Service]
WorkingDirectory=/var/www/bioshop
EnvironmentFile=/var/www/bioshop/.env
ExecStart=/usr/bin/npm start
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

### 3. Reverse proxy Nginx

```nginx
server {
  server_name bioshop.cm;
  client_max_body_size 10M;            # uploads photo
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;   # requis par le rate limiting
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Certificat TLS : `sudo certbot --nginx -d bioshop.cm`.

### 4. Variables d'environnement de production

```
NODE_ENV=production
NEXT_PUBLIC_BASE_URL="https://bioshop.cm"
SESSION_SECRET="<32+ caractères aléatoires>"
PAYMENT_WEBHOOK_SECRET="<secret partagé avec l'agrégateur>"
PAYMENT_PROVIDER="simiz"          # plus jamais "mock" en production
OTP_PROVIDER="whatsapp_bsp"
PAYMENT_MOCK_AUTOCONFIRM=""       # DOIT rester vide en production
NEXT_PUBLIC_TIKTOK_PIXEL_ID="<id du pixel>"
```

> ⚠️ `OTP_PROVIDER=mock` affiche le code de vérification à l'écran et
> `PAYMENT_MOCK_AUTOCONFIRM=1` valide les paiements sans argent : ces deux
> réglages sont réservés à la démonstration.

### 5. Sauvegardes

```bash
# /etc/cron.daily/bioshop-backup
pg_dump -U bioshop bioshop | gzip > /var/backups/bioshop-$(date +%F).sql.gz
find /var/backups -name 'bioshop-*.sql.gz' -mtime +30 -delete
rsync -a /var/www/bioshop/public/uploads/ /var/backups/uploads/
```

Tester la **restauration** au moins une fois avant la mise en production.

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
| G5 | Avis vérifiés à lien unique (commande livrée uniquement), réponse et modération | `NotifyProvider` |
| G6 | Suivi de boutique (opt-in), annonces **4/mois maximum**, désabonnement signé en un clic | `NotifyProvider` (BSP WhatsApp) |
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

### Brancher les notifications WhatsApp

Ouvrir un compte **WhatsApp Business API** via un BSP, faire approuver les quatre
templates (`new_video_tag`, `review_request`, `shop_announcement`, `drop_open`),
puis implémenter `NotifyProvider` (`src/lib/notify.ts`). Les messages ne partent
jamais du compte personnel de la vendeuse — c'est une exigence de conformité.

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
