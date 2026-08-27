# CLAUDE.md — règles du projet Tara

Ce fichier est lu automatiquement par Claude Code au démarrage.
Il contient les **invariants** du projet. Ne les contourne pas sans que MIKE
ait explicitement demandé le changement dans la conversation.

---

## 1. Ce qu'est Tara

`tara.shop` — la mini-boutique des vendeuses TikTok au Cameroun.
Une vendeuse met **un lien dans sa bio TikTok** → l'acheteur voit une vitrine
(articles + prix) → il commande → la commande part sur **WhatsApp** →
il paie en **Mobile Money** directement à la vendeuse.

Modèle : abonnement 3 000 F CFA/mois par boutique (10 articles gratuits,
au-delà il faut l'abonnement). Pas de commission sur les ventes.

**Utilisatrice type** : femme, 20-35 ans, Douala/Yaoundé, téléphone Android
d'entrée de gamme, réseau 3G instable, forfait data limité, tape sur un petit
écran avec le pouce, sait utiliser TikTok et WhatsApp et rien d'autre.
Chaque décision technique se juge contre elle, pas contre un dev à fibre optique.

---

## 2. Les cinq règles non négociables

### R1 — Tara n'encaisse JAMAIS l'argent des vendeuses
L'argent va du portefeuille MoMo de l'acheteur au portefeuille MoMo de la
vendeuse. Tara enregistre, notifie, ne détient rien.

Conséquences dans le code et les textes :
- **interdit** d'écrire ou de réintroduire une promesse de type « remboursé si
  non livré », « paiement sécurisé par Tara », « argent bloqué jusqu'à la
  livraison », « garantie Tara ». C'est un mensonge et, en droit COBAC/BEAC,
  ça ferait de Tara un établissement de paiement non agréé.
- la formule validée est dans `src/lib/i18n.ts` :
  *« Tu paies la vendeuse directement — Tara ne touche jamais ton argent »*
  / *« You pay the seller directly — Tara never holds your money »*.
- le seul flux d'argent qui entre chez Tara est **l'abonnement** de la vendeuse.

### R2 — Les parcours publics fonctionnent sans JavaScript
Vitrine, fiche article, commande, paiement, confirmation, avis, alerte de drop,
onboarding vendeuse : tout doit marcher avec JS désactivé ou non chargé.
On utilise des **formulaires POST natifs** vers des Route Handlers, pas de
`fetch()` obligatoire, pas de state client obligatoire.

Raison : le navigateur intégré de TikTok sur Android bas de gamme en 3G perd
ou retarde les bundles. Un bouton qui ne réagit pas = une vente perdue.

Le JS n'est autorisé que pour du **confort strictement optionnel** : bouton
copier, aperçu du slug, embed TikTok en click-to-load, pixel. Si le JS échoue,
la page reste utilisable.

### R3 — Les webhooks sont idempotents
Un agrégateur MoMo renvoie le même webhook 3 fois. Jamais deux fois le même effet.

Deux mécanismes déjà en place, à conserver :
- garde SQL sur la transition : `UPDATE ... WHERE status = 'pending'` — si
  0 ligne touchée, l'événement a déjà été traité, on sort en 200.
- table `webhook_events` avec `dedup_key` **UNIQUE** pour les webhooks TikTok.

Un webhook déjà vu répond **200**, pas une erreur (sinon l'émetteur réessaie
en boucle).

### R4 — Pas de survente
Le stock se décrémente **dans la même requête SQL** que la vérification :

```sql
UPDATE products SET stock_qty = stock_qty - ?1
WHERE id = ?2 AND stock_qty >= ?1
```

Jamais `SELECT` puis `UPDATE` : 10 commandes simultanées sur 3 articles doivent
donner exactement 3 succès et 7 refus. Un test de concurrence couvre ce cas.

### R5 — Les mocks ne partent jamais en production
`PAYMENT_PROVIDER`, `OTP_PROVIDER`, `NOTIFY_PROVIDER`, `TIKTOK_PROVIDER` valent
`mock` en dev. En production ils doivent valoir autre chose, et
`PAYMENT_MOCK_AUTOCONFIRM` doit être vide.
Si tu ajoutes un provider, ajoute-le au tableau du README et à `.env.example`.

---

## 3. Stack et conventions

| Élément | Choix | Note |
|---|---|---|
| Framework | Next.js 14, App Router, TypeScript strict | pas de `any`, pas de `@ts-ignore` |
| Base | Kysely + better-sqlite3 (dev), PostgreSQL (prod) | **pas de Prisma** (moteurs binaires indisponibles) |
| Schéma | SQL pur dans `migrations/*.sql` | types miroir dans `src/lib/schema.ts` |
| Validation | Zod sur **toute** entrée d'API | aucune exception |
| CSS | Tailwind, palette dans `tailwind.config.ts` | indigo9 `#33418F`, mango `#F5A623`, sand, okgreen, wagreen |
| Tests | Vitest (`npm test`) | 65 tests au dernier état, doivent rester verts |

**Migrations** : on n'édite jamais une migration déjà appliquée. On ajoute
`006_xxx.sql`. `scripts/migrate.mjs` tient une table `schema_migrations` et
saute ce qui est déjà passé — il doit rester **ré-exécutable sans casse**.

**Langue** : l'interface est bilingue FR/EN via `src/lib/i18n.ts`, le FR est la
langue par défaut. Toute chaîne visible passe par `i18n.ts`, jamais en dur dans
un composant. Les commits et commentaires de code sont en français.

**Argent** : entiers en F CFA, jamais de flottant, jamais de centimes.
Formatage via `src/lib/format.ts`.

**Téléphone** : validé par `phoneCm` (Zod) — `^(237)?6\d{8}$`, normalisé avec
le préfixe `237`.

---

## 4. Carte du code

```
src/app/[slug]/          vitrine publique (SSR) : boutique, article, commande,
                         paiement, confirmation, drop, suivi
src/app/creer/           onboarding vendeuse en 4 étapes (OTP)
src/app/app/             espace vendeuse : dashboard, articles, commandes,
                         TikTok, vidéos, avis, annonces, drops, partage, réglages
src/app/admin/           back-office (scrypt, suspension, métriques, export CSV)
src/app/api/webhooks/    paiement + TikTok
src/lib/                 toute la logique métier — les routes restent minces
migrations/              001_init → 005_stock
tests/                   9 fichiers Vitest
```

Règle : **la logique va dans `src/lib/`**, les Route Handlers et pages se
contentent de valider (Zod), appeler la lib, rendre. Un handler qui dépasse
~60 lignes est un signe qu'il faut extraire dans `src/lib/`.

### Intégrations derrière des interfaces
Tout ce qui touche l'extérieur est derrière une interface avec une
implémentation mock :

| Interface | Fichier | Réel à brancher |
|---|---|---|
| `PaymentProvider` | `src/lib/payments.ts` | agrégateur MTN MoMo + Orange Money |
| `OtpProvider` | `src/lib/otp.ts` | passerelle SMS camerounaise |
| `NotifyProvider` | `src/lib/notify.ts` | SMS local (défaut) ou WhatsApp Cloud |
| `TikTokProvider` | `src/lib/tiktok.ts` | Login Kit + Display API |

Brancher un vrai fournisseur = écrire une classe qui implémente l'interface +
la retourner depuis le `get...Provider()` selon la variable d'env.
**Aucun autre fichier ne doit changer.** Si tu te retrouves à modifier une page
pour brancher un fournisseur, c'est que l'abstraction est mal placée.

---

## 5. Ce qu'il ne faut pas faire

- ❌ ajouter une dépendance lourde côté client (framework d'état, librairie de
  composants, animation) — chaque Ko coûte des ventes en 3G
- ❌ remplacer un formulaire POST par du `fetch()` dans un parcours public
- ❌ introduire Prisma, un ORM à moteur binaire, ou un service externe payant
  sans que MIKE l'ait demandé
- ❌ promettre une garantie financière (voir R1)
- ❌ écrire un chatbot IA sur WhatsApp : **Meta l'interdit depuis janvier 2026**
  pour les assistants généralistes sur l'API Cloud
- ❌ supposer que TikTok Shop existe au Cameroun (il n'existe pas) ou qu'il
  existe une API officielle pour les commentaires de LIVE (il n'y en a pas)
- ❌ committer `.env`, `dev.db`, `public/uploads/`

---

## 6. Commandes

```bash
npm install
cp .env.example .env          # renseigner SESSION_SECRET (32 caractères min.)
npm run db:migrate            # applique migrations/ (ré-exécutable)
npm run db:seed               # 2 boutiques démo + commandes + admin
node scripts/create-admin.mjs admin@tara.shop <motdepasse>
npm run dev                   # http://localhost:3000
npm test                      # Vitest — doit rester à 100 %
npm run build                 # doit compiler sans erreur TypeScript
```

Démo : `/nadia-friperie-237` (FR, MoMo actif), `/kev-sneakers` (EN),
`/creer` (onboarding), `/admin` (back-office).

## 7. Définition de « terminé »

Une tâche n'est finie que si, dans cet ordre :
1. `npm run build` compile sans erreur ;
2. `npm test` est vert (et le nouveau comportement a **son** test) ;
3. le parcours touché a été essayé **JavaScript désactivé** si c'est un parcours public ;
4. un commit en français décrit ce qui a changé.
