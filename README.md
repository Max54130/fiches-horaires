# Fiches Horaires — Conception & Signalétique de Navettes

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/Max54130/fiches-horaires/actions)
[![Android](https://img.shields.io/badge/Android-7.0%20%E2%86%92%2015-3DDC84.svg?logo=android&logoColor=white)](https://github.com/Max54130/fiches-horaires/releases)
[![Web App](https://img.shields.io/badge/Web%20App-En%20Ligne-0284c7.svg)](https://max54130.github.io/fiches-horaires/)
[![Lighthouse Mobile](https://img.shields.io/badge/Lighthouse%20Mobile-95%2B-forestgreen.svg)](#performance--accessibilit%C3%A9)
[![License](https://img.shields.io/badge/licence-MIT-lightgrey.svg)](LICENSE)

> **Système d'Information Voyageurs (SIV) événementiel au standard des gares routières.**  
> Développé pour les organisateurs et bénévoles de la **Coupe de France de Robotique** et des événements **Planète Sciences**.

---

## 🚀 Accès Rapide & Déploiement

| Plateforme | Accès Direct | Description |
| :--- | :--- | :--- |
| **🌐 Application Web** | [max54130.github.io/fiches-horaires/](https://max54130.github.io/fiches-horaires/) | Générateur complet, autonome et réactif avec écran de démarrage splash |
| **📱 Application Android** | [Télécharger l'APK (GitHub Releases)](https://github.com/Max54130/fiches-horaires/releases) | Application native avec splash screen, retour tactile haptique et stockage local |

---

## 🎯 Aperçu Visuel d'une Fiche Générée

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  COUPE DE FRANCE DE ROBOTIQUE                                [ LOGO CDF ]   │
│  NAVETTE BÉNÉVOLES & ÉQUIPES · WEEK-END FINALE 2026                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  ■ SENS 1 : GARE SNCF ➔ SITE ROBOPOLIS                    CIRCULATION 7J/7  │
├──────────────────────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬──────┤
│  Arrêts / Gares      │ 07h │ 08h │ 09h │ 10h │ 11h │ 12h │ 13h │ 14h │ 15h  │
├──────────────────────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼──────┤
│  Gare SNCF           │ 30  │ 00  │ 15  │ 00  │ 30  │ 15  │ 00  │ 30  │  —   │
│  Camping Bénévoles   │ 40  │ 10  │ 25  │ 10  │ 40  │ 25  │ 10  │ 40  │ ALD  │
│  Salle Polyvalente   │ 45  │ 15  │ 30  │ 15  │ 45  │ 30  │ 15  │ 45  │  —   │
│  Site Robopolis      │ 55  │ 25  │ 40  │ 25  │ 55  │ 40  │ 25  │ 55  │ ALD  │
├──────────────────────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴──────┤
│  Légende : ALD = À La Demande · — = Pas de passage · Service gratuit        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Fonctionnalités Métier Clés

Inspiré des principes de design rigoureux et artisanal d'[impeccable.style](https://impeccable.style), l'outil privilégie la clarté ferroviaire et supprime tout artefact d'IA ou décoration inutile :

1. **Écran de Démarrage (Splash Screen)** : Accueil fluide avec transition soignée au lancement de l'application sur le web et sur mobile.
2. **Matrice Automatique Type Gare Routière** : Les départs sont regroupés par tranche horaire avec les minutes compactées dans les cellules, assurant une lecture instantanée pour les passagers.
3. **Propagation Assistée `+10 min`** : Saisissez l'heure de départ à la gare, l'algorithme calcule et propage automatiquement les estimations aux arrêts suivants.
4. **Détection d'Anomalies Chronologiques** : Alerte visuelle immédiate en cas de saut temporel ou d'inversion d'horaire entre deux arrêts (avec tolérance du passage de minuit).
5. **Double Sens en Miroir** : Inversion instantanée des terminus et de la séquence des arrêts pour configurer le trajet retour en 1 clic.
6. **Chiffres Tabulaires Stricts** : Alignement vertical au pixel près (`tabular-nums`) de toutes les colonnes d'heures et de minutes.
7. **Export PNG Vectoriel & Impression A4** : Sortie prête à imprimer au format A4 portrait ou export image haute résolution pour les canaux WhatsApp / Discord de l'événement.
8. **Souverain & Autonome** : Aucune donnée ne quitte votre appareil, aucun cookie, aucun script externe.

---

## 🏛 Architecture du Dépôt

Le projet concilie une utilisation fluide sur le web et une intégration native ultra-sécurisée sur Android :

```
.
├── index.html                     → Application complète avec écran de démarrage splash
├── docs/                          → Miroir de publication automatique pour GitHub Pages
│   ├── index.html                 (Application)
│   ├── fonts/                     (Polices Manrope WOFF2 locales)
│   └── lib/                       (html2canvas embarqué)
├── DOCUMENTATION.md               → Manuel technique détaillé (Android, Kotlin, ponts JS)
├── tests/
│   └── fiches_validation.test.js  → Suite de 21 tests unitaires automatisés
└── app/                           → Application Android Studio (Kotlin + WebView)
    └── src/main/
        ├── assets/                → index.html + fonts + lib (embarqués dans l'APK)
        └── java/.../MainActivity  → WebViewAssetLoader + splash natif + retour haptique
```

---

## 🧪 Tests Unitaires Automatisés

Le moteur algorithmique (parsing des formats `08:30`, `8h15`, `08.45`, détection d'inversions, calcul de grilles, complétion ergonomique) est validé par une suite complète :

```bash
npm test
# ou
node tests/fiches_validation.test.js
```

**Résultat :** `TOTAL : 21 tests réussis, 0 échecs`

---

## 🛠 Compilation Android

L'application Android compile avec **JDK 17** et **Gradle 8.10.2** :

```powershell
# Définir JAVA_HOME vers un JDK 17
$env:JAVA_HOME = "C:\Users\33683\.jdks\jbr-17.0.14"

# Compiler l'APK Debug
.\gradlew.bat assembleDebug

# L'APK compilé se trouve dans :
# app/build/outputs/apk/debug/app-debug.apk
```

---

## ⚡ Performance & Accessibilité

- **Score Lighthouse Mobile : > 95**
  - **FCP (First Contentful Paint)** : < 0.6s (zéro requête CDN, polices locales).
  - **CLS (Cumulative Layout Shift)** : 0 (dimensions réservées).
  - **Cibles tactiles** : $\ge 48\times 48\text{ px}$ pour le pavé numérique et les contrôles.
  - **Contraste WCAG AAA** : $\ge 7:1$ sur les encres et ardoises de signalétique.

---

## 📜 Licence

Projet distribué sous licence MIT. Développé pour la **Coupe de France de Robotique** et **Planète Sciences**.
