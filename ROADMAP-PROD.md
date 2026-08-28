# ROADMAP-PROD — état d'avancement

Mémoire du programme de mise en production décrit dans `PROGRAMME-PROD.md`.
Mis à jour à la fin de **chaque** lot. Une session qui reprend le travail lit
ce fichier en premier : il dit ce qui est fait, ce qui reste, ce qui a été
décidé et ce qui reste à trancher.

**Dernière mise à jour** : 2026-08-28 — programme terminé, relecture de sécurité faite, + **interface de stockage des photos** (préalable à un déploiement Vercel).
**État du code** : V1+V2 complets, Next 16.3.3 + React 19, fournisseurs simulés en dev, SQLite en dev / PostgreSQL prêt pour la prod.
158 tests SQLite + 8 tests PostgreSQL, build sans erreur.

---

> ## ⚠️ À LIRE AVANT TOUTE OUVERTURE AU PUBLIC
>
> **Les pages légales doivent être relues par un humain.** `/cgu`,
> `/mentions-legales` et `/confidentialite` ont été rédigées de bonne foi et
> relues contre R1, **mais je ne suis pas juriste** et elles engagent Tara au
> Cameroun.
>
> Elles contiennent des marqueurs `[À COMPLÉTER]` **visibles à l'écran** :
> raison sociale, RCCM, NIU, siège, hébergeur, adresse de contact. Le site ne
> doit pas ouvrir tant qu'ils sont là. Le pré-vol du lot 6 devra en faire un
> point de contrôle bloquant.

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
- [x] **Lot 3 — Ce qu'un site public doit avoir** — CGU, mentions légales,
      politique de confidentialité (URL stable `/confidentialite`), aperçu OG
      généré à la volée, 404/500, robots.txt, sitemap.
- [x] **Lot 4 — PostgreSQL** — dialecte selon `DATABASE_URL`, migrations
      traduites à la volée, R3 et R4 **prouvés sur un vrai PostgreSQL 16**.
- [x] **Lot 5 — Déploiement** — service systemd durci, Nginx/TLS,
      `deploy.sh` qui ne redémarre jamais sur migration échouée, sauvegarde et
      restauration **exécutées** contre PostgreSQL, sonde `/api/sante`.
      Fichiers produits, **aucun serveur contacté** : c'est MIKE qui exécute.
- [x] **Lot 6 — Le pré-vol** — `scripts/preflight.mjs` branché dans
      `deploy.sh` avant le redémarrage, checklist humaine au README.
- [x] **Lot 7 — Mesurer le pilote** — écran `/admin/pilote` : créations par
      semaine, boutiques encore visitées depuis TikTok, commandes et délai
      avant la première vente, renouvellements payés. Détection du canal
      ajoutée (`src/lib/channel.ts`).

### Lots conditionnés (après le pilote — ne pas démarrer sans décision de MIKE)

