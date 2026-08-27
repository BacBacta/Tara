# Passer à l'implémentation avec Claude Code

Ce document te sert de point de départ sur **ta machine**. Le code de Tara
(V1 + V2, 13 commits, 65 tests verts) est complet et fonctionne en local avec
des fournisseurs simulés. Ce qui reste à faire, ce sont les **branchements
réels** et le **déploiement** — c'est exactement ce que Claude Code fait bien.

---

## 1. Installer le projet (15 minutes)

```bash
# 1. décompresser l'archive livrée
tar -xzf tara-v1-v2.tar.gz
cd tara

# 2. dépendances (Node 20 ou plus)
npm install

# 3. configuration
cp .env.example .env
# ouvrir .env et remplacer SESSION_SECRET par 32+ caractères aléatoires :
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 4. base de données + données de démo
npm run db:migrate
npm run db:seed
node scripts/create-admin.mjs admin@tara.shop TonMotDePasse

# 5. démarrer
npm run dev
```

Puis ouvre :

| URL | Ce que tu vois |
|---|---|
| `localhost:3000/nadia-friperie-237` | une vitrine de démo (FR, MoMo actif) |
| `localhost:3000/kev-sneakers` | une vitrine en anglais |
| `localhost:3000/creer` | l'onboarding vendeuse (le code OTP s'affiche dans le terminal) |
| `localhost:3000/app` | l'espace vendeuse |
| `localhost:3000/admin` | le back-office |

Vérifie que tout est sain :

```bash
npm test        # 65 tests
npm run build   # compilation TypeScript
```

## 2. Lancer Claude Code

```bash
npm install -g @anthropic-ai/claude-code   # une seule fois
cd tara
claude
```

Le fichier **`CLAUDE.md`** à la racine est lu automatiquement : il contient les
règles du projet (les cinq invariants, la carte du code, ce qu'il ne faut pas
faire). Tu n'as pas besoin de les répéter à chaque session.

Deux réflexes utiles :
- `/init` n'est **pas** nécessaire, `CLAUDE.md` existe déjà ;
- avant un gros chantier, demande d'abord **un plan**, valide-le, puis fais
  exécuter. Le prompt de chaque chantier ci-dessous est déjà écrit dans cet esprit.

---

## 3. Les chantiers, dans l'ordre de priorité

L'ordre compte : les deux premiers suffisent à lancer avec de vraies vendeuses.
Les suivants ne se justifient qu'avec du volume.

| # | Chantier | Pourquoi maintenant | Ce que ça te coûte avant de commencer |
|---|---|---|---|
| 1 | **Passerelle SMS locale** | sans SMS, aucune vendeuse ne peut créer son compte (OTP) | un compte chez un agrégateur SMS camerounais, ~15-25 F/SMS |
| 2 | **PostgreSQL + déploiement** | SQLite ne tient pas en production multi-utilisateurs | un VPS (~5 000-15 000 F/mois) + le domaine `tara.shop` |
| 3 | **Paiement direct vendeuse** | fonctionne **sans aucun contrat** : le message WhatsApp contient le numéro MoMo et le montant | rien |
| 4 | **Agrégateur Mobile Money** | confirmation automatique du paiement | un contrat agrégateur + justificatifs d'entreprise |
| 5 | **TikTok Login Kit réel** | badge vérifié + import des vidéos | une app validée sur developers.tiktok.com |
| 6 | **WhatsApp Cloud API** | notifications en masse moins chères qu'en SMS | société vérifiée par Meta + templates approuvés |

---

## 4. Prompts prêts à coller

### Chantier 1 — Passerelle SMS

```
Lis CLAUDE.md puis src/lib/notify.ts et src/lib/otp.ts.

Je viens de souscrire chez <NOM DE L'AGRÉGATEUR>. Voici sa documentation :
<COLLE ICI LA DOC OU L'URL>

Branche cette passerelle derrière l'interface NotifyProvider existante, sans
modifier aucun appelant. Contraintes :
- une seule classe nouvelle, retournée par getNotifyProvider() quand
  NOTIFY_PROVIDER="sms" ;
- gère l'échec réseau : un SMS qui ne part pas ne doit jamais faire échouer
  une commande, seulement être journalisé ;
- respecte la limite de 160 caractères et le timeout existants ;
- ajoute les variables dans .env.example ;
- écris les tests avec un fetch simulé (succès, erreur 4xx, timeout).

Montre-moi d'abord le plan, puis attends mon accord.
```

