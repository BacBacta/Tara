# ROADMAP-PROD — état d'avancement

Mémoire du programme de mise en production décrit dans `PROGRAMME-PROD.md`.
Mis à jour à la fin de **chaque** lot. Une session qui reprend le travail lit
ce fichier en premier : il dit ce qui est fait, ce qui reste, ce qui a été
décidé et ce qui reste à trancher.

**Dernière mise à jour** : 2026-08-27, fin du lot 2.
**État du code** : V1+V2 complets, fournisseurs simulés, base SQLite.
84 tests verts, build sans erreur.

---

## État des lots

- [x] **Lot 0 — Hygiène du dépôt** — `main` créée, tag `v1.0-mock` (local),
      cette roadmap, tri des vulnérabilités npm.
- [x] **Lot 1 — Paiement direct vendeuse** — mode `direct` par défaut, écran de
      paiement affichant le numéro de la vendeuse, état « paiement annoncé »,
      confirmation par la vendeuse seule. Sans JavaScript, FR/EN.
- [x] **Lot 2 — Encaissement de l'abonnement, à la main** — activation manuelle
      depuis le back-office (N mois, référence MoMo, note), période offerte
      distinguée du payé, journal d'audit, écran admin enrichi.
- [ ] **Lot 3 — Ce qu'un site public doit avoir** — pages légales, aperçu OG,
      404/500, robots.txt, sitemap.
- [ ] **Lot 4 — PostgreSQL** — dialecte selon `DATABASE_URL`, portage des
      migrations, preuve de R3 et R4 sur PostgreSQL. **Avant** le déploiement.
- [ ] **Lot 5 — Déploiement** — systemd, Nginx/TLS, `deploy.sh`, sauvegardes.
- [ ] **Lot 6 — Le pré-vol** — `scripts/preflight.mjs`, checklist humaine.
- [ ] **Lot 7 — Mesurer le pilote** — écran admin « Pilote », 4 chiffres.

### Lots conditionnés (après le pilote — ne pas démarrer sans décision de MIKE)

- [ ] Passerelle SMS — bloqué : contrat agrégateur + Sender ID + doc API.
- [ ] Agrégateur Mobile Money — bloqué : registre de commerce + contrat + doc API.
- [ ] TikTok Login Kit réel — bloqué : app validée + URL de confidentialité stable.
- [ ] WhatsApp Cloud API — bloqué : société vérifiée par Meta + templates.

---

## Décisions prises

| Date | Décision | Raison |
|---|---|---|
| 2026-08-27 | `main` créée depuis l'état `v1.0-mock` ; les lots arrivent par PR mergée dans `main`. | Traçabilité : un lot = une PR = un commit lisible. |
| 2026-08-27 | **Aucune dépendance npm modifiée au lot 0.** | Aucun paquet n'est à la fois exécuté en production *et* corrigeable sans changement majeur. Voir l'annexe. |
| 2026-08-27 | `npm audit fix` (avec ou sans `--force`) n'a **jamais** été lancé. | Consigne explicite du programme ; `--force` imposerait `next@16`, deux majeures d'écart. |
| 2026-08-27 | Lot 1 : en mode `direct`, c'est le **numéro MoMo renseigné** qui ouvre le bouton de paiement ; `momo_enabled` ne gouverne plus que le mode `agregateur`. | Un seul interrupteur par mode : pas de double condition à comprendre pour la vendeuse, et jamais de bouton menant à une impasse. |
| 2026-08-27 | Lot 1 : le nouvel état s'appelle `payment_announced` et ne vaut **pas** paiement. Seule la vendeuse fait passer à `paid`. | R1 : une déclaration d'acheteuse n'est pas un encaissement. Tara n'est pas témoin de la transaction. |
| 2026-08-27 | Lot 1 : le pixel TikTok `CompletePayment` ne se déclenche **que** sur `paid`. | Compter une annonce comme un achat fausserait les chiffres du pilote (lot 7). |
| 2026-08-27 | Lot 1 : les libellés de l'espace vendeuse restent en français en dur. | L'ensemble de `/app` suit déjà cette convention ; tout passer par `i18n.ts` serait une réécriture hors périmètre. Les textes **acheteuse** passent tous par `i18n.ts`, FR et EN. |
| 2026-08-27 | Lot 2 : `subscriptions.origin` vaut `aggregator`, `manual` ou `offered`. Une période **offerte vaut 0 F** et n'entre pas dans le revenu. | Sans cette distinction, le chiffre d'affaires serait faux dès le premier mois du pilote. |
| 2026-08-27 | Lot 2 : l'idempotence de l'activation manuelle repose sur un **index unique partiel** `(shop_id, payment_ref)`. | Même philosophie que R3 : la garde est en base, pas dans le code applicatif. Les périodes sans référence ne sont pas contraintes. |
| 2026-08-27 | Lot 2 : un abonnement **payé** exige une référence de transaction ; une période **offerte** non. | Un encaissement sans référence serait intraçable au moment de rapprocher les comptes. |
| 2026-08-27 | Lot 2 : `nextPeriod()` et `applyPeriodToShop()` sont partagés par l'agrégateur et l'activation manuelle. | Exigence du programme : un seul chemin d'abonnement, pas deux qui divergent. |
| 2026-08-27 | Le tag `v1.0-mock` reste **local**. | L'environnement d'exécution refuse le push des refs de tags (branches acceptées). Action reportée à MIKE. |