- [ ] Passerelle SMS — bloqué : contrat agrégateur + Sender ID + doc API.
- [ ] Agrégateur Mobile Money — bloqué : registre de commerce + contrat + doc API.
- [ ] TikTok Login Kit réel — bloqué : app validée + URL de confidentialité stable.
- [x] WhatsApp Cloud API — **déclenché par MIKE le 28/08/2026** : canal de
      production des notifications ET de l'OTP. Le code est prêt ; les
      démarches Meta restent à faire (voir décisions).

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
| 2026-08-27 | Lot 3 : l'image d'aperçu est générée par **sharp**, déjà présent pour les photos d'articles. | Aucune dépendance nouvelle. `next/og` (satori) aurait alourdi le build pour le même résultat. Le SVG est converti en PNG car WhatsApp et TikTok n'affichent pas les aperçus SVG. |
| 2026-08-27 | Lot 3 : la taille de police de l'aperçu s'adapte à la longueur du titre. | Une police fixe faisait déborder les noms d'articles longs hors du cadre — constaté à l'œil sur l'image rendue, pas seulement en test. |
| 2026-08-27 | Lot 3 : si le rendu du texte échoue, l'image tombe sur un aplat de couleur au lieu d'une erreur 500. | Un aperçu terne vaut mieux qu'un lien cassé dans WhatsApp. |
| 2026-08-27 | Lot 3 : ajout d'une liste de **slugs réservés** (`src/lib/reserved.ts`). | Trou préexistant : une boutique nommée « admin » ou « creer » était masquée par la route racine du même nom. Mes trois nouvelles pages aggravaient le risque. |
| 2026-08-27 | Lot 3 : pages légales en **français seulement**. | Traduire un texte juridique non encore relu doublerait la charge de relecture. À reprendre si le pilote vise des vendeuses anglophones. |
| 2026-08-27 | Lot 4 : les dates restent en **TEXT** au format `YYYY-MM-DD HH:MM:SS` (UTC) sur les deux moteurs, via `to_char(...)` et non `CURRENT_TIMESTAMP`. | Le code métier compare les dates comme des chaînes. `CURRENT_TIMESTAMP` ajouterait fraction de seconde et fuseau, cassant ces comparaisons. Format vérifié identique à l'octet près. |
| 2026-08-27 | Lot 4 : les colonnes booléennes restent des `INTEGER 0/1`, **pas** des `BOOLEAN`. | Le code compare à `1` (`momo_enabled === 1`) partout. Le README conseillait l'inverse : conseil corrigé, il aurait cassé l'application. |
| 2026-08-27 | Lot 4 : une seule série de migrations, traduite à la volée par `scripts/sql-portable.mjs`. | Deux jeux de fichiers SQL divergeraient. La seule construction non portable était `datetime('now')`. |
| 2026-08-27 | Lot 4 : les tests PostgreSQL sont **ignorés** sans `TEST_DATABASE_URL`, avec un avertissement explicite. | Un test de concurrence qui ne tourne que sur SQLite ne prouve rien : SQLite sérialise les écritures. Mieux vaut un test ignoré qu'une fausse assurance. |
| 2026-08-27 | Lot 4 : `grantSubscription` rattrape désormais la violation d'unicité. | Trou du lot 2 : sous course, deux activations passaient le SELECT et la seconde levait une erreur non gérée. La garde est en base ; le code se contente de la traduire. |
| 2026-08-28 | Lot 5 : la configuration Nginx ne pose **aucun** en-tête de sécurité. | `next.config.mjs` les pose déjà. Les dupliquer ferait appliquer l'intersection des deux CSP par le navigateur, cassant l'embed TikTok sans message lisible. Un test échoue si un en-tête apparaît des deux côtés. |
| 2026-08-28 | Lot 5 : syntaxe `listen ... ssl http2;` et non `http2 on;`. | `http2 on;` n'existe qu'à partir de nginx 1.25 ; Ubuntu 22.04 et 24.04 livrent 1.18 et 1.24. Détecté par `nginx -t`, la configuration n'aurait pas démarré. |
| 2026-08-28 | Lot 5 : `StartLimitBurst` / `StartLimitIntervalSec` placés dans `[Unit]`. | Depuis systemd 229 ces clés sont ignorées dans `[Service]`. Détecté par `systemd-analyze verify`. |
| 2026-08-28 | Lot 5 : **pas** de fermeture explicite du pool PostgreSQL sur SIGTERM. | Question ouverte n°4 du lot 4, tranchée : fermer le pool pendant que Next draine ses requêtes en cours les ferait échouer. À l'arrêt, le processus meurt et PostgreSQL récupère ses connexions — le problème était cosmétique. `TimeoutStopSec=30` laisse Next drainer. |
| 2026-08-28 | Lot 5 : surveillance par service externe gratuit, pas par script local seul. | Si le VPS tombe entièrement, une alerte hébergée sur ce même VPS ne part jamais. |
| 2026-08-28 | Lot 6 : **écart assumé avec le programme.** Un `PAYMENT_PROVIDER` ou `TIKTOK_PROVIDER` encore `mock` **avertit** au lieu de bloquer ; `OTP_PROVIDER` et `NOTIFY_PROVIDER` bloquent. | Appliqué à la lettre, R5 interdirait tout lancement : ces deux branchements dépendent de démarches explicitement reportées après le pilote (contrat agrégateur, app TikTok validée). Un OTP simulé, lui, permet de prendre le compte de n'importe quelle vendeuse. |
| 2026-08-28 | Lot 6 : le mock de paiement **redevient bloquant** si au moins une boutique est en mode `agregateur`. | Contrôle piloté par les données plutôt que par une règle aveugle : c'est exactement le cas où des commandes passeraient en « payée » sans versement. |
| 2026-08-28 | Lot 6 : `create-admin.mjs` rendu bi-dialecte. | **Manque du lot 4** : câblé sur better-sqlite3, il échouait sur PostgreSQL — or la procédure de déploiement du README l'exécute contre la production. Aucun administrateur n'aurait pu être créé. |
| 2026-08-28 | Lot 6 : `seed.mjs` refuse PostgreSQL et `NODE_ENV=production`. | Ce script fait un `DELETE` sur toutes les tables : lancé par mégarde sur la production, il effacerait boutiques, commandes et abonnements. |
| 2026-08-28 | Lot 7 : le canal d'une visite est déduit du **user agent**, pas du paramètre `?src=` du lien. | Le kit de partage donne un lien **nu** : toute visite venant d'une bio TikTok était enregistrée « direct ». Le navigateur intégré de TikTok, lui, se signale dans le user agent — seul indice qui ne dépende pas de ce que la vendeuse a bien voulu recopier. |
| 2026-08-28 | Lot 7 : le lien du kit de partage **reste nu**, sans `?src=bio`. | Un lien plus long se recopie moins bien dans une bio TikTok, et une vendeuse qui le retape ne recopiera jamais le paramètre. La détection par user agent rend l'ajout inutile. |
| 2026-08-28 | Lot 7 : regroupement par semaine fait en **JavaScript**, pas en SQL. | Les fonctions de date diffèrent entre SQLite et PostgreSQL ; le lot 4 a montré ce que coûte une divergence. À l'échelle d'un pilote de 10 vendeuses, le volume ne justifie pas de dupliquer la logique par dialecte. |
| 2026-08-28 | Lot 7 : l'écran Pilote affiche les **user agents réellement observés**. | La détection est une heuristique : ce tableau permet de la confronter à de vraies visites et de corriger la liste de marqueurs. |
| 2026-08-28 | Hors programme, sur demande de MIKE : `scripts/create-seller.mjs` crée une vendeuse et sa boutique **sans OTP**. | Tant que la passerelle SMS n'est pas sous contrat, l'inscription normale est impossible : ce script débloque le recrutement des dix pilotes. La vendeuse se connecte ensuite par le parcours normal — dès que la passerelle existe, l'OTP arrive sur le numéro enregistré. |
| 2026-08-28 | `create-seller.mjs` : les aides (slug, téléphone, slugs réservés) sont **dupliquées** depuis la source TypeScript, avec des **tests de parité** qui échouent si les copies divergent. | Un script .mjs ne peut pas importer du TypeScript sans étape de build. La parité testée rend la duplication tolérable. |
| 2026-08-28 | **WhatsApp Cloud devient le canal de production** des notifications et de l'OTP (`NOTIFY_PROVIDER=whatsapp_cloud`, `OTP_PROVIDER=whatsapp`) ; le SMS passe en repli. | Décision explicite de MIKE — le lot conditionné est levé. L'utilisatrice type vit dans WhatsApp, et le template y coûte moins cher que le SMS. |
| 2026-08-28 | Le template `otp` suit le gabarit d'**authentification** de Meta : code seul en paramètre + bouton « copier le code » obligatoire. | L'ancien fournisseur envoyait la phrase entière dans un corps simple : l'API Graph l'aurait rejetée (paramètre > 15 caractères, bouton manquant) — **aucun OTP ne serait parti**, donc aucune inscription. |
| 2026-08-28 | Le fournisseur WhatsApp compose désormais texte **et lien** dans le paramètre. | Défaut préexistant : le lien était ignoré — alertes de drop et demandes d'avis partaient sans URL. |
| 2026-08-28 | `OTP_PROVIDER` accepte `whatsapp` et `sms`, deux noms de la même délégation au canal de `NOTIFY_PROVIDER` ; le pré-vol refuse un OTP réel dont le canal est simulé (`otp_sans_canal`). | L'ancien nom mentait : `OTP_PROVIDER=sms` envoyait via le canal de NOTIFY_PROVIDER, quel qu'il soit. |
| 2026-08-28 | Montée **Next 16.3.3 + React 19** ; migration asynchrone réelle de `cookies()`/`headers()` (pas le cast `UnsafeUnwrappedCookies` du codemod, supprimé en 16). | Fermait les deux failles hautes de production. `readSession`/`readAdmin`/`requireAdmin` deviennent async, 25 appelants propagés, zéro erreur TypeScript. |
| 2026-08-28 | `agentRules: false` dans `next.config.mjs`. | Next 16 injecte sinon un bloc « agent rules » dans `CLAUDE.md` à chaque `next dev`. Ce fichier contient les invariants du projet et n'appartient qu'à MIKE : aucun outil n'y écrit. |
| 2026-08-28 | **Relecture de sécurité** de tout le programme (11 PR, 115 fichiers, depuis `v1.0-mock`) : aucune vulnérabilité haute ni moyenne. Un constat faible accepté sans correction (question ouverte n°10). | Le code touche sessions, webhooks, argent et numéros de téléphone, et n'avait jamais eu de second regard. Vérifiés sains : HMAC de session et `timingSafeEqual` intacts après la migration async, échappement XML de l'image OG, SQL paramétré dans tous les scripts bi-dialecte, garde `readAdmin()` sur l'activation d'abonnement, sonde `/api/sante` muette. |
| 2026-08-28 | Les photos d'articles passent par une **interface de stockage** (`src/lib/storage.ts`) : `disk` en dev/VPS, `vercel_blob` en serverless. Décision de MIKE : cible Vercel Blob. | `createProduct` écrivait directement dans `public/uploads/`. Sur Vercel le disque est en **lecture seule** : chaque photo aurait échoué, et le `catch` silencieux aurait créé l'article sans photo **sans rien dire à la vendeuse**. Un article de friperie sans photo ne se vend pas. |
| 2026-08-28 | L'échec d'une photo est désormais **remonté** (`?photo=echec` + avertissement + journal serveur) au lieu d'être avalé. | Le comportement « une photo ratée ne bloque pas l'article » est conservé (vendeuse en 3G), mais l'invisibilité de l'échec était le vrai danger. |
| 2026-08-27 | Le tag `v1.0-mock` reste **local**. | L'environnement d'exécution refuse le push des refs de tags (branches acceptées). Action reportée à MIKE. |

