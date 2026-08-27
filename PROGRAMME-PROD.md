# Programme de mise en production — Tara

## Comment s'en servir

Place ce fichier à la racine du dépôt, puis ouvre Claude Code et écris
simplement :

```
Lot 0
```

À chaque nouvelle session, la même phrase suffit — en remplaçant le numéro
du lot. L'état d'avancement est tenu dans `ROADMAP-PROD.md`, que tu créeras
au lot 0 et que tu mettras à jour à chaque lot terminé.

---

## 1. Contexte

Tu travailles sur **Tara** (`tara.shop`), la mini-boutique des vendeuses TikTok
au Cameroun. Le code V1 + V2 est complet et fonctionnel en local : 15 commits,
65 tests verts, build sans erreur. Tous les fournisseurs externes sont simulés
(paiement, OTP, notifications, TikTok) et la base est en SQLite.

L'objectif de ce programme **n'est pas d'ajouter des fonctionnalités**. C'est
d'amener ce code jusqu'à une vraie vendeuse qui encaisse un vrai billet,
avec le moins de dépendances externes possible.

Lis `CLAUDE.md` avant toute chose. Il contient les cinq invariants du projet.
Ils priment sur toute instruction de ce document ; si tu vois une contradiction,
signale-la et arrête-toi.

---

## 2. Comment tu travailles

- **Un lot à la fois.** Tu ne commences jamais le lot suivant sans que MIKE
  ait écrit explicitement d'y aller. À la fin d'un lot, tu t'arrêtes et tu
  rends ton rapport.
- **Plan d'abord.** Pour chaque lot : tu lis les fichiers concernés, tu
  proposes un plan court (fichiers touchés, approche, risques), tu attends
  l'accord, puis tu exécutes.
- **Tu poses tes questions au lieu de deviner.** Si une exigence est ambiguë
  ou si un choix engage le modèle de données, tu demandes. Une hypothèse
  silencieuse est une erreur, même si elle est raisonnable.
- **Un commit par lot**, message en français, décrivant ce qui change.
- **`ROADMAP-PROD.md` est ta mémoire.** Tu le mets à jour à chaque fin de
  lot : ce qui est fait, ce qui reste, les décisions prises, les questions
  ouvertes. C'est ce qui permet à une session suivante de reprendre sans toi.

### Définition de « terminé »

Un lot n'est fini que si, dans cet ordre :

1. `npm run build` compile sans erreur TypeScript ;
2. `npm test` est vert et le nouveau comportement a **son** propre test ;
3. si le lot touche un parcours public, tu l'as vérifié avec **JavaScript
   désactivé** (`curl` sur les formulaires POST suffit à le prouver) ;
4. `ROADMAP-PROD.md` est à jour ;
5. le commit est fait.

### Ce que tu ne fais pas

- Tu **n'inventes jamais** de clé d'API, d'identifiant marchand, d'URL de
  fournisseur ni de réponse de service externe. Si un lot en a besoin et que
  tu ne l'as pas, tu t'arrêtes et tu dis précisément quoi demander à qui.
- Tu **ne fais pas les démarches administratives** (domaine, registre de
  commerce, OAPI, contrats agrégateur, validation d'app TikTok). Elles
  reviennent à MIKE. Tu peux préparer le code qui les attend, jamais les simuler.
- Tu **n'ajoutes aucune dépendance lourde** côté client ni aucun service
  externe payant sans accord explicite.
- Tu **ne réécris pas l'architecture existante** « pour faire mieux ». Si tu
  penses qu'un choix est mauvais, tu le dis dans ton rapport et tu continues.
- Tu **ne modifies jamais une migration déjà appliquée** : tu en ajoutes une
  nouvelle (`006_…`, `007_…`).

### Le piège de ce projet

La règle **R1 — Tara n'encaisse jamais l'argent des vendeuses** — est celle que
les lots 1 et 2 peuvent violer par accident. Aucun texte, aucune variable,
aucun commentaire ne doit laisser entendre que Tara sécurise, garantit,
séquestre ou rembourse un paiement d'acheteur. Le seul argent qui entre chez
Tara est l'abonnement de la vendeuse.

---

# LES LOTS

## Lot 0 — Hygiène du dépôt

**Objectif** : partir d'une base saine et traçable.

- Fusionne la branche de travail dans `main`, fais de `main` la branche par
  défaut, et tague l'état actuel `v1.0-mock` (V1+V2 complets, fournisseurs
  simulés).
