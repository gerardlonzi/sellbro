# Refonte premium Cikap

## Design system
- Police Plus Jakarta Sans (components/Texte.tsx, lib/theme/typography.ts), appliquée à toute l'app.
- Nouvelles palettes claire/sombre (lib/theme/colors.ts), ombres, cartes élevées.
- Animations: components/anim.tsx (Apparition, PressableAnime, pulsation, shimmer).
- UI.tsx: boutons dégradés, Carte, Badge, Skeleton, EnteteEcran.

## Ouverture / navigation
- SplashAnime (logo animé), splash natif assorti (app.json).
- Transitions de pile (slide, modal en bas) et fondu entre onglets, barre d'onglets animée.

## Pages pro avec image de fond (clair + sombre)
- PlanBloc.tsx: page Plan en un seul bloc, onglets par offre, avantages détaillés (premium/index + onboarding/plan).
- ModalePremium.tsx: popups Welcome, Paywall, Expiration (WelcomeTrial, PaywallPopup).
- assets/bg-*-{dark,light}.jpg via lib/theme/fonds.ts.

## Scan & Vocal IA
- Entrées visibles: page Plus (Outils intelligents), accueil (ActionsRapides), bouton flottant des ventes (speed-dial), nouvelle vente.
- scan-facture/index.tsx: caméra, galerie, lampe, quota/paywall, animations.
- vente/vocal.tsx: enregistrement animé, transcription éditable.
- scan-facture/validation.tsx: écran de validation complet (produits, dépenses, paiement, crédit, doublons) -> enregistrerScan.
- SelecteurProduit, creerProduitRapide.

## Passe 2 — production
- Paiement : plan transmis en paramètre de route + confirmation serveur (plan_id/montant) avant d'ouvrir SasPay ; récapitulatif plan/prix à l'écran d'attente.
- Scan/vocal : popup « Réservé à Premium » pour Starter/Gratuit (ouvrirOutilIA), icônes IA (IconeIA), erreurs réelles (réseau / serveur / quota / illisible).
- Montants : abrégés ≥ 100 000 (« 100 K FCFA », « 1,25 M FCFA ») sur accueil, dashboard, listes ; texte qui se réduit au lieu de déborder.
- Scanners plein écran (facture + code-barres) ; accueil : carrousel 2 pages + actions rapides après créances/dettes.
- Pages pro : réglages (CarteAbonnement), stock, ventes, créances, dashboard (aperçu/prévisions), notifications, états vides (EtatVide), formulaires fournisseurs/dépenses avec champs supplémentaires.
- Voir ACTIONS-A-FAIRE.md pour les étapes côté Supabase.

## 2026-10-24
- Connexion, code OTP (6 cases, renvoi avec compte à rebours), inscription, config boutique : nouveau cadre `components/EcranAuth.tsx`.
- Nouvelle vente : 4 tuiles d'action alignées ; total + boutons dans la barre fixe du bas.
- Plan/sync après connexion, paiement multi-agrégateurs, bascule IA, préférences synchronisées, diagnostic (voir sections précédentes).