---

## Questions ouvertes

### 1. Next.js 14 → 16 — FERMÉE le 28/08/2026

Montée faite : `next@16.3.3`, `react@19.2.8`. **`npm audit --omit=dev` : 0
vulnérabilité** — les deux failles hautes de production sont éteintes (ne
restent que les vulnérabilités d'outillage de test, documentées au lot 0).

Portage réel : les API de requête sont devenues asynchrones (`params`,
`searchParams`, `cookies()`, `headers()`) — codemod officiel puis migration
manuelle de `readSession`/`readAdmin`/`requireAdmin`, propagée à 25 appelants.
Tous les invariants revérifiés au `curl` sur Next 16, y compris sur le
serveur de **production** (`next start`) : R4 (3/7 sur stock de 3), R3
(webhook rejoué ×3, faux secret → 401), paiement direct de bout en bout,
parcours agrégateur avec polling `meta refresh`, OTP, admin, OG, canal
TikTok. 158 tests + 8 PostgreSQL verts.

### 2. Tag `v1.0-mock` non poussé

Le tag existe en local mais l'environnement bloque le push des refs de tags
(`send-pack: unexpected disconnect`, reproduit 4 fois, tags annotés **et**
légers ; le proxy ne signale aucune défaillance et les pushes de branches
passent). À créer côté GitHub par MIKE, sur le commit `83e3668`.

### 3. Branche par défaut

`main` existe sur le distant, mais la branche par défaut du dépôt est encore
`claude/vas-y-8hjt4t`. Le changement est un réglage GitHub, hors de portée des
outils disponibles ici. À basculer par MIKE (*Settings → Branches*).

### 4. Ce que le lot 5 n'a PAS pu vérifier — FERMÉE en partie

Ont été **réellement** validés ici : `nginx -t` (configuration complète, avec
certificats auto-signés), `systemd-analyze verify`, `shellcheck` sur les trois
scripts, et surtout **l'exécution de la sauvegarde puis de la restauration
contre un vrai PostgreSQL**, compteurs à l'appui.

N'ont **pas** pu l'être, faute de serveur : le certificat Let's Encrypt réel,
le démarrage effectif du service systemd, `deploy.sh` de bout en bout, et le
comportement sous charge. Ce sont les premières choses à éprouver quand le VPS
existera.

### 5. La détection du canal TikTok est une heuristique — À VÉRIFIER

`src/lib/channel.ts` reconnaît le navigateur intégré de TikTok à des
marqueurs du *user agent* (`BytedanceWebview`, `musical_ly`, `Trill`,
`aweme`, `TikTok`). Ces marqueurs viennent de la documentation et
d'observations publiques : **je n'ai pas pu les confronter à un vrai
téléphone depuis cet environnement.**

Si TikTok change son navigateur, ou si ces marqueurs sont incomplets, la
métrique la plus importante du pilote devient fausse — silencieusement.
D'où le tableau « Navigateurs observés » sur `/admin/pilote` : à la première
visite réelle depuis TikTok, vérifier qu'elle est classée « tiktok ».
C'est un point de la checklist de pré-vol.

Note : les visites enregistrées avant la migration 008 ont `channel = NULL`
et s'affichent « (avant lot 7) ». Le compteur ne vaut que pour les données
collectées ensuite.

### 6. Polices sur le serveur de production

L'image d'aperçu est rendue par sharp, qui s'appuie sur les polices du
système. Le conteneur de développement en a 59 ; **un VPS Ubuntu nu peut n'en
avoir aucune**, auquel cas les aperçus seraient des aplats de couleur sans
texte. À installer au lot 5 : `apt install fonts-dejavu-core`. Le code ne
plante pas dans ce cas, mais l'aperçu perd tout son intérêt.

### 7. Pages légales en français seulement

Une boutique de démonstration (`kev-sneakers`) est déjà en anglais, et le
Cameroun est bilingue. Les pages légales, elles, ne sont qu'en français. À
trancher : traduire après la relecture juridique, ou assumer le français
comme langue juridique de référence.

### 8. Espace vendeuse non traduit

`src/app/app/` est écrit en français en dur, y compris les libellés ajoutés au
lot 1. Ce n'est pas conforme à la lettre de `CLAUDE.md` (« toute chaîne visible
passe par `i18n.ts` »), mais c'est la convention de tout l'espace vendeuse
depuis la V1. À trancher : soit on assume que l'espace vendeuse est
francophone, soit un lot dédié le traduit. Les textes **acheteuse**, eux, sont
intégralement bilingues.