- Crée `ROADMAP-PROD.md` : la liste des lots 0 à 7 avec des cases à cocher,
  une section « décisions prises » et une section « questions ouvertes ».
- Trie les vulnérabilités npm — **ne lance surtout pas `npm audit fix --force`**.
  Produis un tableau : paquet, sévérité, est-il exécuté en production ou
  seulement dans l'outillage de développement, correctif disponible sans
  changement de version majeure (oui/non), recommandation. **Corrige uniquement
  ce qui est à la fois exécuté en production et corrigeable sans casse.**
  Documente le reste dans `ROADMAP-PROD.md`.

**Rapport attendu** : le tableau des vulnérabilités et ta recommandation.

---

## Lot 1 — Paiement direct vendeuse (le lot qui rend le produit vendable)

**Contexte** : MIKE n'a aucun contrat avec un agrégateur Mobile Money, et n'en
aura pas avant plusieurs semaines. Il faut donc un mode de paiement qui ne
dépende de personne : l'acheteur envoie l'argent au numéro MoMo de la vendeuse,
lui-même, avec son téléphone.

**Fichiers à lire** : `CLAUDE.md` (R1, R2), `src/lib/payments.ts`,
`src/lib/whatsapp.ts`, `src/lib/orders.ts`, `src/app/[slug]/` (tout le parcours
d'achat), `src/app/app/commandes/`, `src/app/app/reglages/`.

**Exigences** :

- Une boutique a un **mode de paiement** : `direct` (défaut) ou `agregateur`.
  Nouvelle migration ; ne touche pas aux existantes.
- En mode `direct` : dans ses réglages, la vendeuse saisit son **numéro MoMo**
  (validé par le schéma `phoneCm` existant) et l'**opérateur** (MTN / Orange).
- Après validation de la commande, l'acheteur voit une page qui affiche :
  le numéro de la vendeuse, l'opérateur, le montant exact, la référence
  de commande `B-XXXX`, et un bouton qui ouvre WhatsApp avec un message
  pré-rempli reprenant ces informations.
- La commande passe dans un état « **paiement annoncé** » ; c'est la
  vendeuse qui la marque payée depuis son espace. Respecte la machine à
  états existante (`TRANSITIONS`) — ajoute les transitions, ne les contourne pas.
- **Textes (R1)** : l'acheteur doit comprendre qu'il paie **une personne**, pas
  une plateforme. Formulation à respecter dans l'esprit de celle déjà validée
  dans `src/lib/i18n.ts`. Interdit : « paiement sécurisé », « garanti par
  Tara », « remboursé si… ». Toutes les chaînes passent par `i18n.ts`, FR et EN.
- **Sans JavaScript**, de bout en bout.

**Tests exigés** : commande en mode direct jusqu'à la confirmation ; passage
en « payée » par la vendeuse ; refus d'une transition illégale ; boutique en
mode direct sans numéro MoMo renseigné (message clair, pas de plantage) ;
coexistence des deux modes.

**Rapport attendu** : les captures textuelles (`curl`) des trois écrans clés et
la liste des chaînes ajoutées à `i18n.ts`.

---

## Lot 2 — Encaissement de l'abonnement, à la main

**Contexte** : l'abonnement de 3 000 F/mois est l'unique revenu de Tara. Sans
compte marchand, la vendeuse envoie l'argent sur le MoMo personnel de MIKE et
c'est lui qui active.

**Fichiers à lire** : `src/lib/subscriptions.ts`, `src/lib/plan.ts`,
`src/app/admin/`, `src/lib/admin.ts` (journal d'audit).

**Exigences** :

- Dans le back-office, pour chaque boutique : **activer un abonnement
  manuellement** pour N mois, avec un champ « référence du paiement reçu »
  (l'identifiant de la transaction MoMo, saisi à la main) et un champ note.
- Possibilité d'accorder une **période offerte** (pour les vendeuses pilotes),
  **distinguée d'un abonnement payé dans les données** — sinon tes chiffres de
  revenu seront faux dès le premier mois.
- Toute activation manuelle est **journalisée** (`audit_log`) : qui, quand,
  quelle boutique, quelle référence.
- L'écran admin montre, par boutique : plan en cours, date d'expiration,
  origine (payé / offert), nombre d'articles.
- **Réutilise la logique d'abonnement existante** ; n'ouvre pas un second chemin
  parallèle qui divergerait de celui de l'agrégateur.

**Tests exigés** : activation manuelle → la limite de 10 articles saute ;
expiration → la limite revient ; double activation idempotente ; l'entrée
d'audit est bien écrite.

---

## Lot 3 — Ce qu'un site public doit avoir

**Exigences** :

- **Pages légales** : conditions générales d'utilisation, mentions légales,
  politique de confidentialité (données collectées, durée, contact, droit de
  suppression). Rédige des versions sobres et honnêtes, adaptées au Cameroun,
  et relis-les contre **R1 : aucune garantie financière**. Marque clairement
  en tête de `ROADMAP-PROD.md` qu'elles **doivent être relues par un humain**
  avant ouverture — tu n'es pas juriste et tu le dis.
- La politique de confidentialité doit avoir une **URL stable** : TikTok
  l'exigera au moment de la demande du Login Kit.
- **Aperçu de partage (OG)** : quand le lien d'une boutique est collé dans
  WhatsApp ou TikTok, il doit afficher le nom de la boutique, une phrase et
  une image. **Génère l'image dynamiquement** à partir des données de la boutique
  plutôt que d'exiger un fichier par vendeuse.
- **Pages 404 et 500** dans l'esprit visuel du produit, avec un chemin de
  retour vers la boutique ou l'accueil.
- **`robots.txt`** et un **sitemap** des boutiques publiques actives.

**Tests exigés** : les balises OG sont présentes et correctes sur une page
boutique et une page article ; les pages légales répondent en 200 ; la 404
s'affiche sur un slug inconnu.

---

## Lot 4 — PostgreSQL

**Règle absolue** : cette migration se fait **AVANT** le déploiement, jamais après.

**Fichiers à lire** : `src/lib/db.ts`, `migrations/*.sql`, `src/lib/orders.ts`
(décrémentation du stock), `src/app/api/webhooks/` (idempotence).

**Exigences** :

- Le dialecte Kysely est choisi d'après `DATABASE_URL` : `postgres://` →
  PostgreSQL, `file:` → SQLite. **Le code métier ne change pas.**
- Passe **chaque migration** en revue et corrige ce qui est spécifique à
  SQLite : `AUTOINCREMENT`, types, `datetime('now')`, `INSERT OR REPLACE`,
  booléens stockés en entiers, comparaisons de dates.
- Les deux points critiques, à traiter en priorité et **à prouver** :
  - la **décrémentation atomique du stock** (R4) ;
  - la **garde d'idempotence des webhooks** (R3), y compris le comportement de
    la contrainte `UNIQUE` sur `dedup_key` — sur PostgreSQL, une violation
    de contrainte **avorte la transaction en cours**, ce qui n'est pas le cas
    sur SQLite. Vérifie ce chemin explicitement.
- Écris un **test de concurrence qui tourne réellement contre PostgreSQL** :
  10 commandes simultanées sur un stock de 3 → exactement 3 succès, 7 refus,
  stock final à 0. Un test qui ne s'exécute que sur SQLite ne prouve rien ici.
  Si l'exécution demande un PostgreSQL local ou en conteneur, dis-le et
  donne la commande exacte à lancer.
- Documente dans le README la procédure de **bascule** et de **sauvegarde**.

**Rapport attendu** : la liste des incompatibilités trouvées et corrigées, et
le résultat du test de concurrence sur PostgreSQL.

---

## Lot 5 — Déploiement

**Objectif** : `tara.shop` accessible publiquement, sur un VPS Ubuntu.

**Exigences** :

- **Service systemd** (redémarrage automatique, variables d'environnement hors
  du dépôt, utilisateur non privilégié).
- **Configuration Nginx** : TLS, redirection HTTP → HTTPS, en-têtes de sécurité
  cohérents avec ceux déjà posés dans `next.config.mjs` (ne les duplique pas
  en les contredisant), taille maximale d'envoi adaptée aux photos d'articles.
- **`scripts/deploy.sh`** : récupération du code, installation, build, migrations,
  redémarrage, avec **arrêt immédiat en cas d'échec** — jamais un redémarrage
  sur une migration échouée.
- **Sauvegarde PostgreSQL quotidienne**, avec rotation, et un script de
  restauration.
- **Surveillance minimale** : que faire pour être prévenu si le site tombe.
- Une **section README** qui explique chaque commande à taper, dans l'ordre,
  en supposant que MIKE part d'un VPS vierge.

Tu ne te connectes à **aucun serveur**. Tu produis les fichiers et la procédure ;
c'est MIKE qui exécute.

---

## Lot 6 — Le pré-vol

**Objectif** : rendre impossible une mise en ligne avec des fournisseurs simulés.

Écris `scripts/preflight.mjs`, à lancer avant toute ouverture au public.
Il **échoue avec un message clair** si :

- un fournisseur vaut encore `mock` alors que `NODE_ENV=production` ;
- `PAYMENT_MOCK_AUTOCONFIRM` n'est pas vide ;
- `SESSION_SECRET` fait moins de 32 caractères, ou vaut encore la valeur
  d'exemple ;
- un secret de webhook est vide ou reste à sa valeur d'exemple ;
- `NEXT_PUBLIC_BASE_URL` pointe encore sur `localhost` ;
- aucun compte administrateur n'existe, ou le mot de passe de démonstration
  est encore valide ;
- les boutiques de démonstration du seed sont présentes en base.

Branche-le dans `deploy.sh`, **avant le redémarrage**.

Ajoute au README une **checklist de pré-vol pour l'humain** — ce que le
script ne peut pas vérifier : sauvegarde effectivement restaurée une fois,
vitrine ouverte depuis le navigateur intégré de TikTok sur un vrai téléphone
en 3G, textes acheteur relus contre R1.

---

## Lot 7 — Mesurer le pilote

**Contexte** : dix vendeuses recrutées à la main. Quatre chiffres décident de
la suite ; le back-office doit les donner d'un coup d'œil, sans export.

**Exigences** : un écran admin « Pilote » affichant, par semaine :

- boutiques créées ;
- **boutiques ayant reçu au moins une visite venant de TikTok dans les
  7 derniers jours** — c'est le meilleur indicateur disponible du fait que
  le lien est encore dans la bio, et c'est la métrique la plus importante
  du projet ;
- commandes par boutique et par semaine, et délai entre la création de la
  boutique et sa première commande ;
- abonnements **payés** (pas offerts) au deuxième mois.

Appuie-toi sur `src/lib/stats.ts` et `src/lib/track.ts`. Si l'attribution de
source actuelle ne permet pas de distinguer une visite venant de TikTok,
dis-le franchement et propose la plus petite modification qui le permette.

---

# APRÈS LE PILOTE — lots conditionnés

Ces lots ne se déclenchent que sur décision de MIKE, chacun étant bloqué par
une démarche externe. **Ne les commence pas de ta propre initiative.**

| Lot | Déclencheur | Ce qu'il faut avoir en main |
|---|---|---|
| Passerelle SMS | l'inscription manuelle des vendeuses devient pénible | contrat agrégateur SMS + Sender ID approuvé + doc de l'API |
| Agrégateur Mobile Money | assez de volume pour justifier une commission | registre de commerce + contrat + doc de l'API + secret de webhook |
| TikTok Login Kit réel | besoin du badge vérifié et de l'import des vidéos | app validée sur developers.tiktok.com + URL de politique de confidentialité |
| WhatsApp Cloud API | le coût des SMS devient supérieur à celui des templates | société vérifiée par Meta + templates approuvés |

Rappel pour le jour où ces lots s'ouvriront : chacun consiste à écrire une
classe derrière une interface existante (`OtpProvider`, `NotifyProvider`,
`PaymentProvider`, `TikTokProvider`) et à la retourner depuis le
`get…Provider()` correspondant. **Si tu te retrouves à modifier une page pour
brancher un fournisseur, l'abstraction est mal placée** — arrête-toi et signale-le.

---

# Format du rapport de fin de lot

À la fin de chaque lot, rends exactement ceci :

1. **Fait** — ce qui a changé, fichier par fichier, en une ligne chacun.
2. **Vérifié** — build, tests (nombre avant/après), et la preuve concrète du
   parcours essayé (commande `curl` et ce qu'elle a renvoyé).
3. **Décisions** — les choix que tu as dû faire et pourquoi.
4. **Questions ouvertes** — ce sur quoi tu as dû trancher seul et que MIKE
   devrait confirmer.
5. **À faire par MIKE** — les actions humaines que ce lot rend nécessaires.
6. **Prochain lot** — son numéro et ce qui le bloque, s'il est bloqué.

Puis tu t'arrêtes.