---

## Questions ouvertes

### 1. Next.js 14 → 16 — à trancher avant le lot 5 (déploiement)

Tara tourne sur **`next@14.2.35`, déjà la dernière 14.x stable** : il n'existe
aucun correctif dans la ligne 14. Les deux vulnérabilités qui touchent
réellement la production (`next` et son `postcss` imbriqué, toutes deux
**hautes**) ne se corrigent que par `next@16.3.3`.

Ouvrir `tara.shop` au public sur Next 14, c'est publier avec des failles hautes
connues. Certaines concernent des fonctions que Tara utilise (App Router,
en-têtes CSP posés dans `next.config.mjs`, cache RSC) ; d'autres non
(Pages Router i18n, serveur custom, runtime Edge, API d'optimisation d'images).

**Options** : (a) monter en 16 avant l'ouverture — coût : portage App Router,
tests à repasser, risque de régression sur les parcours publics ; (b) ouvrir en
14 en assumant le risque sur un pilote à 10 vendeuses, et monter juste après.

**Aucune décision prise.** À trancher par MIKE.

### 2. Tag `v1.0-mock` non poussé

Le tag existe en local mais l'environnement bloque le push des refs de tags
(`send-pack: unexpected disconnect`, reproduit 4 fois, tags annotés **et**
légers ; le proxy ne signale aucune défaillance et les pushes de branches
passent). À créer côté GitHub par MIKE, sur le commit `83e3668`.

### 3. Branche par défaut

`main` existe sur le distant, mais la branche par défaut du dépôt est encore
`claude/vas-y-8hjt4t`. Le changement est un réglage GitHub, hors de portée des
outils disponibles ici. À basculer par MIKE (*Settings → Branches*).

### 4. Espace vendeuse non traduit

`src/app/app/` est écrit en français en dur, y compris les libellés ajoutés au
lot 1. Ce n'est pas conforme à la lettre de `CLAUDE.md` (« toute chaîne visible
passe par `i18n.ts` »), mais c'est la convention de tout l'espace vendeuse
depuis la V1. À trancher : soit on assume que l'espace vendeuse est
francophone, soit un lot dédié le traduit. Les textes **acheteuse**, eux, sont
intégralement bilingues.

### 5. Relecture juridique (à ouvrir au lot 3)

Les pages légales rédigées au lot 3 **devront être relues par un humain**
avant l'ouverture au public. Elles seront écrites de bonne foi, mais pas par
un juriste, et elles engagent Tara au Cameroun.

---

## Annexe — tri des vulnérabilités npm (lot 0)

`npm audit` annonce **7 vulnérabilités (1 critique, 3 hautes, 3 modérées)**.
Le chiffre brut est trompeur : le tri prod / outillage change complètement
la lecture.

| Paquet | Sévérité | Exécuté en production ? | Correctif sans rupture ? | Recommandation |
|---|---|---|---|---|
| `vitest` | **critique** | non — outillage de test | non (`vitest@4`, majeure) | documenter, ne rien faire |
| `vite` | haute | non — outillage | non (`vitest@4`) | documenter |
| `@vitest/mocker` | modérée | non — outillage | non (`vitest@4`) | documenter |
| `vite-node` | modérée | non — outillage | non (`vitest@4`) | documenter |
| `esbuild` | modérée | non — outillage | non (`vitest@4`) | documenter |
| `next` | haute | **oui** | **non** (`next@16`, 2 majeures) | question ouverte n°1 |
| `postcss` (imbriqué dans `next`) | haute | **oui** | **non** (suit `next`) | question ouverte n°1 |

**Lecture** :

- L'unique « critique » est **`vitest`**, de l'outillage de test qui n'est
  jamais expédié en production. Le risque pour une acheteuse est nul.
- Les cinq vulnérabilités d'outillage viennent toutes de la même chaîne
  (`vitest` → `vite` / `esbuild`) et se corrigeraient d'un seul coup par
  `vitest@4`, au prix d'une majeure sur le harnais de test.
- `postcss` **à la racine** est en `8.5.26`, donc **sain**. Seule la copie
  imbriquée dans `next` est vulnérable, et elle ne bouge qu'avec `next`.
- Le critère du programme — « à la fois exécuté en production **et**
  corrigeable sans casse » — ne sélectionne **aucun paquet**. D'où : rien
  corrigé, tout documenté.

**Commande de vérification** :

```bash
npm audit                 # vue complète (7)
npm audit --omit=dev      # ce qui part vraiment en production (2)
```
