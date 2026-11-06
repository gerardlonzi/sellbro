# Cikap — ce que TU dois faire avant la production

## 1. Supabase (obligatoire — la cause probable du bug « Starter facture le prix Pro »)
Le code de l'app est correct : le plan choisi est maintenant envoyé explicitement et le serveur doit
confirmer `plan_id` + montant. Si tu vois le message « le serveur de paiement n'est pas à jour »,
c'est que les anciennes fonctions sont encore déployées.

```
supabase functions deploy create-saspay-checkout
supabase functions deploy verify-payment
supabase functions deploy saspay-webhook
supabase functions deploy analyser-document
supabase functions deploy transcrire-vocal
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set SASPAY_SECRET_KEY=...
supabase secrets list
```

## 2. Base de données
Exécuter dans l'ordre (SQL Editor ou `supabase db push`) si ce n'est pas déjà fait :
`supabase/migrations/20260920_…` → `20261017_scanner_quota_index.sql`
(en particulier `20261010_plans_3_tiers.sql` : colonne `payment_transactions.plan_id`).

## 3. Prix des abonnements = table `plans` (jamais en dur dans l'app)
```sql
select id, prix, prix_par_devise from plans where id in ('starter','premium');
update plans set prix = 1500 where id = 'starter';    -- prix en XAF
update plans set prix = 3500 where id = 'premium';    -- adapte à tes vrais prix
-- Autres devises (le checkout lit prix_par_devise->>'<DEVISE>') :
update plans set prix_par_devise = '{"XOF":1500,"GHS":30,"KES":300}' where id = 'starter';
```
Sans `prix_par_devise` pour une devise, le checkout renvoie « prix non configuré » (comportement voulu :
on ne facture jamais un montant inventé). Starter et Premium doivent avoir des prix DIFFÉRENTS.

## 4. Vérifier le plan enregistré après paiement (test)
1. Compte test → Plan → Starter → payer → attendre le webhook.
2. `select plan_id, statut, date_expiration from abonnements where user_id = '<id>';` → `starter`, `actif`.
3. `select plan_id, amount, status from payment_transactions order by created_at desc limit 3;`
4. Starter : scan/vocal doivent afficher « Réservé à Premium ». Premium : ils s'ouvrent.

## 5. Build natif (caméra, micro, polices)
`npm install` puis `npx expo prebuild` / `eas build` (pas Expo Go). Vérifier sur un vrai téléphone :
polices Android, caméra (scan facture + code-barres plein écran), micro, lampe.

## 6. À tester avant de publier
- Scan facture : photo nette ; photo volontairement floue ; mode avion (doit dire « pas de connexion », pas « image floue »).
- Vocal : phrase claire ; silence ; sans connexion.
- Montants ≥ 100 000 (affichés « 100 K FCFA », « 1,25 M FCFA ») sur accueil, dashboard, listes.
- Langue FR ↔ EN sur popups, toasts et alertes.
- Mode clair et sombre sur chaque page.

## 7. Idées produit (non faites — à prioriser)
- Reçu de vente PDF/WhatsApp avec logo de la boutique ; QR de paiement.
- Inventaire physique (comptage) + écarts de stock ; alertes de péremption.
- Remises / TVA par vente ; ventes à plusieurs paiements.
- Fiche client (historique, solde, relance WhatsApp automatique).
- Rôles employés avec permissions par page ; journal d'activité exportable.
- Sauvegarde/restauration visible ; mode « caisse » rapide ; imprimante Bluetooth.

## Mise à jour 29/10 — à faire
1. SQL Editor : exécuter `migration_suppression_utilisateur_garder_essai.sql` (suppression d'un utilisateur possible depuis Authentication → Users, son essai gratuit est conservé et retrouvé par email s'il recrée un compte).
2. Redéployer : `npx supabase functions deploy create-checkout maj-taux transcrire-vocal analyser-document verify-payment`.
3. Optionnel : `update ia_providers set delai_ms = 25000 where id = 'gemini';` et vérifier `modele_vision` / `modele_audio` (nom exact du modèle Gemini utilisé).