### Chantier 2 — PostgreSQL + mise en ligne

```
Lis CLAUDE.md, src/lib/db.ts et migrations/.

Objectif : faire tourner Tara sur PostgreSQL en production, SQLite restant le
mode développement. Le code métier ne doit pas changer.

1. Fais choisir le dialecte Kysely par DATABASE_URL (postgres:// → PostgresDialect).
2. Vérifie chaque migration SQL : signale et corrige ce qui est spécifique à
   SQLite (AUTOINCREMENT, types, datetime('now'), INSERT OR REPLACE...).
3. Vérifie que la décrémentation atomique du stock et les gardes d'idempotence
   des webhooks se comportent pareil sur PostgreSQL. C'est le point critique.
4. Ajoute au README la procédure de bascule et de sauvegarde.

Plan d'abord.
```

Puis, une fois le VPS prêt :

```
Lis la section déploiement du README. Écris-moi les fichiers de mise en ligne
pour un VPS Ubuntu : service systemd, configuration Nginx avec TLS pour
tara.shop, script de sauvegarde PostgreSQL quotidien, et un script deploy.sh
qui fait build + migrate + redémarrage. Explique-moi chaque commande à taper.
```

### Chantier 3 — Paiement direct vendeuse (rapide, gratuit)

```
Lis CLAUDE.md (surtout la règle R1 : Tara n'encaisse jamais) puis
src/lib/whatsapp.ts et le parcours src/app/[slug]/.

Ajoute un mode de paiement "direct" pour les boutiques sans agrégateur :
- la vendeuse renseigne son numéro MoMo dans ses réglages ;
- après la commande, l'acheteur voit ce numéro, le montant, et un bouton qui
  ouvre WhatsApp avec un message pré-rempli ;
- la vendeuse marque elle-même la commande comme payée dans son espace ;
- aucun texte ne doit laisser croire que Tara sécurise ou garantit le paiement.

Le parcours doit fonctionner sans JavaScript. Tests inclus. Plan d'abord.
```

### Chantier 4 — Agrégateur Mobile Money

```
Lis CLAUDE.md, src/lib/payments.ts et src/app/api/webhooks/payment/route.ts.

Voici la documentation de <AGRÉGATEUR> : <COLLE LA DOC>

Implémente PaymentProvider pour ce fournisseur et remplace la vérification de
signature du webhook par la vraie. Exigences :
- l'idempotence actuelle (UPDATE ... WHERE status='pending') est conservée
  telle quelle ;
- un webhook déjà traité répond 200 ;
- une signature invalide répond 401 et est journalisée ;
- teste : paiement confirmé, paiement échoué, webhook rejoué 3 fois,
  signature falsifiée.

Plan d'abord.
```

### Chantier 5 — TikTok Login Kit réel

```
Lis CLAUDE.md et src/lib/tiktok.ts (MockTikTokProvider), src/lib/identities.ts
et src/app/app/tiktok/.

Mon app TikTok est validée. client key et secret sont dans .env.
Implémente le TikTokProvider réel : échange du code OAuth, rafraîchissement du
jeton, Display API (user.info.basic, user.info.profile, user.info.stats,
video.list), et la vérification de signature des webhooks.
Les jetons restent chiffrés en AES-256-GCM via src/lib/crypto.ts.
Le mock reste utilisable pour les tests. Plan d'abord.
```

---

## 5. Ce que Claude Code ne peut pas faire pour toi

Ces démarches sont administratives et te reviennent :

- **réserver `tara.shop`** avant d'en parler publiquement ;
- **déposer la marque Tara à l'OAPI** (Yaoundé) — les classes 35 et 42 ;
- **ouvrir le compte chez l'agrégateur SMS**, puis plus tard chez l'agrégateur
  Mobile Money (il te demandera un registre de commerce) ;
- **recruter les 10 premières vendeuses à la main.** C'est le vrai test. Le code
  est prêt ; ce qui décidera du sort du produit, c'est de savoir si une vendeuse
  de friperie de Douala met le lien dans sa bio et le garde une semaine.

---

## 6. Rappel du garde-fou principal

Tara **n'encaisse pas** l'argent des vendeuses. Aucune ligne de code, aucun
texte d'interface, aucune plaquette commerciale ne doit promettre un
remboursement, un séquestre ou une garantie de paiement. C'est écrit dans
`CLAUDE.md` (règle R1) pour que l'agent le respecte, mais c'est à toi de le
tenir dans ta communication.