### 9. Templates WhatsApp — démarches Meta à faire (bascule du 28/08)

Le code est prêt et testé (forme des appels vérifiée contre l'API Graph
simulée), mais **rien ne part sans les démarches Meta**, dans cet ordre :

1. vérifier la société dans le Business Manager Meta (registre de commerce) ;
2. créer l'app WhatsApp Business + numéro dédié (PAS le numéro WhatsApp
   personnel de MIKE : l'API Cloud confisque le numéro à l'app) ;
3. ajouter un moyen de paiement international ;
4. faire approuver les **cinq templates** aux noms exacts `otp`,
   `new_video_tag`, `review_request`, `shop_announcement`, `drop_open`,
   chacun dans sa catégorie (tableau au README) — le template `otp` en
   catégorie *authentication*, avec bouton « copier le code » ;
5. renseigner `WHATSAPP_PHONE_NUMBER_ID` et `WHATSAPP_ACCESS_TOKEN`
   (jeton permanent, pas le jeton d'essai de 24 h).

La version d'API est épinglée par `WHATSAPP_API_VERSION` (v21.0). Meta retire
les vieilles versions ~2 ans après publication : à monter lors des maintenances.

### 10. Annonce de paiement non authentifiée — ACCEPTÉE, à revoir un jour

Constat de la relecture de sécurité du 28/08/2026. Sévérité **faible**,
**correction volontairement non faite** — le raisonnement est consigné ici
pour que personne n'ait à le refaire.

`POST /{slug}/payer/{orderId}/annonce` (lot 1) n'est pas authentifié, et les
identifiants de commande sont devinables : `genOrderId()` tire un `B-XXXX`
parmi ~9 000 valeurs. On peut donc énumérer les commandes en attente d'une
boutique et les faire passer en « paiement annoncé ».

**Pourquoi ce n'est pas bloquant** — vérifié dans le code, pas supposé :

- **aucune donnée personnelle exposée** : en mode direct `orders.buyer_phone`
  vaut `NULL` (`createOrder`), et la page de confirmation ne le sélectionne
  même pas. Tout ce qu'elle affiche est déjà public sur la vitrine ;
- **aucun mouvement d'argent** : seule la vendeuse, depuis sa session, fait
  passer `payment_announced → paid`. L'annonce ne peut jamais atteindre
  `paid` ;
- **effet réversible** : c'est une étiquette d'état, pas une destruction. La
  vendeuse garde `paid` et `cancelled` ;
- **c'est la moitié acheteuse d'un flux volontairement anonyme** (R2 :
  formulaires POST sans JS, aucun compte acheteur). L'annonce ne prouve rien
  **même pour l'acheteuse légitime** — elle déclare, la vendeuse vérifie son
  portefeuille MoMo. Forger l'annonce d'une commande tierce ne donne donc
  aucun levier qu'un attaquant n'a pas déjà sur la sienne.

**Pourquoi ne pas corriger maintenant** : le correctif propre — un jeton
imprévisible par commande, porté dans le lien de paiement — allongerait le
lien de l'acheteuse et le message WhatsApp, pour neutraliser une nuisance
sans gain d'argent ni de données. Mauvais échange contre R2 et contre une
utilisatrice en 3G.

**À rouvrir si** : un compte acheteur apparaît, ou si le badge « paiement
annoncé » devient une raison suffisante pour qu'une vendeuse expédie sans
vérifier son MoMo. Dans ce cas, lier l'annonce à un jeton par commande.

### 11. Les photos d'articles ne sont AFFICHÉES nulle part — OUVERTE

Découvert en préparant le stockage. `product_media` est **écrit mais jamais
lu** : aucun `<img>` dans la vitrine ni sur la fiche article. La vitrine
affiche un dégradé avec un emoji 🛍️ à la place de la photo, et la fiche
article s'appuie sur l'embed TikTok.

Autrement dit : la vendeuse envoie une photo, elle est convertie, stockée,
enregistrée en base — et **personne ne la voit jamais**. Le seed insère
lui-même des `product_media` pointant vers `/demo/p*.webp`.

L'interface de stockage était le préalable indispensable (sans elle, rien ne
serait stocké du tout en serverless), mais elle ne suffit pas : il reste à
brancher l'affichage. Travail estimé petit — remplacer le dégradé par la
photo quand elle existe, en gardant le dégradé en repli — mais il touche la
vitrine, donc le budget 3G de R2. **À décider par MIKE.**

### 12. Relecture juridique — OUVERTE (lot 3)

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
npm audit                 # vue complète
npm audit --omit=dev      # ce qui part vraiment en production
```

**Mise à jour du 28/08/2026** : la montée en Next 16.3.3 a éteint les deux
vulnérabilités de production (`next`, `postcss` imbriqué).
`npm audit --omit=dev` renvoie désormais **0 vulnérabilité**. Ne restent que
les vulnérabilités d'outillage (chaîne vitest), jamais expédiées.
