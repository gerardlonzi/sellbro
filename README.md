# Boutika — Guide de démarrage

Ce fichier liste tout ce qu'il faut installer et créer avant de commencer à coder avec
Claude Code. Suis les étapes dans l'ordre.

## 1. Outils à installer sur ton ordinateur

| Outil | Pourquoi | Lien |
|---|---|---|
| **Node.js** (version 20 ou plus) | Nécessaire pour faire tourner React Native/Expo | https://nodejs.org |
| **Git** | Pour sauvegarder et versionner ton code | https://git-scm.com |
| **Claude Code** (desktop) | L'outil avec lequel tu vas coder l'app | déjà proposé dans le chat |
| **Expo Go** (app mobile, sur ton téléphone) | Pour tester l'app en direct sur ton téléphone pendant le développement, sans passer par le Play Store | Play Store / App Store, cherche "Expo Go" |

Tu n'as **pas besoin** d'installer Android Studio ou Xcode pour commencer — Expo Go sur ton
téléphone suffit largement pour tester au fur et à mesure.

## 2. Créer ton compte Supabase (base de données + authentification)

1. Va sur https://supabase.com et crée un compte gratuit
2. Crée un nouveau projet, note bien :
   - l'**URL du projet** (ressemble à `https://xxxxx.supabase.co`)
   - la **clé publique anon** (dans Project Settings → API)
3. Dans l'onglet **SQL Editor** de Supabase, colle le contenu du fichier `schema.sql`
   qu'on a généré, et exécute-le — ça crée toutes les tables d'un coup
4. Dans **Authentication → Providers**, active l'authentification par téléphone
   (tu connecteras Termii ou Africa's Talking plus tard, pas obligatoire pour commencer
   à coder les écrans)

## 3. Comptes à créer plus tard (pas urgent pour commencer)

Tu n'as pas besoin de ça tout de suite — l'app doit fonctionner sans, comme prévu dans
l'architecture (fonctionnalités IA désactivées proprement en attendant) :

- **OpenAI** (https://platform.openai.com) — pour la transcription vocale, plus tard
- **Google Cloud** (https://console.cloud.google.com) — pour l'OCR, nécessite une carte
  bancaire à l'inscription (voir notre discussion précédente)
- **Termii** ou **Africa's Talking** — pour l'envoi de SMS de vérification
- **MTN MoMo** / **Orange Money** — comptes marchands pour encaisser les abonnements

## 4. Ce que tu diras à Claude Code pour démarrer

Une fois Claude Code ouvert, donne-lui les 3 fichiers qu'on a préparés
(`schema.sql`, `ARCHITECTURE.md`, ce README) et dis-lui par exemple :

> "Voici le schéma de ma base de données et l'architecture de mon app Boutika.
> Crée le projet Expo, connecte-le à Supabase avec ces infos [URL + clé anon],
> et commence par l'écran d'accueil."

Il va :
1. Créer le projet Expo (`npx create-expo-app`)
2. Installer les dépendances nécessaires (WatermelonDB, Supabase client, etc.)
3. Te donner un QR code à scanner avec l'app Expo Go sur ton téléphone
4. Coder l'écran demandé, que tu verras apparaître en direct sur ton téléphone

## 5. Ordre recommandé pour construire les écrans

Pour éviter de te disperser, avance dans cet ordre logique :

1. Inscription + vérification OTP (sans bloquer, comme décidé)
2. Accueil (avec les données de test, pas encore connecté à la vraie base)
3. Ajout manuel de produit / vente (le cœur de l'app, sans IA)
4. Stock, Dashboard, Créances/dettes
5. Connexion réelle à Supabase (remplacer les données de test)
6. Mode hors-ligne (WatermelonDB + synchronisation)
7. Vocal et Scan (une fois que le reste fonctionne bien)
8. Abonnement Premium + paiement
9. Notifications, réglages, export

## 6. Un rappel important

Garde toujours en tête les principes de l'architecture : **rien de codé en dur**
(prix, promotions, clés API viennent de la table `app_config`), et **toutes les
fonctionnalités non-IA doivent marcher même sans les clés API branchées**.
