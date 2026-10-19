# Brancher Instagram (publication + DM automatiques)

À faire une seule fois. Compter 30 à 45 minutes. Tout ce qui est secret va dans `.env`
(local, jamais commité) et dans les variables d'environnement Vercel.

## 1. Compte Instagram professionnel
Dans l'app Instagram : Paramètres → Type de compte → passer en **compte Professionnel**
(Créateur ou Entreprise). Activer aussi **Messages → Outils connectés → Autoriser l'accès aux
messages** (sinon aucun DM automatique ne part).

## 2. Application Meta
1. https://developers.facebook.com/apps → **Créer une app** → type **Business**.
2. Ajouter le produit **Instagram** → **API setup with Instagram login**.
3. Dans « Generate access tokens », ajouter le compte Instagram et générer un jeton :
   c'est `IG_ACCESS_TOKEN` (jeton longue durée, 60 jours). L'ID affiché est `IG_USER_ID`.
4. Permissions à cocher : `instagram_business_basic`, `instagram_business_content_publish`,
   `instagram_business_manage_comments`, `instagram_business_manage_messages`.
5. **App secret** de l'app Instagram (Paramètres de l'app Instagram) : `IG_APP_SECRET`.
6. Tant que l'app est en mode développement, seuls les comptes ayant un rôle sur l'app
   déclenchent les webhooks. Pour répondre au public : passer l'app **en direct** (Live) et,
   si Meta le demande, faire l'App Review des permissions ci-dessus.

## 3. Supabase (stockage des vidéos + campagnes CTA)
1. Créer un projet (ou en réutiliser un).
2. Appliquer `supabase/migrations/20261019000000_cta.sql` (SQL editor, ou demander à Claude
   de le faire via l'intégration Supabase).
3. Récupérer `SUPABASE_URL` et la clé **service_role** (`SUPABASE_SERVICE_ROLE_KEY`) dans
   Project Settings → API. Cette clé ne doit jamais aller dans le navigateur ni dans git.

## 4. Webhook sur Vercel
1. Importer ce dépôt dans Vercel (aucune build : la fonction `api/instagram-webhook.mjs`
   est détectée automatiquement).
2. Variables d'environnement Vercel : `IG_ACCESS_TOKEN`, `IG_USER_ID`, `IG_APP_SECRET`,
   `IG_VERIFY_TOKEN` (une phrase aléatoire de ton choix), `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`.
3. Dans l'app Meta → Instagram → **Webhooks** :
   - Callback URL : `https://<ton-projet>.vercel.app/api/instagram-webhook`
   - Verify token : la valeur de `IG_VERIFY_TOKEN`
   - S'abonner au champ **comments**.

## 5. Vérifier
```bash
cp .env.example .env   # puis remplir
node automation/bin/ig.mjs me                       # le compte s'affiche
node automation/bin/ig.mjs cta add --media '*' --keyword TEST --dm-text "Ça marche !" \
  --button "Ouvrir" --url https://example.com
```
Depuis un **autre** compte, commenter « TEST » sous un de tes posts : le DM doit arriver.
Puis `node automation/bin/ig.mjs cta off <id>` pour couper la campagne de test.

## Entretien
- Tous les ~50 jours : `node automation/bin/ig.mjs refresh-token`, puis mettre à jour
  `IG_ACCESS_TOKEN` dans `.env` et sur Vercel (Claude peut le faire via l'intégration Vercel).
- Les vidéos déposées dans le bucket `reels` peuvent être supprimées une fois publiées.
