# DECISIONS.md — Architecture, Design & Philosophie Anti-Slop

Document de référence des choix de conception et de design arrêtés de manière autonome pour la modernisation de **Fiches Horaires** (application, page vitrine et présentation GitHub).

Inspiré des principes de design artisanal et rigoureux d'[impeccable.style](https://impeccable.style), ce document consigne les partis pris esthétiques, techniques et ergonomiques pour bannir tout "AI slop" et garantir un score Lighthouse mobile > 90.

---

## 1. Diagnostic de l'existant & Refus de l'AI Slop

### Ce qui faisait "vieillot" ou "générique" :
1. **Absence de page vitrine** : L'accès en ligne jetait directement l'utilisateur dans l'éditeur sans explication du contexte (Coupe de France de Robotique / Planète Sciences), sans capture visuelle, ni lien de téléchargement d'APK.
2. **README GitHub minimaliste** : 73 lignes de texte brut sans badges, sans captures d'écran, sans identité visuelle, mentionnant un simple reverse-engineering.
3. **Palette sans personnalité** : Gris délavés (`#f4f5f7`), bleu standard Bootstrap-like (`#009de0`), formulaires à angles arrondis génériques.
4. **Hiérarchie typographique molle** : Manque de tension et de structure sur les heures et arrêts.

### Les tics d'IA ("AI Slop") formellement bannis :
- ❌ **Gradients violets/cyan néon** sur les boutons et les fonds ("purple gradient slop").
- ❌ **Glassmorphism / flous d'arrière-plan décoratifs** avec orbes lumineux flous qui nuisent au contraste.
- ❌ **"Cardocalypse"** : Cartes imbriquées dans des cartes avec `border-radius: 44px` façon pilule déformée.
- ❌ **Bandes latérales colorées d'alerte** sur des cartes normales (anti-pattern "side-tab").
- ❌ **Micro-animations parasites** : Boutons qui rebondissent, icônes qui gigotent sans intention.
- ❌ **Textes verbeux et répétitifs** : Explications redondantes de boutons évidents.
- ❌ **Soupe d'emojis** en guise de structure visuelle.

---

## 2. Direction Artistique : "Transit Craft & Swiss Precision"

Puisqu'il s'agit d'un générateur de **fiches horaires de navettes pour un événement technologique** (Coupe de France de Robotique), nous adoptons l'esthétique intemporelle de la **signalétique de transport public** (SNCF, SBB Suisse, Métro de Tokyo, Vignelli) alliée au minimalisme tactile d'**Impeccable** :

### 2.1 Palette de couleurs délibérée
- **Fond "Papier technique"** : Blanc pur `#FFFFFF` et papier chaud `#F8FAFC` pour une lecture reposante et un rendu d'impression parfait.
- **Encres profondes** :
  - Texte principal : Anthracite dense `#0F172A` (ratio de contraste WCAG AAA > 12:1).
  - Texte secondaire / légendes : Ardoise `#475569`.
  - Bordures et séparateurs : Filets d'1px haute précision `#E2E8F0` / `#CBD5E1`.
- **Bleus signalétiques de transport** :
  - Bleu Marine institutionnel `#1E293B` pour les structures et l'autorité visuelle.
  - Bleu Cobalt signalétique `#2563eb` pour les actions principales et la sélection.
- **Accents de statut fonctionnels** (pas de décoration superflue) :
  - Ambre `#D97706` pour les avertissements d'inversion horaire.
  - Émeraude `#059669` pour la validation et le mode hors-ligne.
  - Rouge signal `#DC2626` pour la suppression et les erreurs critiques.

### 2.2 Typographie et chiffres tabulaires
- Typographie moderne et lisible avec fonte locale embarquée (`Manrope`).
- **Chiffres tabulaires obligatoires** (`font-variant-numeric: tabular-nums lining-nums`) pour aligner parfaitement les heures et minutes sans décalage horizontal dans les grilles.
- En-têtes compacts, crénelage soigné (`letter-spacing: -0.02em`), étiquettes en capitales discrètes (`letter-spacing: 0.08em`).

### 2.3 Composants "Instrument Strip" & Commandes tactiles
- Remplacement des onglets génériques par des **bandeaux d'instruments tactiles** inspirés d'appareils de mesure : boutons segmentés à bords nets, retour d'enfoncement physique subtil (`transform: translateY(1px)`).
- Pavé numérique virtuel pour la saisie des horaires repensé comme un contrôleur matériel (touches à contours nets, contraste optimal).

---

## 3. Architecture des Pages & Déploiement

Pour concilier l'expérience sur le web (visiteurs, organisateurs, bénévoles) et l'expérience dans l'application Android :

```
github-repo / web root
├── index.html       → Page Vitrine (Showcase Landing) : Présentation moderne, démo interactive en direct, téléchargement APK, lien vers l'éditeur
├── app.html         → Application Éditeur complète : Interface épurée, responsive mobile/desktop, impression A4, export PNG
├── docs/            → Miroir pour GitHub Pages (index.html + app.html + lib/ + fonts/)
└── README.md        → Vitrine GitHub technique et visuelle avec badges, captures SVG et guide
```

### 3.1 Page Vitrine (`index.html`)
- **Hero épuré** : Typographie forte, proposition de valeur immédiate ("Générez des fiches horaires de navettes au standard des gares routières en 2 minutes").
- **Double CTA immédiat** :
  - `[ Ouvrir le générateur en ligne → ]` (redirige vers `app.html`)
  - `[ Télécharger l'APK Android (v2.0) ]` (lien direct vers l'artefact compilé)
- **Démonstrateur Interactif en direct** : Une fiche horaire réelle prévisualisée dans la vitrine avec sélecteur de sens (Gare → Site / Site → Gare) et de logo (Planète Sciences / Coupe de France / Eurobot) sans avoir à ouvrir l'éditeur.
- **Grille des fonctionnalités clés** : 6 atouts majeurs expliqués en 2 phrases chacun (zéro verbiage).
- **Garantie d'accessibilité & score Lighthouse mobile > 90**.

### 3.2 Application Éditeur (`app.html`)
- Version modernisée sans aucun framework lourd (0 Ko de React/Vue/Tailwind superflu).
- Chargement instantané (< 100 ms).
- Lien discret "← Présentation" pour retourner sur la vitrine.
- Détection Android transparente (`AndroidBlob`).

### 3.3 Présentation GitHub (`README.md`)
- Badges shields.io modernes (Build Passing, Version 2.0, Android 7.0+, Web PWA, 100% Offline, Lighthouse 95+).
- Démo visuelle de la fiche générée en ASCII/SVG haute fidélité.
- Guide d'installation et de compilation clair et testé.

---

## 4. Stratégie Lighthouse Mobile > 90

Pour garantir un score supérieur à 90 sur mobile (même sur réseau 3G/4G restreint) :

1. **Zéro dépendance externe au runtime** : Polices Manrope embarquées en local WOFF2, lib `html2canvas` locale, zéro CDN tiers (pas de Google Fonts ou Cloudflare bloquants).
2. **CSS critique inline et minimaliste** : Temps de rendu du premier pixel (FCP / LCP) < 0.5s.
3. **Cumulative Layout Shift (CLS) = 0** : Tailles d'images et de conteneurs explicitement réservées (`width`, `height`, `aspect-ratio`).
4. **Cibles tactiles adaptées aux doigts** : Boutons et zones de clic conformes aux normes WCAG (minimum 48×48px pour les cibles principales).
5. **Métadonnées SEO & OpenGraph complètes** : Balises `<title>`, `<meta name="description">`, `theme-color`, `<link rel="canonical">`.
