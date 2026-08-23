# Boutika — Architecture technique

## Stack
- **Mobile** : React Native + Expo
- **Base locale (offline-first)** : WatermelonDB
- **Backend** : Supabase (Postgres + Auth + Storage)
- **IA (Premium uniquement)** :
  - Voix → texte : OpenAI `gpt-4o-mini-transcribe` (clips 15s max)
  - OCR facture : Google Cloud Vision (TEXT_DETECTION)
- **Paiement** : MTN MoMo + Orange Money, via site web externe (pas d'IAP dans l'app)
- **SMS** : Termii ou Africa's Talking (vérification différée, pas à l'inscription)

## Structure des dossiers

```
boutika/
├── app/                        # Écrans (Expo Router)
│   ├── (auth)/
│   │   ├── inscription.tsx
│   │   ├── verification-otp.tsx
│   │   └── config-boutique.tsx
│   ├── (tabs)/
│   │   ├── accueil.tsx
│   │   ├── stock.tsx
│   │   ├── dashboard.tsx
│   │   ├── clients.tsx
│   │   └── reglages.tsx
│   ├── vente/
│   │   ├── vocal.tsx
│   │   ├── scan.tsx
│   │   └── confirmation.tsx
│   ├── creances/
│   │   └── index.tsx
│   ├── produit/
│   │   ├── nouveau.tsx
│   │   └── [id].tsx
│   ├── historique/
│   │   └── index.tsx
│   ├── transaction/[id].tsx
│   ├── notifications.tsx
│   ├── premium/
│   │   └── index.tsx           # paywall
│   ├── comptabilite/
│   │   └── index.tsx
│   ├── export/
│   │   └── index.tsx
│   ├── contact.tsx
│   └── etats/
│       ├── vide.tsx
│       └── hors-ligne.tsx
│
├── lib/
│   ├── db/                     # WatermelonDB : schéma local + modèles
│   ├── supabase/                # client Supabase + requêtes
│   ├── ai/
│   │   ├── voice.ts             # appel OpenAI gpt-4o-mini-transcribe
│   │   ├── ocr.ts               # appel Google Vision
│   │   └── extraction.ts        # règles métier texte → { produit, quantite, prix, client }
│   ├── config/
│   │   └── remoteConfig.ts      # lit app_config depuis Supabase (feature flags, prix)
│   ├── subscription/
│   │   └── checkPremium.ts      # vérification serveur uniquement, jamais en local
│   └── i18n/
│       └── index.ts             # détection langue système + traductions
│
├── components/
│   ├── ActionBar.tsx            # barre vocal/scan/manuel de l'accueil
│   ├── PremiumBadge.tsx
│   ├── OfflineBanner.tsx
│   └── ...
│
└── supabase/
    └── schema.sql                # (ce fichier)
```

## Principes clés à respecter dans le code

1. **Rien de codé en dur** : prix, promotions, clés API, activation IA → tout vient de la
   table `app_config` / `promotions`, lue au démarrage et mise en cache localement.
2. **Offline d'abord** : toutes les tables métier (produits, ventes, créances) vivent dans
   WatermelonDB en local ; la synchronisation vers Supabase se fait en tâche de fond dès
   qu'une connexion est détectée.
3. **IA = fonctionnalité isolée** : si `ai_features_enabled = false` ou clé API absente,
   les boutons vocal/scan s'affichent désactivés avec le message "Bientôt disponible" —
   aucun crash, aucun blocage des autres écrans.
4. **Vérification Premium** : jamais un booléen stocké uniquement sur le téléphone.
   Toujours une requête à `utilisateurs_premium` (vue Supabase) ou une Edge Function.
5. **Vérification téléphone différée** : `telephone_verifie = false` à l'inscription,
   passe à `true` seulement au moment de l'abonnement Premium ou après 7 jours d'activité.

## Prochaine étape recommandée

Pour la suite (écrire le code des écrans, connecter WatermelonDB à Supabase, tester sur un
vrai appareil Android/iOS), **Claude Code** est l'outil adapté — il permet de travailler
directement sur le projet complet, d'exécuter `expo start`, de tester en direct, et
d'itérer écran par écran avec accès à tout le système de fichiers du projet.
